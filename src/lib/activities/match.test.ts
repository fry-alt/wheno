import { describe, it, expect } from "vitest";
import { rankActivities } from "./match";
import type { ActivityCardData } from "./types";

const NOW = "2026-06-12T08:00:00Z";

function card(over: Partial<ActivityCardData> & { id: string; type?: string; starts_at?: string }): ActivityCardData {
  const starts_at = over.starts_at ?? "2026-06-13T10:00:00Z";
  return {
    activity: {
      id: over.id,
      host_id: "host-1",
      title: `Activity ${over.id}`,
      type: over.type ?? "running",
      description: null,
      place: over.activity?.place ?? null,
      starts_at,
      ends_at: "2026-06-13T11:00:00Z",
      capacity: over.activity?.capacity ?? 6,
      visibility: "public",
      status: over.activity?.status ?? "open",
    },
    hostName: "Host",
    hostPhoto: null,
    count: over.count ?? 2,
    isHost: over.isHost ?? false,
    isParticipant: over.isParticipant ?? false,
    isFree: over.isFree ?? true,
  };
}

describe("rankActivities — eligibility", () => {
  it("drops busy / host / joined / full / past / cancelled candidates", () => {
    const feed: ActivityCardData[] = [
      card({ id: "ok" }),
      card({ id: "busy", isFree: false }),
      card({ id: "host", isHost: true }),
      card({ id: "joined", isParticipant: true }),
      card({ id: "full", count: 6 }),
      card({ id: "past", starts_at: "2026-06-11T10:00:00Z" }),
      card({ id: "cancelled", activity: { status: "cancelled" } as never }),
    ];
    const out = rankActivities(["running"], feed, NOW);
    expect(out.map((m) => m.data.activity.id)).toEqual(["ok"]);
  });

  it("empty feed → empty result", () => {
    expect(rankActivities(["running"], [], NOW)).toEqual([]);
  });
});

describe("rankActivities — scoring & order", () => {
  it("interest match outranks a sooner non-matching activity", () => {
    const feed = [
      card({ id: "soon-nomatch", type: "chess", starts_at: "2026-06-12T10:00:00Z" }),
      card({ id: "match", type: "running", starts_at: "2026-06-15T10:00:00Z" }),
    ];
    const out = rankActivities(["running"], feed, NOW);
    expect(out[0].data.activity.id).toBe("match");
  });

  it("among interest matches, sooner ranks higher", () => {
    const feed = [
      card({ id: "later", type: "running", starts_at: "2026-06-16T10:00:00Z" }),
      card({ id: "sooner", type: "running", starts_at: "2026-06-13T10:00:00Z" }),
    ];
    const out = rankActivities(["running"], feed, NOW);
    expect(out.map((m) => m.data.activity.id)).toEqual(["sooner", "later"]);
  });

  it("respects the limit", () => {
    const feed = Array.from({ length: 8 }, (_, i) =>
      card({ id: `a${i}`, starts_at: `2026-06-1${3 + (i % 5)}T10:00:00Z` }),
    );
    expect(rankActivities(["running"], feed, NOW, { limit: 3 })).toHaveLength(3);
  });
});

describe("rankActivities — reasons", () => {
  it("interest match yields a 🎯 chip with the interest label", () => {
    const out = rankActivities(["running"], [card({ id: "x", type: "running" })], NOW);
    expect(out[0].reasons[0]).toContain("🎯");
    expect(out[0].reasons[0]).toContain("Бег");
  });

  it("non-matching activity has no 🎯 chip but still has free + time chips", () => {
    const out = rankActivities([], [card({ id: "x", type: "running" })], NOW);
    expect(out[0].reasons.some((r) => r.includes("🎯"))).toBe(false);
    expect(out[0].reasons.some((r) => r.includes("🟢"))).toBe(true);
    expect(out[0].reasons.some((r) => r.includes("⏱"))).toBe(true);
  });

  it("relative time chip reads сегодня / завтра", () => {
    const today = rankActivities([], [card({ id: "t", starts_at: "2026-06-12T20:00:00Z" })], NOW, { timezone: "UTC" });
    const tomorrow = rankActivities([], [card({ id: "m", starts_at: "2026-06-13T10:00:00Z" })], NOW, { timezone: "UTC" });
    expect(today[0].reasons.find((r) => r.includes("⏱"))).toContain("сегодня");
    expect(tomorrow[0].reasons.find((r) => r.includes("⏱"))).toContain("завтра");
  });

  it("place present yields a 📍 chip", () => {
    const out = rankActivities([], [card({ id: "p", activity: { place: "Парк Горького" } as never })], NOW);
    expect(out[0].reasons.some((r) => r.includes("📍") && r.includes("Парк Горького"))).toBe(true);
  });
});
