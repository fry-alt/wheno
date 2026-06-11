import { describe, it, expect } from "vitest";
import { isFull, isFreeDuring, canJoin, activityButtonState } from "./state";

describe("isFull", () => {
  it("null capacity is never full; otherwise count>=capacity", () => {
    expect(isFull(99, null)).toBe(false);
    expect(isFull(5, 6)).toBe(false);
    expect(isFull(6, 6)).toBe(true);
  });
});

describe("isFreeDuring", () => {
  const ev = [{ starts_at: "2026-06-12T10:00:00Z", ends_at: "2026-06-12T11:00:00Z" }];
  it("overlap → not free", () => {
    expect(isFreeDuring(ev, "2026-06-12T10:30:00Z", "2026-06-12T11:30:00Z")).toBe(false);
  });
  it("adjacent (touching) → free", () => {
    expect(isFreeDuring(ev, "2026-06-12T11:00:00Z", "2026-06-12T12:00:00Z")).toBe(true);
  });
  it("disjoint → free", () => {
    expect(isFreeDuring(ev, "2026-06-12T08:00:00Z", "2026-06-12T09:00:00Z")).toBe(true);
  });
});

const base = {
  isHost: false, isParticipant: false, count: 2, capacity: 6,
  status: "open" as const, startsAt: "2026-06-12T10:00:00Z", now: "2026-06-11T00:00:00Z", blocked: false,
};

describe("canJoin", () => {
  it("ok in the happy path", () => { expect(canJoin(base)).toEqual({ ok: true }); });
  it("blocks host/joined/full/past/cancelled/blocked with reasons", () => {
    expect(canJoin({ ...base, status: "cancelled" })).toEqual({ ok: false, reason: "cancelled" });
    expect(canJoin({ ...base, startsAt: "2026-06-10T10:00:00Z" })).toEqual({ ok: false, reason: "past" });
    expect(canJoin({ ...base, blocked: true })).toEqual({ ok: false, reason: "blocked" });
    expect(canJoin({ ...base, isHost: true })).toEqual({ ok: false, reason: "host" });
    expect(canJoin({ ...base, isParticipant: true })).toEqual({ ok: false, reason: "joined" });
    expect(canJoin({ ...base, count: 6 })).toEqual({ ok: false, reason: "full" });
  });
});

describe("activityButtonState", () => {
  const b = { isHost: false, isParticipant: false, count: 2, capacity: 6, status: "open" as const, startsAt: "2026-06-12T10:00:00Z", now: "2026-06-11T00:00:00Z" };
  it("derives the state", () => {
    expect(activityButtonState(b)).toBe("join");
    expect(activityButtonState({ ...b, status: "cancelled" })).toBe("cancelled");
    expect(activityButtonState({ ...b, isHost: true })).toBe("host");
    expect(activityButtonState({ ...b, isParticipant: true })).toBe("joined");
    expect(activityButtonState({ ...b, startsAt: "2026-06-10T10:00:00Z" })).toBe("past");
    expect(activityButtonState({ ...b, count: 6 })).toBe("full");
  });
});
