import { describe, it, expect } from "vitest";
import { haversineKm, withinRadius } from "./geo";

describe("haversineKm", () => {
  it("is zero for the same point", () => {
    expect(haversineKm({ lat: 55.75, lng: 37.62 }, { lat: 55.75, lng: 37.62 })).toBe(0);
  });
  it("≈111 km per degree of latitude at the equator", () => {
    const d = haversineKm({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
    expect(d).toBeGreaterThan(110);
    expect(d).toBeLessThan(112);
  });
  it("is symmetric", () => {
    const a = { lat: 55.75, lng: 37.62 };
    const b = { lat: 59.94, lng: 30.31 };
    expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 6);
  });
});

describe("withinRadius", () => {
  const center = { lat: 55.75, lng: 37.62 };
  it("includes near points and excludes far ones", () => {
    expect(withinRadius(center, { lat: 55.76, lng: 37.63 }, 5)).toBe(true); // ~1.3 km
    expect(withinRadius(center, { lat: 59.94, lng: 30.31 }, 5)).toBe(false); // SPb, ~630 km
  });
});
