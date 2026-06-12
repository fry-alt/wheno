import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { getOpenAI } from "@/lib/openai";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await checkRateLimit(user.id))) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const form = await request.formData();
  const audio = form.get("audio");
  if (!(audio instanceof File)) return NextResponse.json({ error: "no_audio" }, { status: 400 });

  try {
    const openai = getOpenAI();
    const result = await openai.audio.transcriptions.create({
      file: audio,
      model: "whisper-1",
      language: "ru",
    });
    return NextResponse.json({ text: result.text });
  } catch {
    return NextResponse.json({ error: "transcribe_failed" }, { status: 422 });
  }
}
