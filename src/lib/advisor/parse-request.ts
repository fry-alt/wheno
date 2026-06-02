import type OpenAI from "openai";
import { addDays, format, parseISO } from "date-fns";

import { getOpenAI } from "@/lib/openai";
import { CATEGORIES, isCategory } from "@/lib/events/categories";
import type { SlotRequest } from "./types";

const PARTS = ["morning", "afternoon", "evening", "any"] as const;

const TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: "plan_request",
    description: "Extract a scheduling request: what to schedule, how many times, how long, in which window and part of day.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short activity title" },
        category: { type: "string", enum: CATEGORIES as unknown as string[] },
        count: { type: "integer", description: "How many occurrences (default 1)" },
        duration_min: { type: "integer", description: "Duration of each in minutes (default 60)" },
        window_from: { type: "string", description: "Window start date yyyy-MM-dd" },
        window_to: { type: "string", description: "Window end date yyyy-MM-dd (inclusive)" },
        part_of_day: { type: "string", enum: ["morning", "afternoon", "evening", "any"] },
      },
      required: ["title", "category", "count", "duration_min", "window_from", "window_to", "part_of_day"],
    },
  },
};

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

function validDate(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export async function parseRequest(
  text: string,
  ctx: { today: string; timezone: string },
): Promise<SlotRequest> {
  const openai = getOpenAI();

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          `Today is ${ctx.today}. The user's timezone is ${ctx.timezone}. ` +
          `Interpret the user's scheduling request. Resolve relative ranges ("на этой неделе" = Monday–Sunday of the current week) into window_from/window_to as yyyy-MM-dd. ` +
          `count defaults to 1, duration_min defaults to 60. ` +
          `Categories: ${CATEGORIES.join(", ")}. Pick part_of_day from morning/afternoon/evening/any.`,
      },
      { role: "user", content: text },
    ],
    tools: [TOOL],
    tool_choice: { type: "function", function: { name: "plan_request" } },
    max_tokens: 300,
  });

  const rawCall = response.choices[0]?.message.tool_calls?.[0];
  const call = rawCall as Extract<typeof rawCall, { type: "function" }> | undefined;
  if (!call || !("function" in call)) {
    throw new Error("Could not parse a scheduling request.");
  }

  const args = JSON.parse(call.function.arguments) as Record<string, unknown>;

  const defaultFrom = ctx.today;
  const defaultTo = format(addDays(parseISO(ctx.today), 6), "yyyy-MM-dd");
  const from = validDate(args.window_from) ? args.window_from : defaultFrom;
  let to = validDate(args.window_to) ? args.window_to : defaultTo;
  if (to < from) to = defaultTo;

  const part = PARTS.includes(args.part_of_day as (typeof PARTS)[number])
    ? (args.part_of_day as SlotRequest["part_of_day"])
    : "any";

  return {
    title: typeof args.title === "string" && args.title.trim() ? args.title.trim() : "Событие",
    category: typeof args.category === "string" && isCategory(args.category) ? args.category : "other",
    count: clamp(Number(args.count), 1, 14),
    duration_min: clamp(Number(args.duration_min), 15, 600),
    window: { from, to },
    part_of_day: part,
  };
}
