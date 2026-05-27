"use client";

import { useMemo, useState } from "react";

import { FormSubmitButton } from "@/components/form-submit-button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createBusyBlockAction } from "@/lib/actions";
import type { Language } from "@/lib/preferences-shared";
import { cn } from "@/lib/utils";

type AvailabilityMode = "quick" | "manual" | "weekly";

type AvailabilityCopy = {
  modeQuick: string;
  modeManual: string;
  modeWeekly: string;
  quickDateLabel: string;
  quickPresetLabel: string;
  manualTitle: string;
  weeklyTitle: string;
  titleLabel: string;
  titlePlaceholder: string;
  dateLabel: string;
  startDateLabel: string;
  endDateLabel: string;
  startLabel: string;
  endLabel: string;
  weekdaysLabel: string;
  submit: string;
  pending: string;
  quickPresets: {
    lunch: string;
    workday: string;
    evening: string;
  };
  weekdays: string[];
};

const QUICK_PRESETS = {
  lunch: {
    title: "Lunch",
    startTime: "12:00",
    endTime: "13:00",
  },
  workday: {
    title: "Work",
    startTime: "09:00",
    endTime: "17:00",
  },
  evening: {
    title: "Evening plans",
    startTime: "18:00",
    endTime: "21:00",
  },
} as const;

type QuickPreset = keyof typeof QUICK_PRESETS;

export function AvailabilityForm({
  copy,
  defaultDate,
  defaultEndDate,
  groupId,
  language,
}: {
  copy: AvailabilityCopy;
  defaultDate: string;
  defaultEndDate: string;
  groupId: string;
  language: Language;
}) {
  const [mode, setMode] = useState<AvailabilityMode>("quick");
  const [quickPreset, setQuickPreset] = useState<QuickPreset>("evening");
  const selectedPreset = QUICK_PRESETS[quickPreset];
  const defaultWeekday = useMemo(() => {
    const date = new Date(`${defaultDate}T00:00:00`);
    return Number.isNaN(date.getTime()) ? "1" : String(date.getDay());
  }, [defaultDate]);

  return (
    <Card>
      <div className="grid grid-cols-3 gap-1 rounded-[22px] border border-border/70 bg-card-muted p-1">
        <ModeButton active={mode === "quick"} onClick={() => setMode("quick")}>
          {copy.modeQuick}
        </ModeButton>
        <ModeButton active={mode === "manual"} onClick={() => setMode("manual")}>
          {copy.modeManual}
        </ModeButton>
        <ModeButton active={mode === "weekly"} onClick={() => setMode("weekly")}>
          {copy.modeWeekly}
        </ModeButton>
      </div>

      <form action={createBusyBlockAction} className="mt-5 space-y-4">
        <input name="groupId" type="hidden" value={groupId} />
        <input name="mode" type="hidden" value={mode} />

        {mode === "quick" ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">{copy.quickPresetLabel}</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {Object.keys(QUICK_PRESETS).map((preset) => (
                  <button
                    aria-pressed={quickPreset === preset}
                    className={cn(
                      "h-11 rounded-[18px] px-3 text-sm font-semibold ring-1 ring-border/70 transition",
                      quickPreset === preset
                        ? "bg-foreground text-background"
                        : "bg-card text-foreground hover:bg-card-strong",
                    )}
                    key={preset}
                    onClick={() => setQuickPreset(preset as QuickPreset)}
                    type="button"
                  >
                    {copy.quickPresets[preset as QuickPreset]}
                  </button>
                ))}
              </div>
            </div>
            <Input
              defaultValue={selectedPreset.title}
              id="quick-title"
              key={quickPreset}
              label={copy.titleLabel}
              name="title"
              placeholder={copy.titlePlaceholder}
              required
            />
            <Input
              defaultValue={defaultDate}
              id="quick-date"
              label={copy.quickDateLabel}
              name="date"
              required
              type="date"
            />
            <input name="startTime" type="hidden" value={selectedPreset.startTime} />
            <input name="endTime" type="hidden" value={selectedPreset.endTime} />
          </div>
        ) : null}

        {mode === "manual" ? (
          <div className="space-y-4">
            <p className="text-sm font-semibold text-foreground">{copy.manualTitle}</p>
            <Input
              autoFocus
              id="manual-title"
              label={copy.titleLabel}
              name="title"
              placeholder={copy.titlePlaceholder}
              required
            />
            <Input
              defaultValue={defaultDate}
              id="manual-date"
              label={copy.dateLabel}
              name="date"
              required
              type="date"
            />
            <TimeFields copy={copy} prefix="manual" />
          </div>
        ) : null}

        {mode === "weekly" ? (
          <div className="space-y-4">
            <p className="text-sm font-semibold text-foreground">{copy.weeklyTitle}</p>
            <Input
              id="weekly-title"
              label={copy.titleLabel}
              name="title"
              placeholder={copy.titlePlaceholder}
              required
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                defaultValue={defaultDate}
                id="weekly-start-date"
                label={copy.startDateLabel}
                name="startDate"
                required
                type="date"
              />
              <Input
                defaultValue={defaultEndDate}
                id="weekly-end-date"
                label={copy.endDateLabel}
                name="endDate"
                required
                type="date"
              />
            </div>
            <WeekdayPicker
              defaultWeekday={defaultWeekday}
              labels={copy.weekdays}
              legend={copy.weekdaysLabel}
              language={language}
            />
            <TimeFields copy={copy} prefix="weekly" />
          </div>
        ) : null}

        <FormSubmitButton label={copy.submit} pendingLabel={copy.pending} />
      </form>
    </Card>
  );
}

function ModeButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={cn(
        "min-h-11 rounded-[18px] px-2 text-sm font-semibold transition",
        active
          ? "bg-card-strong text-foreground shadow-[0_14px_30px_-24px_rgba(8,20,39,0.46)]"
          : "text-muted hover:bg-card hover:text-foreground",
      )}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function TimeFields({ copy, prefix }: { copy: AvailabilityCopy; prefix: string }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Input
        defaultValue="18:00"
        id={`${prefix}-start-time`}
        label={copy.startLabel}
        name="startTime"
        required
        type="time"
      />
      <Input
        defaultValue="19:00"
        id={`${prefix}-end-time`}
        label={copy.endLabel}
        name="endTime"
        required
        type="time"
      />
    </div>
  );
}

function WeekdayPicker({
  defaultWeekday,
  labels,
  legend,
  language,
}: {
  defaultWeekday: string;
  labels: string[];
  legend: string;
  language: Language;
}) {
  const dayOrder = language === "en" ? [0, 1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6, 0];

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold text-foreground">{legend}</legend>
      <div className="grid grid-cols-7 gap-1">
        {dayOrder.map((day) => (
          <label
            className="relative flex h-11 cursor-pointer items-center justify-center rounded-[16px] border border-border/70 bg-card-muted text-sm font-semibold text-muted transition has-[:checked]:border-foreground/20 has-[:checked]:bg-foreground has-[:checked]:text-background"
            key={day}
          >
            <input
              className="sr-only"
              defaultChecked={String(day) === defaultWeekday}
              name="weekdays"
              type="checkbox"
              value={day}
            />
            {labels[day]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
