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
  const fileJson = (await fileRes.json()) as { result: { file_path: string } };
  const filePath = fileJson.result.file_path;

  const audioRes = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`);
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
