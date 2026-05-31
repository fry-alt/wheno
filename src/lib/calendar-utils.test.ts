import { describe, it, expect } from "vitest";
import { computeWeekStats, filterEventsByTab, getActivityEmoji } from "./calendar-utils";
import type { CalendarEvent } from "./types";

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "1", user_id: "u1", title: "Test", activity_type: null,
    starts_at: "2026-06-01T10:00:00Z", ends_at: "2026-06-01T11:00:00Z",
    location: null, energy_after: null, dress_code: null,
    is_flexible: true, notes: null, source: "ai", created_at: "2026-06-01T00:00:00Z",
    ...overrides,
  };
}

describe("computeWeekStats", () => {
  it("counts sport events", () => {
    const events = [makeEvent({ activity_type: "gym" }), makeEvent({ activity_type: "run" })];
    expect(computeWeekStats(events).sport).toBe(2);
  });
  it("counts social events", () => {
    const events = [makeEvent({ activity_type: "dinner" }), makeEvent({ activity_type: "coffee" })];
    expect(computeWeekStats(events).social).toBe(2);
  });
  it("counts work events", () => {
    expect(computeWeekStats([makeEvent({ activity_type: "meeting" })]).work).toBe(1);
  });
  it("ignores unknown activity_type", () => {
    const s = computeWeekStats([makeEvent({ activity_type: "other" })]);
    expect(s.sport + s.social + s.work).toBe(0);
  });
});

describe("filterEventsByTab", () => {
  const events = [
    makeEvent({ activity_type: "gym" }),
    makeEvent({ activity_type: "dinner" }),
    makeEvent({ activity_type: "meeting" }),
    makeEvent({ activity_type: "other" }),
  ];
  it("returns all for 'all'", () => expect(filterEventsByTab(events, "all")).toHaveLength(4));
  it("filters sport", () => expect(filterEventsByTab(events, "sport")).toHaveLength(1));
  it("filters social", () => expect(filterEventsByTab(events, "social")).toHaveLength(1));
  it("filters work", () => expect(filterEventsByTab(events, "work")).toHaveLength(1));
});

describe("getActivityEmoji", () => {
  it("returns emoji for known types", () => {
    expect(getActivityEmoji("gym")).toBe("🏋️");
    expect(getActivityEmoji("dinner")).toBe("🍽️");
    expect(getActivityEmoji("meeting")).toBe("💼");
  });
  it("returns default for unknown", () => {
    expect(getActivityEmoji(null)).toBe("📌");
  });
});
