import { describe, it, expect, vi, beforeEach } from "vitest";

const createMock = vi.fn();

vi.mock("@/lib/openai", () => ({
  getOpenAI: () => ({ chat: { completions: { create: createMock } } }),
}));

import { parseEvent } from "./parse";

beforeEach(() => {
  createMock.mockReset();
});

function toolResponse(args: Record<string, unknown>) {
  return {
    choices: [
      {
        message: {
          tool_calls: [{ function: { name: "create_event", arguments: JSON.stringify(args) } }],
        },
      },
    ],
  };
}

describe("parseEvent", () => {
  it("maps a tool call into a ParsedEvent with UTC ISO times", async () => {
    createMock.mockResolvedValue(
      toolResponse({
        title: "Зал",
        category: "gym",
        starts_at: "2026-06-03T07:00:00+03:00",
        ends_at: "2026-06-03T08:00:00+03:00",
        is_fixed: false,
        notes: null,
      }),
    );

    const result = await parseEvent("завтра зал в 7", {
      today: "2026-06-02",
      timezone: "Europe/Moscow",
    });

    expect(result.title).toBe("Зал");
    expect(result.category).toBe("gym");
    expect(result.is_fixed).toBe(false);
    expect(result.starts_at).toBe("2026-06-03T04:00:00.000Z");
    expect(result.ends_at).toBe("2026-06-03T05:00:00.000Z");
  });

  it("falls back to 'other' for an unknown category", async () => {
    createMock.mockResolvedValue(
      toolResponse({
        title: "Что-то",
        category: "banana",
        starts_at: "2026-06-03T10:00:00+03:00",
        ends_at: "2026-06-03T11:00:00+03:00",
        is_fixed: false,
        notes: null,
      }),
    );

    const result = await parseEvent("что-то в 10", { today: "2026-06-02", timezone: "Europe/Moscow" });
    expect(result.category).toBe("other");
  });

  it("throws when the model returns no tool call", async () => {
    createMock.mockResolvedValue({ choices: [{ message: { content: "не понял" } }] });
    await expect(
      parseEvent("бла", { today: "2026-06-02", timezone: "Europe/Moscow" }),
    ).rejects.toThrow();
  });

  it("parses a daily recurrence", async () => {
    createMock.mockResolvedValue(
      toolResponse({
        title: "Работа", category: "work",
        starts_at: "2026-06-03T09:00:00+03:00", ends_at: "2026-06-03T18:00:00+03:00",
        is_fixed: true, notes: null, recur_freq: "daily",
      }),
    );
    const r = await parseEvent("работа каждый день с 9 до 18", { today: "2026-06-03", timezone: "Europe/Moscow" });
    expect(r.recurrence).toEqual({ freq: "daily", weekdays: null, until: null, count: null });
  });

  it("parses weekly weekdays", async () => {
    createMock.mockResolvedValue(
      toolResponse({
        title: "Зал", category: "gym",
        starts_at: "2026-06-01T18:00:00+03:00", ends_at: "2026-06-01T19:00:00+03:00",
        is_fixed: false, notes: null, recur_freq: "weekly", recur_weekdays: [1, 3, 5],
      }),
    );
    const r = await parseEvent("зал по пн ср пт", { today: "2026-06-01", timezone: "Europe/Moscow" });
    expect(r.recurrence).toEqual({ freq: "weekly", weekdays: [1, 3, 5], until: null, count: null });
  });

  it("leaves recurrence null when none is mentioned", async () => {
    createMock.mockResolvedValue(
      toolResponse({
        title: "Кофе", category: "coffee",
        starts_at: "2026-06-03T15:00:00+03:00", ends_at: "2026-06-03T16:00:00+03:00",
        is_fixed: false, notes: null,
      }),
    );
    const r = await parseEvent("кофе в 15", { today: "2026-06-03", timezone: "Europe/Moscow" });
    expect(r.recurrence).toBeNull();
  });
});
