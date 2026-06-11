"use client";

import { useState } from "react";
import { clsx } from "clsx";

import { INTEREST_TAGS, isInterestSlug } from "@/lib/profile/interests";

export function InterestPicker({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const [custom, setCustom] = useState("");
  const customTags = value.filter((s) => !isInterestSlug(s));

  function toggle(slug: string) {
    onChange(value.includes(slug) ? value.filter((s) => s !== slug) : [...value, slug]);
  }
  function addCustom() {
    const t = custom.trim();
    if (t && !value.includes(t) && value.length < 12) onChange([...value, t]);
    setCustom("");
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {INTEREST_TAGS.map((t) => {
          const on = value.includes(t.slug);
          return (
            <button
              key={t.slug}
              type="button"
              onClick={() => toggle(t.slug)}
              className={clsx(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition active:scale-95",
                on ? "border-accent bg-accent-soft text-accent" : "border-border bg-card text-muted",
              )}
            >
              {t.emoji} {t.label}
            </button>
          );
        })}
        {customTags.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onChange(value.filter((s) => s !== t))}
            className="rounded-full border border-accent bg-accent-soft px-3 py-1.5 text-xs font-medium text-accent"
          >
            {t} ✕
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustom();
            }
          }}
          placeholder="свой интерес"
          className="flex-1 rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground placeholder-muted outline-none"
        />
        {custom.trim() && (
          <button type="button" onClick={addCustom} className="rounded-xl bg-accent px-3 text-sm font-semibold text-accent-foreground">＋</button>
        )}
      </div>
    </div>
  );
}
