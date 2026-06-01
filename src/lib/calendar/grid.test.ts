import { describe, it, expect } from "vitest";
import { parseISO } from "date-fns";
import { buildMonthGrid } from "./grid";

describe("buildMonthGrid", () => {
  it("June 2026 starts on Monday June 1 and the grid leads with it", () => {
    const grid = buildMonthGrid(parseISO("2026-06-01"));
    expect(grid[0].date.getDate()).toBe(1);
    expect(grid[0].inMonth).toBe(true);
  });

  it("produces full weeks (length divisible by 7)", () => {
    const grid = buildMonthGrid(parseISO("2026-06-01"));
    expect(grid.length % 7).toBe(0);
  });

  it("marks days outside the month as inMonth=false", () => {
    const grid = buildMonthGrid(parseISO("2026-02-01"));
    expect(grid[0].inMonth).toBe(false);
    expect(grid.some((d) => d.inMonth && d.date.getDate() === 28)).toBe(true);
  });
});
