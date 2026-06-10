import { describe, it, expect } from "vitest";
import { normalizeVoicePlan } from "./voice-plan-normalize";
import type { EventContextItem } from "./voice-plan-types";

const tz = "Europe/Moscow";
const today = "2026-06-11";
const events: EventContextItem[] = [
  { id: "evt-oneoff", recurring: false, date: "2026-06-12", start: "19:00", title: "Ужин", category: "meal" },
  { id: "evt-series", recurring: true, date: "2026-06-15", start: "10:00", title: "Работа", category: "work" },
];
const ctx = { events, today, timezone: tz };

describe("normalizeVoicePlan", () => {
  it("returns [] for non-array input", () => {
    expect(normalizeVoicePlan(null, ctx)).toEqual([]);
    expect(normalizeVoicePlan({}, ctx)).toEqual([]);
  });

  it("create: defaults end to +1h and falls back category to 'other'", () => {
    const out = normalizeVoicePlan(
      [{ type: "create", title: "Зал", category: "bogus", starts_at: "2026-06-11T19:00:00+03:00", is_fixed: false }],
      ctx,
    );
    expect(out).toHaveLength(1);
    const a = out[0];
    if (a.type !== "create") throw new Error("expected create");
    expect(a.event.category).toBe("other");
    expect(new Date(a.event.ends_at).getTime() - new Date(a.event.starts_at).getTime()).toBe(3_600_000);
  });

  it("create: drops actions with no title or bad start", () => {
    expect(normalizeVoicePlan([{ type: "create", category: "gym", starts_at: "2026-06-11T19:00:00+03:00", is_fixed: false }], ctx)).toHaveLength(0);
    expect(normalizeVoicePlan([{ type: "create", title: "x", starts_at: "not-a-date", is_fixed: false }], ctx)).toHaveLength(0);
  });

  it("note: requires yyyy-MM-dd date and non-empty text", () => {
    expect(normalizeVoicePlan([{ type: "note", note_date: "2026-06-12", note_text: " подарок " }], ctx)).toEqual([
      { type: "note", date: "2026-06-12", text: "подарок" },
    ]);
    expect(normalizeVoicePlan([{ type: "note", note_date: "12.06", note_text: "x" }], ctx)).toHaveLength(0);
    expect(normalizeVoicePlan([{ type: "note", note_date: "2026-06-12", note_text: "  " }], ctx)).toHaveLength(0);
  });

  it("delete: drops when target_id not in context", () => {
    expect(normalizeVoicePlan([{ type: "delete", target_id: "missing" }], ctx)).toHaveLength(0);
  });

  it("delete one-off: scope all, no targetDate", () => {
    const out = normalizeVoicePlan([{ type: "delete", target_id: "evt-oneoff" }], ctx);
    expect(out[0]).toMatchObject({ type: "delete", targetId: "evt-oneoff", recurring: false, scope: "all", targetDate: null, targetTitle: "Ужин" });
  });

  it("delete recurring: defaults to scope 'one' with the occurrence date", () => {
    const out = normalizeVoicePlan([{ type: "delete", target_id: "evt-series", target_date: "2026-06-15" }], ctx);
    expect(out[0]).toMatchObject({ type: "delete", recurring: true, scope: "one", targetDate: "2026-06-15" });
  });

  it("delete recurring: scope 'all' when explicitly requested", () => {
    const out = normalizeVoicePlan([{ type: "delete", target_id: "evt-series", target_scope: "all" }], ctx);
    expect(out[0]).toMatchObject({ recurring: true, scope: "all", targetDate: null });
  });

  it("edit: carries new event state + target", () => {
    const out = normalizeVoicePlan(
      [{ type: "edit", target_id: "evt-oneoff", title: "Ужин", category: "meal", starts_at: "2026-06-12T20:00:00+03:00", ends_at: "2026-06-12T21:00:00+03:00", is_fixed: false }],
      ctx,
    );
    const a = out[0];
    if (a.type !== "edit") throw new Error("expected edit");
    expect(a.targetId).toBe("evt-oneoff");
    expect(a.event.starts_at).toBe(new Date("2026-06-12T20:00:00+03:00").toISOString());
  });

  it("drops unknown action types", () => {
    expect(normalizeVoicePlan([{ type: "nonsense" }], ctx)).toHaveLength(0);
  });
});
