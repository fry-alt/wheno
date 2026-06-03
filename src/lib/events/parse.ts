import type OpenAI from "openai";

import { getOpenAI } from "@/lib/openai";
import { CATEGORIES, isCategory } from "./categories";
import type { ParsedEvent } from "./types";

const TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: "create_event",
    description: "Extract a single calendar event from the user's message.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short event title" },
        category: { type: "string", enum: CATEGORIES as unknown as string[] },
        starts_at: { type: "string", description: "ISO 8601 with timezone offset" },
        ends_at: { type: "string", description: "ISO 8601 with timezone offset; default +1h" },
        is_fixed: { type: "boolean", description: "true for mandatory (study/work/meeting), false for flexible" },
        notes: { type: "string", nullable: true },
        recur_freq: { type: "string", enum: ["daily", "weekly", "monthly", "yearly"], nullable: true, description: "Repetition frequency, or omit/null for a one-off event" },
        recur_weekdays: { type: "array", items: { type: "integer" }, nullable: true, description: "For weekly: weekdays 1=Mon..7=Sun" },
        recur_until: { type: "string", nullable: true, description: "Repeat until this date yyyy-MM-dd, or null" },
        recur_count: { type: "integer", nullable: true, description: "Repeat this many times, or null" },
      },
      required: ["title", "category", "starts_at", "ends_at", "is_fixed"],
    },
  },
};

export async function parseEvent(
  text: string,
  ctx: { today: string; timezone: string },
): Promise<ParsedEvent> {
  const openai = getOpenAI();

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          `Today is ${ctx.today}. The user's timezone is ${ctx.timezone}. ` +
          `Parse the message into exactly one calendar event. ` +
          `Return starts_at and ends_at as ISO 8601 timestamps WITH the user's timezone offset. ` +
          `If no end time is given, make it one hour after the start. ` +
          `Categories: ${CATEGORIES.join(", ")}. ` +
          `Mark study, work, and meeting as fixed; everything else flexible unless the user implies otherwise. ` +
          `If the user implies repetition, set recur_freq (daily/weekly/monthly/yearly) and, for weekly, recur_weekdays (1=Mon..7=Sun). "каждый день"→daily, "по пн ср пт"→weekly [1,3,5], "каждый месяц"→monthly, "день рождения"/"каждый год"→yearly. Otherwise leave recur_freq null.`,
      },
      { role: "user", content: text },
    ],
    tools: [TOOL],
    tool_choice: { type: "function", function: { name: "create_event" } },
    max_tokens: 300,
  });

  const rawCall = response.choices[0]?.message.tool_calls?.[0];
  // Narrow to function tool call; cast avoids union issue with mock shape in tests
  const call = rawCall as Extract<typeof rawCall, { type: "function" }> | undefined;
  if (!call || !("function" in call)) {
    throw new Error("Could not parse an event from the message.");
  }

  const args = JSON.parse(call.function.arguments) as {
    title: string;
    category: string;
    starts_at: string;
    ends_at: string;
    is_fixed: boolean;
    notes?: string | null;
    recur_freq?: "daily" | "weekly" | "monthly" | "yearly" | null;
    recur_weekdays?: number[] | null;
    recur_until?: string | null;
    recur_count?: number | null;
  };

  const recurrence = args.recur_freq
    ? {
        freq: args.recur_freq,
        weekdays:
          args.recur_freq === "weekly" && Array.isArray(args.recur_weekdays) && args.recur_weekdays.length > 0
            ? args.recur_weekdays
            : null,
        until: typeof args.recur_until === "string" && /^\d{4}-\d{2}-\d{2}$/.test(args.recur_until) ? args.recur_until : null,
        count: typeof args.recur_count === "number" && args.recur_count > 0 ? Math.round(args.recur_count) : null,
      }
    : null;

  return {
    title: args.title,
    category: isCategory(args.category) ? args.category : "other",
    starts_at: new Date(args.starts_at).toISOString(),
    ends_at: new Date(args.ends_at).toISOString(),
    is_fixed: Boolean(args.is_fixed),
    notes: args.notes ?? null,
    recurrence,
  };
}
