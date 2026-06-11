"use client";

import { useEffect, useRef, useState } from "react";

import { EventForm, type RecurringEdit } from "./event-form";
import { ReviewSheet } from "./review-sheet";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import type { CalendarEvent } from "@/lib/events/types";
import type { VoiceAction } from "@/lib/events/voice-plan-types";

type Mode = "nl" | "manual" | "review";

export function CaptureSheet({
  timezone,
  defaultDate,
  editing,
  recurringEdit,
  onClose,
}: {
  timezone: string;
  defaultDate: string;
  editing?: CalendarEvent | null;
  recurringEdit?: RecurringEdit | null;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<Mode>(editing ? "manual" : "nl");
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actions, setActions] = useState<VoiceAction[]>([]);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
    };
  }, []);

  async function runPlan(input: string) {
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/voice-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input }),
      });
      if (!res.ok) throw new Error();
      const { actions: a } = (await res.json()) as { actions: VoiceAction[] };
      if (!a || a.length === 0) {
        setError("Не понял. Попробуй иначе или добавь вручную.");
        return;
      }
      setActions(a);
      setMode("review");
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
          await runPlan(transcript);
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

  const inputCls = "w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder-muted outline-none";

  return (
    <BottomSheet onClose={onClose}>
        {mode !== "review" && !editing && (
          <div className="mb-4 flex gap-2">
            <button onClick={() => setMode("nl")} className="rounded-full px-4 py-1.5 text-xs font-semibold" style={{ background: mode === "nl" ? "var(--color-foreground)" : "var(--color-card)", color: mode === "nl" ? "var(--color-background)" : "var(--color-muted)" }}>Текстом / голосом</button>
            <button onClick={() => setMode("manual")} className="rounded-full px-4 py-1.5 text-xs font-semibold" style={{ background: mode === "manual" ? "var(--color-foreground)" : "var(--color-card)", color: mode === "manual" ? "var(--color-background)" : "var(--color-muted)" }}>Вручную</button>
          </div>
        )}

        {mode === "nl" && (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-semibold text-foreground">Что добавить или изменить?</p>
            <div className="flex gap-2">
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder="завтра зал в 7, перенеси созвон на 15, удали ужин в чт" className={`${inputCls} flex-1`} />
              <button onClick={toggleRecording} className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-border bg-card text-lg" aria-label="Голос">{recording ? "⏹️" : "🎤"}</button>
            </div>
            {error && <p className="text-center text-xs text-red-400">{error}</p>}
            <button onClick={() => runPlan(text)} disabled={pending || !text.trim()} className="rounded-xl bg-accent py-3 text-sm font-semibold text-accent-foreground disabled:opacity-50">
              {pending ? "Думаю…" : "Разобрать"}
            </button>
          </div>
        )}

        {mode === "manual" && (
          <EventForm timezone={timezone} initialDate={defaultDate} editing={editing} prefill={null} recurringEdit={recurringEdit} onDone={onClose} />
        )}

        {mode === "review" && (
          <ReviewSheet actions={actions} timezone={timezone} onClose={onClose} />
        )}
    </BottomSheet>
  );
}
