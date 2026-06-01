"use client";

import { useEffect, useRef, useState } from "react";

import { ConfirmCard } from "./confirm-card";
import { EventForm } from "./event-form";
import type { CalendarEvent, ParsedEvent } from "@/lib/events/types";

type Mode = "nl" | "manual" | "confirm";

export function CaptureSheet({
  timezone,
  defaultDate,
  editing,
  onClose,
}: {
  timezone: string;
  defaultDate: string;
  editing?: CalendarEvent | null;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<Mode>(editing ? "manual" : "nl");
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedEvent | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop(); // triggers onstop → stops mic tracks
      }
    };
  }, []);

  async function runParse(input: string) {
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/parse-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input }),
      });
      if (!res.ok) throw new Error();
      const { parsed: p } = (await res.json()) as { parsed: ParsedEvent };
      setParsed(p);
      setMode("confirm");
    } catch {
      setError("Не понял. Попробуй иначе или добавь вручную.");
    } finally {
      setPending(false);
    }
  }

  async function toggleRecording() {
    if (recording) {
      recorderRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: BlobPart[] = [];
      const rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        const blob = new Blob(chunks, { type: "audio/webm" });
        setPending(true);
        try {
          const fd = new FormData();
          fd.append("audio", blob, "voice.webm");
          const res = await fetch("/api/transcribe", { method: "POST", body: fd });
          if (!res.ok) throw new Error();
          const { text: transcript } = (await res.json()) as { text: string };
          setText(transcript);
          await runParse(transcript);
        } catch {
          setError("Не расслышал. Напиши текстом.");
          setPending(false);
        }
      };
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
    } catch {
      setError("Микрофон недоступен. Напиши текстом.");
    }
  }

  const inputCls = "w-full rounded-xl bg-[#1a1a1a] px-4 py-3 text-sm text-white placeholder-[#555] outline-none";

  return (
    <div className="fixed inset-0 z-50 bg-black/60" onClick={onClose}>
      <div className="absolute bottom-0 left-0 right-0 rounded-t-2xl bg-[#111] p-5 pb-10" onClick={(e) => e.stopPropagation()}>
        {mode !== "confirm" && !editing && (
          <div className="mb-4 flex gap-2">
            <button onClick={() => setMode("nl")} className="rounded-full px-4 py-1.5 text-xs font-semibold" style={{ background: mode === "nl" ? "#fff" : "#1a1a1a", color: mode === "nl" ? "#000" : "#888" }}>Текстом / голосом</button>
            <button onClick={() => setMode("manual")} className="rounded-full px-4 py-1.5 text-xs font-semibold" style={{ background: mode === "manual" ? "#fff" : "#1a1a1a", color: mode === "manual" ? "#000" : "#888" }}>Вручную</button>
          </div>
        )}

        {mode === "nl" && (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-semibold text-white">Что добавить?</p>
            <div className="flex gap-2">
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder="завтра зал в 7 на час" className={`${inputCls} flex-1`} />
              <button onClick={toggleRecording} className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-[#1a1a1a] text-lg" aria-label="Голос">{recording ? "⏹️" : "🎤"}</button>
            </div>
            {error && <p className="text-center text-xs text-red-400">{error}</p>}
            <button onClick={() => runParse(text)} disabled={pending || !text.trim()} className="rounded-xl bg-white py-3 text-sm font-semibold text-black disabled:opacity-50">
              {pending ? "Думаю…" : "Разобрать"}
            </button>
          </div>
        )}

        {mode === "manual" && (
          <EventForm timezone={timezone} initialDate={defaultDate} editing={editing} prefill={editing ? null : parsed} onDone={onClose} />
        )}

        {mode === "confirm" && parsed && (
          <ConfirmCard
            parsed={parsed}
            timezone={timezone}
            onConfirmed={onClose}
            onEdit={() => setMode("manual")}
            onCancel={onClose}
          />
        )}
      </div>
    </div>
  );
}
