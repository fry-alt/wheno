import OpenAI from "openai";

import { getOpenAiApiKey, getTelegramBotToken } from "@/lib/env";

let client: OpenAI | null = null;

export function getOpenAI() {
  if (!client) {
    client = new OpenAI({ apiKey: getOpenAiApiKey() });
  }
  return client;
}

export async function transcribeVoice(fileId: string): Promise<string> {
  const token = getTelegramBotToken();

  const fileRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
  if (!fileRes.ok) throw new Error(`Telegram getFile failed: ${fileRes.status}`);
  const fileJson = (await fileRes.json()) as { ok: boolean; result?: { file_path: string } };
  if (!fileJson.ok || !fileJson.result?.file_path) {
    throw new Error("Telegram getFile returned no file_path");
  }
  const filePath = fileJson.result.file_path;

  const audioRes = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`);
  if (!audioRes.ok) throw new Error(`Telegram file download failed: ${audioRes.status}`);
  const audioBuffer = await audioRes.arrayBuffer();

  const openai = getOpenAI();
  const file = new File([audioBuffer], "voice.ogg", { type: "audio/ogg" });
  const result = await openai.audio.transcriptions.create({
    file,
    model: "whisper-1",
    language: "ru",
  });

  return result.text;
}
