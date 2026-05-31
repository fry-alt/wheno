import { describe, it, expect } from "vitest";
import { calculateMeetingOptions } from "./scheduler";
import type { SchedulerBusyBlock, SchedulerMember } from "./types";

const TZ = "Europe/London";

function makeMembers(ids: string[]): SchedulerMember[] {
  return ids.map((userId) => ({ userId }));
}

function makeBusyBlock(
  id: string,
  userId: string,
  startAt: string,
  endAt: string,
): SchedulerBusyBlock {
  return { id, userId, title: "busy", startAt, endAt };
}

// Helpers that build UTC ISO strings for a given date+time in Europe/London.
// Europe/London is UTC+0 in winter and UTC+1 in summer (BST).
// Using a January date (UTC+0) keeps the arithmetic simple.
function utc(date: string, time: string) {
  return new Date(`${date}T${time}:00Z`).toISOString();
}

describe("calculateMeetingOptions", () => {
  const dateFrom = "2025-01-06"; // Monday
  const dateTo = "2025-01-06";

  it("returns up to 5 options when everyone is free", () => {
    const members = makeMembers(["a", "b"]);
    const result = calculateMeetingOptions({
      members,
      busyBlocks: [],
      dateFrom,
      dateTo,
      durationMinutes: 60,
      preferredTime: "any",
      minParticipants: 2,
      timezone: TZ,
    });

    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBeLessThanOrEqual(5);

    for (const option of result) {
      expect(option.freeUserIds).toContain("a");
      expect(option.freeUserIds).toContain("b");
      expect(option.busyUserIds).toHaveLength(0);
    }
  });

  it("marks a busy member correctly when their block fully overlaps the slot", () => {
    const members = makeMembers(["a", "b"]);
    // Member "a" is busy the entire morning on 2025-01-06 in UTC (=London in Jan)
    const busyBlocks: SchedulerBusyBlock[] = [
      makeBusyBlock("bb1", "a", utc("2025-01-06", "08:00"), utc("2025-01-06", "14:00")),
    ];

    const result = calculateMeetingOptions({
      members,
      busyBlocks,
      dateFrom,
      dateTo,
      durationMinutes: 60,
      preferredTime: "morning",
      minParticipants: 1,
      timezone: TZ,
    });

    for (const option of result) {
      const slotHour = new Date(option.startAt).getUTCHours();
      if (slotHour >= 8 && slotHour < 13) {
        expect(option.busyUserIds).toContain("a");
        expect(option.freeUserIds).not.toContain("a");
      }
    }
  });

  it("excludes slots where free members < minParticipants", () => {
    const members = makeMembers(["a", "b"]);
    // Block "a" the whole day so only "b" is ever free
    const busyBlocks: SchedulerBusyBlock[] = [
      makeBusyBlock("bb1", "a", utc("2025-01-06", "00:00"), utc("2025-01-07", "00:00")),
    ];

    const resultNeedTwo = calculateMeetingOptions({
      members,
      busyBlocks,
      dateFrom,
      dateTo,
      durationMinutes: 60,
      preferredTime: "any",
      minParticipants: 2,
      timezone: TZ,
    });
    expect(resultNeedTwo).toHaveLength(0);

    const resultNeedOne = calculateMeetingOptions({
      members,
      busyBlocks,
      dateFrom,
      dateTo,
      durationMinutes: 60,
      preferredTime: "any",
      minParticipants: 1,
      timezone: TZ,
    });
    expect(resultNeedOne.length).toBeGreaterThan(0);
    for (const option of resultNeedOne) {
      expect(option.freeUserIds).toContain("b");
      expect(option.freeUserIds).not.toContain("a");
    }
  });

  it("handles a partial overlap correctly — slot touching busy block boundary", () => {
    const members = makeMembers(["a"]);
    // Busy 10:00–11:00 UTC. Slot 10:30–11:30 overlaps (starts before busy end).
    const busyBlocks: SchedulerBusyBlock[] = [
      makeBusyBlock("bb1", "a", utc("2025-01-06", "10:00"), utc("2025-01-06", "11:00")),
    ];

    const result = calculateMeetingOptions({
      members,
      busyBlocks,
      dateFrom,
      dateTo,
      durationMinutes: 60,
      preferredTime: "any",
      minParticipants: 1,
      timezone: TZ,
    });

    const overlappingSlot = result.find((o) => {
      const start = new Date(o.startAt).getUTCHours() * 60 + new Date(o.startAt).getUTCMinutes();
      const end = new Date(o.endAt).getUTCHours() * 60 + new Date(o.endAt).getUTCMinutes();
      return start < 11 * 60 && end > 10 * 60;
    });

    // Any slot that overlaps 10:00–11:00 should have "a" as busy
    if (overlappingSlot) {
      expect(overlappingSlot.busyUserIds).toContain("a");
    }

    // A slot entirely after 11:00 should have "a" as free
    const clearSlot = result.find((o) => new Date(o.startAt).getUTCHours() >= 11);
    if (clearSlot) {
      expect(clearSlot.freeUserIds).toContain("a");
    }
  });

  it("scores morning slots higher with preferredTime=morning than with preferredTime=evening", () => {
    const members = makeMembers(["a"]);

    const morningResult = calculateMeetingOptions({
      members,
      busyBlocks: [],
      dateFrom,
      dateTo,
      durationMinutes: 60,
      preferredTime: "morning",
      minParticipants: 1,
      timezone: TZ,
    });

    const eveningResult = calculateMeetingOptions({
      members,
      busyBlocks: [],
      dateFrom,
      dateTo,
      durationMinutes: 60,
      preferredTime: "evening",
      minParticipants: 1,
      timezone: TZ,
    });

    const topMorningHour = new Date(morningResult[0].startAt).getUTCHours();
    const topEveningHour = new Date(eveningResult[0].startAt).getUTCHours();

    expect(topMorningHour).toBeLessThan(12);
    expect(topEveningHour).toBeGreaterThanOrEqual(17);
  });

  it("returns slots in UTC but window boundaries respect the requested timezone", () => {
    // Europe/Amsterdam in winter is UTC+1. Window 08:00–10:00 Amsterdam = 07:00–09:00 UTC.
    const members = makeMembers(["a"]);
    const result = calculateMeetingOptions({
      members,
      busyBlocks: [],
      dateFrom,
      dateTo,
      durationMinutes: 60,
      preferredTime: "morning",
      minParticipants: 1,
      timezone: "Europe/Amsterdam",
    });

    // The earliest possible slot start should be 07:00 UTC (08:00 Amsterdam)
    const earliestUtcHour = Math.min(
      ...result.map((o) => new Date(o.startAt).getUTCHours()),
    );
    expect(earliestUtcHour).toBe(7);
  });

  it("returns empty when no single slot fits the duration inside the window", () => {
    const members = makeMembers(["a"]);
    // Morning window is 08:00–12:00 (4 h). A 5-hour meeting cannot fit.
    const result = calculateMeetingOptions({
      members,
      busyBlocks: [],
      dateFrom,
      dateTo,
      durationMinutes: 300,
      preferredTime: "morning",
      minParticipants: 1,
      timezone: TZ,
    });

    expect(result).toHaveLength(0);
  });

  it("results are sorted by score descending, then by start time ascending on ties", () => {
    const members = makeMembers(["a", "b", "c"]);

    const result = calculateMeetingOptions({
      members,
      busyBlocks: [],
      dateFrom,
      dateTo,
      durationMinutes: 60,
      preferredTime: "any",
      minParticipants: 1,
      timezone: TZ,
    });

    for (let i = 1; i < result.length; i++) {
      const prev = result[i - 1];
      const curr = result[i];
      if (prev.score === curr.score) {
        expect(prev.startAt <= curr.startAt).toBe(true);
      } else {
        expect(prev.score).toBeGreaterThanOrEqual(curr.score);
      }
    }
  });
});
