import OpenAI from "openai";

import { getOpenAiApiKey, getTelegramBotToken } from "@/lib/env";

let client: OpenAI | null = null;

export function getOpenAI() {
  if (!client) {
    client = new OpenAI({ apiKey: getOpenAiApiKey() });
  }
  return client;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type ActivityType =
  | "gym" | "run" | "swim" | "tennis" | "cycling" | "yoga" | "sport"
  | "dinner" | "lunch" | "coffee" | "drinks" | "bar"
  | "work" | "meeting" | "conference" | "call"
  | "party" | "concert" | "theatre" | "cinema" | "event"
  | "rest" | "sleep" | "travel"
  | "other";

export type EnergyLevel = "high" | "medium" | "low";
export type DressCode = "athletic" | "casual" | "smart" | "formal";

export interface ParsedEvent {
  title: string;
  activity_type: ActivityType;
  date: string;          // "yyyy-MM-dd"
  start_time: string;    // "HH:mm"
  end_time: string;      // "HH:mm"
  location: string | null;
  energy_after: EnergyLevel;
  dress_code: DressCode;
  is_flexible: boolean;
  notes: string | null;
}

export type BotIntent =
  | { type: "add_event";     event: ParsedEvent }
  | { type: "query_schedule"; question: string }
  | { type: "find_slot";      activity: string; constraints: string }
  | { type: "onboarding";     info: string }
  | { type: "chitchat";       reply: string };

// ─── Tools ───────────────────────────────────────────────────────────────────

const TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "add_calendar_event",
      description: "Add an event to the user's calendar when they describe something they're doing",
      parameters: {
        type: "object",
        properties: {
          title:         { type: "string", description: "Short event title" },
          activity_type: {
            type: "string",
            enum: ["gym","run","swim","tennis","cycling","yoga","sport",
                   "dinner","lunch","coffee","drinks","bar",
                   "work","meeting","conference","call",
                   "party","concert","theatre","cinema","event",
                   "rest","sleep","travel","other"],
          },
          date:          { type: "string", description: "ISO date yyyy-MM-dd. Use today's date as reference." },
          start_time:    { type: "string", description: "HH:mm" },
          end_time:      { type: "string", description: "HH:mm" },
          location:      { type: "string", nullable: true },
          energy_after:  { type: "string", enum: ["high","medium","low"],
                           description: "How much energy is left after this activity" },
          dress_code:    { type: "string", enum: ["athletic","casual","smart","formal"] },
          is_flexible:   { type: "boolean", description: "Can this event be rescheduled?" },
          notes:         { type: "string", nullable: true },
        },
        required: ["title","activity_type","date","start_time","end_time",
                   "energy_after","dress_code","is_flexible"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "find_free_slot",
      description: "Find the best time slot for an activity considering the user's existing calendar and context",
      parameters: {
        type: "object",
        properties: {
          activity:    { type: "string", description: "What the user wants to do" },
          constraints: { type: "string", description: "Any time/location/energy constraints the user mentioned" },
        },
        required: ["activity","constraints"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_onboarding_info",
      description: "Save user preferences learned during onboarding",
      parameters: {
        type: "object",
        properties: {
          interests:  { type: "array", items: { type: "string" } },
          wake_time:  { type: "string", description: "HH:mm or null" },
          sleep_time: { type: "string", description: "HH:mm or null" },
          work_start: { type: "string", description: "HH:mm or null" },
          work_end:   { type: "string", description: "HH:mm or null" },
          summary:    { type: "string", description: "Short plain-text summary of what you learned about this person" },
        },
        required: ["interests","summary"],
      },
    },
  },
];

// ─── Main AI call ─────────────────────────────────────────────────────────────

export interface CalendarContext {
  today: string;           // "yyyy-MM-dd"
  timezone: string;
  upcomingEvents: Array<{
    title: string;
    starts_at: string;
    ends_at: string;
    energy_after: string | null;
    dress_code: string | null;
    location: string | null;
  }>;
  userContext: string | null; // ai_context from user_profiles
}

export async function processMessage(
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  calendarCtx: CalendarContext,
  language: "ru" | "en",
): Promise<{
  reply: string;
  toolCall: { name: string; args: Record<string, unknown> } | null;
}> {
  const openai = getOpenAI();

  const langInstruction = language === "ru"
    ? "Always reply in Russian. Use informal 'ты'."
    : "Always reply in English.";

  const systemPrompt = `You are a smart personal AI calendar assistant inside Telegram.
${langInstruction}

Today is ${calendarCtx.today}. User's timezone: ${calendarCtx.timezone}.

${calendarCtx.userContext ? `What you know about this user:\n${calendarCtx.userContext}\n` : ""}

User's upcoming events (next 7 days):
${
  calendarCtx.upcomingEvents.length
    ? calendarCtx.upcomingEvents
        .map((e) => `• ${e.starts_at.slice(0,16).replace("T"," ")} — ${e.title}` +
          (e.energy_after ? ` [energy after: ${e.energy_after}]` : "") +
          (e.dress_code   ? ` [dress: ${e.dress_code}]` : "") +
          (e.location     ? ` @ ${e.location}` : ""))
        .join("\n")
    : "No events yet."
}

CONTEXT RULES you must apply when suggesting times:
- After gym/run/sport → energy is LOW, dress is ATHLETIC → suggest ≥90 min gap before social events, prefer casual venues
- After formal meeting/conference → dress is SMART/FORMAL → ok for dinner
- Late evening events (after 22:00) → suggest nothing right after
- If user mentions "после зала" / "after gym" → factor in the gym session context
- Proactively warn about conflicts or poor transitions

When user wants to add an event, call add_calendar_event.
When user asks about free time or "when can I", call find_free_slot.
For other messages, reply conversationally and helpfully.
Keep replies short — this is a chat, not an email.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      ...messages,
    ],
    tools: TOOLS,
    tool_choice: "auto",
    max_tokens: 500,
  });

  const choice = response.choices[0];

  if (choice.message.tool_calls?.[0]) {
    const raw = choice.message.tool_calls[0] as {
      function: { name: string; arguments: string };
    };
    const args = JSON.parse(raw.function.arguments) as Record<string, unknown>;
    return {
      reply: choice.message.content ?? "",
      toolCall: { name: raw.function.name, args },
    };
  }

  return {
    reply: choice.message.content ?? "...",
    toolCall: null,
  };
}

export async function transcribeVoice(fileId: string): Promise<string> {
  const token = getTelegramBotToken();

  // 1. Get file path from Telegram
  const fileRes = await fetch(
    `https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`,
  );
  const fileJson = (await fileRes.json()) as { result: { file_path: string } };
  const filePath = fileJson.result.file_path;

  // 2. Download OGG audio
  const audioRes = await fetch(
    `https://api.telegram.org/file/bot${token}/${filePath}`,
  );
  const audioBuffer = await audioRes.arrayBuffer();

  // 3. Transcribe with Whisper
  const openai = getOpenAI();
  const file = new File([audioBuffer], "voice.ogg", { type: "audio/ogg" });
  const result = await openai.audio.transcriptions.create({
    file,
    model: "whisper-1",
    language: "ru",
  });

  return result.text;
}
