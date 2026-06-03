import { describe, it, expect } from "vitest";
import { expandEvents } from "./recurrence";
import type { CalendarEvent, Recurrence } from "./types";

const TZ = "Europe/Moscow"; // UTC+3, no DST in these dates

function row(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "s1",
    user_id: "u",
    title: "Зал",
    starts_at: "2026-06-01T09:00:00+03:00",
    ends_at: "2026-06-01T10:00:00+03:00",
    category: "gym",
    is_fixed: false,
    notes: null,
    location: null,
    recurrence: null,
    excluded_dates: [],
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

const R = (r: Partial<Recurrence>): Recurrence => ({ freq: "daily", weekdays: null, until: null, count: null, ...r });
const RANGE = [new Date("2026-06-01T00:00:00Z"), new Date("2026-06-08T00:00:00Z")] as const;

describe("expandEvents", () => {
  it("passes a one-off event through with null series_id", () => {
    const out = expandEvents([row()], RANGE[0], RANGE[1], TZ);
    expect(out).toHaveLength(1);
    expect(out[0].series_id).toBeNull();
    expect(out[0].occurrence_date).toBeNull();
    expect(out[0].starts_at).toBe("2026-06-01T06:00:00.000Z");
  });

  it("daily expands to one instance per day in range", () => {
    const out = expandEvents([row({ recurrence: R({ freq: "daily" }) })], RANGE[0], RANGE[1], TZ);
    expect(out.map((o) => o.occurrence_date)).toEqual([
      "2026-06-01", "2026-06-02", "2026-06-03", "2026-06-04", "2026-06-05", "2026-06-06", "2026-06-07",
    ]);
    expect(out[0].series_id).toBe("s1");
    expect(out[0].starts_at).toBe("2026-06-01T06:00:00.000Z");
  });

  it("weekly honours selected weekdays (Mon/Wed/Fri)", () => {
    const out = expandEvents([row({ recurrence: R({ freq: "weekly", weekdays: [1, 3, 5] }) })], RANGE[0], RANGE[1], TZ);
    expect(out.map((o) => o.occurrence_date)).toEqual(["2026-06-01", "2026-06-03", "2026-06-05"]);
  });

  it("monthly keeps the day-of-month and skips months without it", () => {
    const out = expandEvents(
      [row({ starts_at: "2026-01-31T09:00:00+03:00", ends_at: "2026-01-31T10:00:00+03:00", recurrence: R({ freq: "monthly" }) })],
      new Date("2026-01-01T00:00:00Z"),
      new Date("2026-05-01T00:00:00Z"),
      TZ,
    );
    expect(out.map((o) => o.occurrence_date)).toEqual(["2026-01-31", "2026-03-31"]);
  });

  it("yearly birthday recurs once per year", () => {
    const out = expandEvents(
      [row({ title: "ДР", starts_at: "2024-03-15T09:00:00+03:00", ends_at: "2024-03-15T10:00:00+03:00", recurrence: R({ freq: "yearly" }) })],
      new Date("2026-01-01T00:00:00Z"),
      new Date("2027-01-01T00:00:00Z"),
      TZ,
    );
    expect(out.map((o) => o.occurrence_date)).toEqual(["2026-03-15"]);
  });

  it("respects until (inclusive)", () => {
    const out = expandEvents([row({ recurrence: R({ freq: "daily", until: "2026-06-03" }) })], RANGE[0], RANGE[1], TZ);
    expect(out.map((o) => o.occurrence_date)).toEqual(["2026-06-01", "2026-06-02", "2026-06-03"]);
  });

  it("respects count measured from the anchor", () => {
    const out = expandEvents([row({ recurrence: R({ freq: "daily", count: 2 }) })], RANGE[0], RANGE[1], TZ);
    expect(out.map((o) => o.occurrence_date)).toEqual(["2026-06-01", "2026-06-02"]);
  });

  it("skips excluded_dates", () => {
    const out = expandEvents([row({ excluded_dates: ["2026-06-02"], recurrence: R({ freq: "daily", count: 3 }) })], RANGE[0], RANGE[1], TZ);
    expect(out.map((o) => o.occurrence_date)).toEqual(["2026-06-01", "2026-06-03"]);
  });
});
