import { addDays, differenceInMinutes, format, parseISO, startOfDay } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

import { Card } from "@/components/ui/card";
import { formatSlotDateTime } from "@/lib/datetime";
import type { Language } from "@/lib/preferences-shared";
import type { BusyBlockSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

const DAY_START_HOUR = 8;
const DAY_END_HOUR = 22;
const HOUR_COUNT = DAY_END_HOUR - DAY_START_HOUR;
const ROW_HEIGHT_REM = 3.25;

type CalendarCopy = {
  upcomingTitle: string;
  weekTitle: string;
  emptyTitle: string;
  emptyDescription: string;
  hoursLabel: string;
  freeDay: string;
};

type PositionedBlock = BusyBlockSummary & {
  dayIndex: number;
  gridRowStart: number;
  gridRowSpan: number;
  startsBeforeWindow: boolean;
  endsAfterWindow: boolean;
};

export function PersonalCalendar({
  blocks,
  copy,
  language,
  timezone,
  weekStart,
}: {
  blocks: BusyBlockSummary[];
  copy: CalendarCopy;
  language: Language;
  timezone: string;
  weekStart: string;
}) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(parseISO(weekStart), index);
    const key = format(date, "yyyy-MM-dd");

    return {
      key,
      label: formatInTimeZone(
        fromZonedTime(`${key}T12:00:00`, timezone),
        timezone,
        language === "ru" ? "EEE" : "EEE",
      ),
      dayNumber: formatInTimeZone(
        fromZonedTime(`${key}T12:00:00`, timezone),
        timezone,
        "d",
      ),
    };
  });
  const positionedBlocks = blocks
    .map((block) => positionBlock(block, weekStart, timezone))
    .filter((block): block is PositionedBlock => Boolean(block));
  const blocksByDay = new Map<string, BusyBlockSummary[]>();

  for (const block of blocks) {
    const dayKey = formatInTimeZone(block.start_at, timezone, "yyyy-MM-dd");
    const dayBlocks = blocksByDay.get(dayKey) ?? [];

    dayBlocks.push(block);
    blocksByDay.set(dayKey, dayBlocks);
  }

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden p-0">
        <div className="border-b border-border/70 px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-foreground">{copy.weekTitle}</h2>
            <span className="rounded-full bg-card-muted px-3 py-1 text-xs font-semibold text-muted ring-1 ring-border/70">
              {HOUR_COUNT} {copy.hoursLabel}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[42rem]">
            <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] border-b border-border/70 bg-card-muted/70">
              <div className="px-3 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                {copy.hoursLabel}
              </div>
              {days.map((day) => (
                <div
                  className="border-l border-border/60 px-3 py-3 text-center"
                  key={day.key}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                    {day.label}
                  </p>
                  <p className="mt-1 text-xl font-semibold text-foreground">{day.dayNumber}</p>
                </div>
              ))}
            </div>

            <div
              className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]"
              style={{ minHeight: `${HOUR_COUNT * ROW_HEIGHT_REM}rem` }}
            >
              <div className="grid" style={{ gridTemplateRows: `repeat(${HOUR_COUNT}, 1fr)` }}>
                {Array.from({ length: HOUR_COUNT }, (_, index) => (
                  <div
                    className="border-b border-border/50 px-3 pt-2 text-xs font-medium text-muted"
                    key={index}
                  >
                    {String(DAY_START_HOUR + index).padStart(2, "0")}:00
                  </div>
                ))}
              </div>

              {days.map((day, dayIndex) => {
                const dayBlocks = positionedBlocks.filter((block) => block.dayIndex === dayIndex);

                return (
                  <div
                    className="relative grid border-l border-border/60 bg-card"
                    key={day.key}
                    style={{ gridTemplateRows: `repeat(${HOUR_COUNT * 2}, minmax(0, 1fr))` }}
                  >
                    {Array.from({ length: HOUR_COUNT }, (_, index) => (
                      <div
                        className="border-b border-border/50"
                        key={index}
                        style={{ gridRow: `${index * 2 + 1} / span 2` }}
                      />
                    ))}
                    {dayBlocks.length ? (
                      dayBlocks.map((block, blockIndex) => (
                        <CalendarBlock
                          block={block}
                          blockIndex={blockIndex}
                          key={block.id}
                          language={language}
                          timezone={timezone}
                        />
                      ))
                    ) : (
                      <div className="pointer-events-none absolute inset-x-2 top-3 rounded-[16px] border border-dashed border-border/70 px-2 py-2 text-center text-xs font-medium text-muted">
                        {copy.freeDay}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-foreground">{copy.upcomingTitle}</h2>
          <span className="text-sm text-muted">{blocks.length}</span>
        </div>

        {blocks.length ? (
          <div className="mt-4 space-y-3">
            {blocks.slice(0, 8).map((block) => {
              const slot = formatSlotDateTime(block.start_at, block.end_at, timezone, language);

              return (
                <div
                  className="rounded-[22px] border border-border/60 bg-card-muted px-4 py-3"
                  key={block.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-foreground">{block.title}</p>
                      <p className="mt-1 text-sm text-muted">{slot.date}</p>
                    </div>
                    <span className="rounded-full bg-card px-3 py-1 text-xs font-semibold text-muted ring-1 ring-border/70">
                      {slot.time}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-4 rounded-[24px] border border-dashed border-border/70 bg-card-muted px-4 py-6 text-center">
            <h3 className="font-semibold text-foreground">{copy.emptyTitle}</h3>
            <p className="mt-2 text-sm leading-6 text-muted">{copy.emptyDescription}</p>
          </div>
        )}
      </Card>
    </div>
  );
}

function CalendarBlock({
  block,
  blockIndex,
  language,
  timezone,
}: {
  block: PositionedBlock;
  blockIndex: number;
  language: Language;
  timezone: string;
}) {
  const slot = formatSlotDateTime(block.start_at, block.end_at, timezone, language);

  return (
    <div
      className={cn(
        "z-10 mx-1 overflow-hidden rounded-[16px] border px-2 py-2 text-xs shadow-[0_16px_30px_-24px_rgba(8,20,39,0.46)]",
        blockIndex % 3 === 0 &&
          "border-blue-500/30 bg-blue-500/12 text-blue-950 dark:text-blue-100",
        blockIndex % 3 === 1 &&
          "border-emerald-500/30 bg-emerald-500/12 text-emerald-950 dark:text-emerald-100",
        blockIndex % 3 === 2 &&
          "border-rose-500/30 bg-rose-500/12 text-rose-950 dark:text-rose-100",
      )}
      style={{
        gridRow: `${block.gridRowStart} / span ${block.gridRowSpan}`,
      }}
    >
      <p className="truncate font-semibold">{block.title}</p>
      <p className="mt-1 truncate opacity-75">
        {block.startsBeforeWindow ? "..." : ""}
        {slot.time}
        {block.endsAfterWindow ? "..." : ""}
      </p>
    </div>
  );
}

function positionBlock(
  block: BusyBlockSummary,
  weekStart: string,
  timezone: string,
): PositionedBlock | null {
  const startDay = startOfDay(parseISO(weekStart));
  const blockDay = startOfDay(parseISO(formatInTimeZone(block.start_at, timezone, "yyyy-MM-dd")));
  const dayIndex = differenceInMinutes(blockDay, startDay) / (24 * 60);

  if (dayIndex < 0 || dayIndex > 6) {
    return null;
  }

  const localStart = formatInTimeZone(block.start_at, timezone, "HH:mm");
  const localEnd = formatInTimeZone(block.end_at, timezone, "HH:mm");
  const startMinutes = toMinutes(localStart);
  const endMinutes = toMinutes(localEnd);
  const windowStart = DAY_START_HOUR * 60;
  const windowEnd = DAY_END_HOUR * 60;
  const clampedStart = Math.max(startMinutes, windowStart);
  const clampedEnd = Math.min(endMinutes, windowEnd);

  if (clampedEnd <= windowStart || clampedStart >= windowEnd) {
    return null;
  }

  return {
    ...block,
    dayIndex,
    gridRowStart: Math.floor((clampedStart - windowStart) / 30) + 1,
    gridRowSpan: Math.max(1, Math.ceil((clampedEnd - clampedStart) / 30)),
    startsBeforeWindow: startMinutes < windowStart,
    endsAfterWindow: endMinutes > windowEnd,
  };
}

function toMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}
