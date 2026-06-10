import { describe, it, expect } from "vitest";
import { parseISO } from "date-fns";
import { getViewRange, buildWeek } from "./views";

describe("getViewRange", () => {
  it("month → first..last of the anchor's month", () => {
    expect(getViewRange("month", "2026-06-15")).toEqual({ dateFrom: "2026-06-01", dateTo: "2026-06-30" });
  });
  it("week → Mon..Sun containing the anchor", () => {
    // 2026-06-11 is a Thursday; week is Mon 2026-06-08 .. Sun 2026-06-14
    expect(getViewRange("week", "2026-06-11")).toEqual({ dateFrom: "2026-06-08", dateTo: "2026-06-14" });
  });
  it("week spanning two months", () => {
    // 2026-07-01 is a Wednesday; week is Mon 2026-06-29 .. Sun 2026-07-05
    expect(getViewRange("week", "2026-07-01")).toEqual({ dateFrom: "2026-06-29", dateTo: "2026-07-05" });
  });
  it("week spanning two years", () => {
    // 2026-12-31 is a Thursday; week is Mon 2026-12-28 .. Sun 2027-01-03
    expect(getViewRange("week", "2026-12-31")).toEqual({ dateFrom: "2026-12-28", dateTo: "2027-01-03" });
  });
  it("year → null (no events fetched)", () => {
    expect(getViewRange("year", "2026-06-11")).toBeNull();
  });
});

describe("buildWeek", () => {
  it("returns 7 days Mon..Sun", () => {
    const days = buildWeek(parseISO("2026-06-11"));
    expect(days).toHaveLength(7);
    expect(days[0].getDay()).toBe(1); // Monday
    expect(days[6].getDay()).toBe(0); // Sunday
    expect(days[0].getDate()).toBe(8);
    expect(days[6].getDate()).toBe(14);
  });
});
