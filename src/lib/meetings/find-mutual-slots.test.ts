import { describe, it, expect } from "vitest";
import { intersectDayHours } from "./find-mutual-slots";

describe("intersectDayHours", () => {
  it("returns the overlapping window of two day-hour ranges", () => {
    expect(intersectDayHours("08:00", "22:00", "09:00", "18:00")).toEqual({
      start: "09:00",
      end: "18:00",
    });
  });

  it("clamps to the tighter bound on each side", () => {
    expect(intersectDayHours("07:00", "20:00", "10:00", "23:00")).toEqual({
      start: "10:00",
      end: "20:00",
    });
  });

  it("returns null when the windows do not overlap", () => {
    expect(intersectDayHours("08:00", "12:00", "13:00", "18:00")).toBeNull();
  });
});
