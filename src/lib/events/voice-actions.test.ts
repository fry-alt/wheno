import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ requireCurrentUser: vi.fn(async () => ({ id: "u1" })) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const q = vi.hoisted(() => ({
  insertEvent: vi.fn(async () => "new-id"),
  updateEventById: vi.fn(async () => {}),
  updateSeries: vi.fn(async () => {}),
  deleteEventById: vi.fn(async () => {}),
  addExcludedDate: vi.fn(async () => {}),
}));
vi.mock("@/lib/events/queries", () => q);
const { insertNote } = vi.hoisted(() => ({ insertNote: vi.fn(async () => {}) }));
vi.mock("@/lib/notes/queries", () => ({ insertNote }));

import { applyVoicePlanAction } from "./voice-actions";
import type { VoiceAction } from "./voice-plan-types";

const ev = {
  title: "X",
  category: "gym" as const,
  starts_at: "2026-06-11T16:00:00.000Z",
  ends_at: "2026-06-11T17:00:00.000Z",
  is_fixed: false,
  notes: null,
  recurrence: null,
};

beforeEach(() => vi.clearAllMocks());

describe("applyVoicePlanAction", () => {
  it("create → insertEvent; note → insertNote", async () => {
    const res = await applyVoicePlanAction([
      { type: "create", event: ev },
      { type: "note", date: "2026-06-12", text: "подарок" },
    ] as VoiceAction[]);
    expect(q.insertEvent).toHaveBeenCalledTimes(1);
    expect(insertNote).toHaveBeenCalledWith({ user_id: "u1", content: "подарок", date: "2026-06-12" });
    expect(res).toEqual({ applied: 2, failed: 0 });
  });

  it("delete recurring one → addExcludedDate; delete one-off → deleteEventById", async () => {
    await applyVoicePlanAction([
      { type: "delete", targetId: "s1", recurring: true, scope: "one", targetDate: "2026-06-15", targetTitle: "Работа" },
      { type: "delete", targetId: "o1", recurring: false, scope: "all", targetDate: null, targetTitle: "Ужин" },
    ] as VoiceAction[]);
    expect(q.addExcludedDate).toHaveBeenCalledWith("u1", "s1", "2026-06-15");
    expect(q.deleteEventById).toHaveBeenCalledWith("u1", "o1");
  });

  it("edit recurring all → updateSeries; edit one-off → updateEventById", async () => {
    await applyVoicePlanAction([
      { type: "edit", targetId: "s1", recurring: true, scope: "all", targetDate: null, targetTitle: "Работа", event: ev },
      { type: "edit", targetId: "o1", recurring: false, scope: "all", targetDate: null, targetTitle: "Ужин", event: ev },
    ] as VoiceAction[]);
    expect(q.updateSeries).toHaveBeenCalledTimes(1);
    expect(q.updateEventById).toHaveBeenCalledTimes(1);
  });

  it("counts a failed action without aborting the batch", async () => {
    q.insertEvent.mockRejectedValueOnce(new Error("boom"));
    const res = await applyVoicePlanAction([
      { type: "create", event: ev },
      { type: "note", date: "2026-06-12", text: "ok" },
    ] as VoiceAction[]);
    expect(res).toEqual({ applied: 1, failed: 1 });
  });
});
