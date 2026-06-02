import { describe, it, expect } from "vitest";
import { findSlots } from "./find-slots";
import type { SlotRequest } from "./types";
import type { CalendarEvent } from "@/lib/events/types";

const TZ = "Europe/Moscow";
const HOURS = { start: "08:00", end: "22:00" };

function req(overrides: Partial<SlotRequest> = {}): SlotRequest {
  return {
    title: "Зал",
    category: "gym",
    count: 3,
    duration_min: 60,
    window: { from: "2026-06-01", to: "2026-06-07" }, // Mon..Sun
    part_of_day: "any",
    ...overrides,
  };
}

function ev(date: string, start: string, end: string): CalendarEvent {
  return {
    id: `${date}-${start}`,
    user_id: "u",
    title: "busy",
    starts_at: `${date}T${start}:00+03:00`,
    ends_at: `${date}T${end}:00+03:00`,
    category: "work",
    is_fixed: true,
    notes: null,
    location: null,
    created_at: "",
    updated_at: "",
  };
}

describe("findSlots", () => {
  it("distributes count=3 evenly across a 7-day window (empty calendar)", () => {
    const slots = findSlots(req(), [], HOURS, TZ);
    expect(slots.map((s) => s.date)).toEqual(["2026-06-01", "2026-06-04", "2026-06-07"]);
    expect(slots[0].starts_at).toBe("2026-06-01T05:00:00.000Z"); // 08:00 MSK
    expect(slots[0].ends_at).toBe("2026-06-01T06:00:00.000Z");
  });

  it("pushes the start past a busy interval", () => {
    const slots = findSlots(req({ count: 1 }), [ev("2026-06-01", "08:00", "09:00")], HOURS, TZ);
    expect(slots[0].date).toBe("2026-06-01");
    expect(slots[0].starts_at).toBe("2026-06-01T06:00:00.000Z"); // 09:00 MSK
  });

  it("respects the morning window (before 12:00)", () => {
    const slots = findSlots(req({ count: 1, part_of_day: "morning" }), [], HOURS, TZ);
    expect(slots[0].starts_at).toBe("2026-06-01T05:00:00.000Z"); // 08:00 MSK
  });

  it("skips a fully-busy day and returns fewer than requested", () => {
    const busy = [ev("2026-06-02", "08:00", "22:00")];
    const slots = findSlots(req({ count: 7 }), busy, HOURS, TZ);
    expect(slots).toHaveLength(6);
    expect(slots.map((s) => s.date)).not.toContain("2026-06-02");
  });

  it("count=1 returns the first available day", () => {
    const slots = findSlots(req({ count: 1 }), [], HOURS, TZ);
    expect(slots).toHaveLength(1);
    expect(slots[0].date).toBe("2026-06-01");
  });

  it("returns nothing when the duration cannot fit the part-of-day window", () => {
    const slots = findSlots(req({ duration_min: 600, part_of_day: "morning" }), [], HOURS, TZ);
    expect(slots).toEqual([]);
  });
});
