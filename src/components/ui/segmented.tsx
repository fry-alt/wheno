"use client";

import { clsx } from "clsx";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="inline-flex rounded-full border border-border bg-card p-0.5">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            className={clsx(
              "rounded-full px-4 py-1.5 text-sm font-semibold transition",
              active
                ? "bg-card-strong text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.4)]"
                : "text-muted active:text-foreground",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
