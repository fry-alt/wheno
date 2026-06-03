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
          `Mark study, work, and meeting as fixed; everything else flexible unless the user implies otherwise.`,
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
  };

  return {
    title: args.title,
    category: isCategory(args.category) ? args.category : "other",
    starts_at: new Date(args.starts_at).toISOString(),
    ends_at: new Date(args.ends_at).toISOString(),
    is_fixed: Boolean(args.is_fixed),
    notes: args.notes ?? null,
    recurrence: null,
  };
}
