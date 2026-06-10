import type OpenAI from "openai";

import { getOpenAI } from "@/lib/openai";
import { CATEGORIES } from "./categories";
import type { EventContextItem } from "./voice-plan-types";

const TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: "plan_schedule",
    description: "Extract a list of calendar actions (create/edit/delete events, add day notes) from the user's message.",
    parameters: {
      type: "object",
      properties: {
        actions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["create", "edit", "delete", "note"] },
              title: { type: "string" },
              category: { type: "string", enum: CATEGORIES as unknown as string[] },
              starts_at: { type: "string", description: "ISO 8601 with tz offset" },
              ends_at: { type: "string", description: "ISO 8601 with tz offset; default +1h" },
              is_fixed: { type: "boolean" },
              notes: { type: "string", nullable: true },
              recur_freq: { type: "string", enum: ["daily", "weekly", "monthly", "yearly"], nullable: true },
              recur_weekdays: { type: "array", items: { type: "integer" }, nullable: true },
              recur_until: { type: "string", nullable: true },
              recur_count: { type: "integer", nullable: true },
              target_id: { type: "string", nullable: true, description: "id of an existing event for edit/delete" },
              target_scope: { type: "string", enum: ["one", "all"], nullable: true },
              target_date: { type: "string", nullable: true, description: "occurrence date yyyy-MM-dd for scope=one" },
              note_date: { type: "string", nullable: true },
              note_text: { type: "string", nullable: true },
            },
            required: ["type"],
          },
        },
      },
      required: ["actions"],
    },
  },
};

export async function planSchedule(
  text: string,
  ctx: { today: string; timezone: string; events: EventContextItem[] },
): Promise<unknown[]> {
  const openai = getOpenAI();
  const eventLines = ctx.events
    .map((e) => `${e.id} | ${e.date} ${e.start} | ${e.title} | ${e.category}${e.recurring ? " | recurring" : ""}`)
    .join("\n");

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          `Today is ${ctx.today}. The user's timezone is ${ctx.timezone}. ` +
          `Parse the message into a list of calendar actions. Each action has a "type": ` +
          `"create" (new event), "edit" (change an existing event), "delete" (remove an existing event), "note" (add a day note). ` +
          `For create/edit, return starts_at and ends_at as ISO 8601 WITH the user's timezone offset; if no end is given, +1 hour. ` +
          `Categories: ${CATEGORIES.join(", ")}. Mark study/work/meeting as fixed; others flexible unless implied. ` +
          `For repetition set recur_freq (+ recur_weekdays 1=Mon..7=Sun for weekly). ` +
          `For edit/delete you MUST set target_id to the id of an existing event from the list below. ` +
          `If the user means a single occurrence of a recurring event, set target_scope="one" and target_date (yyyy-MM-dd); ` +
          `if they mean the whole repeating series, set target_scope="all". ` +
          `For note set note_date (yyyy-MM-dd) and note_text. Only include actions the user clearly asked for.\n\n` +
          `Existing events (id | date time | title | category):\n${eventLines || "(none)"}`,
      },
      { role: "user", content: text },
    ],
    tools: [TOOL],
    tool_choice: { type: "function", function: { name: "plan_schedule" } },
    max_tokens: 1200,
  });

  const rawCall = response.choices[0]?.message.tool_calls?.[0];
  const call = rawCall as Extract<typeof rawCall, { type: "function" }> | undefined;
  if (!call || !("function" in call)) return [];
  try {
    const args = JSON.parse(call.function.arguments) as { actions?: unknown };
    return Array.isArray(args.actions) ? args.actions : [];
  } catch {
    return [];
  }
}
