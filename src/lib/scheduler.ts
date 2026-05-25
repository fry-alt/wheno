import { addMinutes, eachDayOfInterval, format, parseISO } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

import type {
  PreferredTime,
  ScheduledOption,
  SchedulerBusyBlock,
  SchedulerMember,
} from "@/lib/types";
import { normalizeTimezone } from "@/lib/telegram";

const CANDIDATE_WINDOWS: Record<PreferredTime, { start: string; end: string }> = {
  any: { start: "08:00", end: "22:00" },
  morning: { start: "08:00", end: "12:00" },
  afternoon: { start: "12:00", end: "17:00" },
  evening: { start: "17:00", end: "22:00" },
};

function getPreferredTimeBonus(
  startAt: Date,
  preferredTime: PreferredTime,
  timezone: string,
) {
  if (preferredTime === "any") {
    return 0;
  }

  const hour = Number(formatInTimeZone(startAt, timezone, "H"));

  const matches =
    (preferredTime === "morning" && hour >= 8 && hour < 12) ||
    (preferredTime === "afternoon" && hour >= 12 && hour < 17) ||
    (preferredTime === "evening" && hour >= 17 && hour < 22);

  return matches ? 5 : 0;
}

function getWeekendBonus(startAt: Date, timezone: string) {
  const dayIndex = Number(formatInTimeZone(startAt, timezone, "i"));
  return dayIndex >= 6 ? 3 : 0;
}

function getLatePenalty(startAt: Date, timezone: string) {
  const hour = Number(formatInTimeZone(startAt, timezone, "H"));
  return hour >= 21 ? 5 : 0;
}

export function calculateMeetingOptions({
  members,
  busyBlocks,
  dateFrom,
  dateTo,
  durationMinutes,
  preferredTime,
  minParticipants,
  timezone,
}: {
  members: SchedulerMember[];
  busyBlocks: SchedulerBusyBlock[];
  dateFrom: string;
  dateTo: string;
  durationMinutes: number;
  preferredTime: PreferredTime;
  minParticipants: number;
  timezone: string;
}) {
  const normalizedTimezone = normalizeTimezone(timezone);
  const days = eachDayOfInterval({
    start: parseISO(dateFrom),
    end: parseISO(dateTo),
  });
  const options: ScheduledOption[] = [];
  const window = CANDIDATE_WINDOWS[preferredTime];

  for (const day of days) {
    const dayKey = format(day, "yyyy-MM-dd");
    const windowStart = fromZonedTime(
      `${dayKey}T${window.start}:00`,
      normalizedTimezone,
    );
    const windowEnd = fromZonedTime(
      `${dayKey}T${window.end}:00`,
      normalizedTimezone,
    );

    for (
      let cursor = windowStart;
      addMinutes(cursor, durationMinutes).getTime() <= windowEnd.getTime();
      cursor = addMinutes(cursor, 30)
    ) {
      const candidateEnd = addMinutes(cursor, durationMinutes);
      const freeUserIds: string[] = [];
      const busyUserIds: string[] = [];

      for (const member of members) {
        const isBusy = busyBlocks.some((busyBlock) => {
          if (busyBlock.userId !== member.userId) {
            return false;
          }

          const busyStart = new Date(busyBlock.startAt);
          const busyEnd = new Date(busyBlock.endAt);

          return busyStart < candidateEnd && busyEnd > cursor;
        });

        if (isBusy) {
          busyUserIds.push(member.userId);
        } else {
          freeUserIds.push(member.userId);
        }
      }

      if (freeUserIds.length < minParticipants) {
        continue;
      }

      const score =
        freeUserIds.length * 10 +
        getPreferredTimeBonus(cursor, preferredTime, normalizedTimezone) +
        getWeekendBonus(cursor, normalizedTimezone) -
        getLatePenalty(cursor, normalizedTimezone) -
        busyUserIds.length * 2;

      options.push({
        startAt: cursor.toISOString(),
        endAt: candidateEnd.toISOString(),
        score,
        freeUserIds,
        busyUserIds,
      });
    }
  }

  return options
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.startAt.localeCompare(right.startAt);
    })
    .slice(0, 5);
}
