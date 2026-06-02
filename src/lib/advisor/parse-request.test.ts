import { describe, it, expect, vi, beforeEach } from "vitest";

const createMock = vi.fn();
vi.mock("@/lib/openai", () => ({
  getOpenAI: () => ({ chat: { completions: { create: createMock } } }),
}));

import { parseRequest } from "./parse-request";

beforeEach(() => createMock.mockReset());

function toolResponse(args: Record<string, unknown>) {
  return {
    choices: [
      { message: { tool_calls: [{ function: { name: "plan_request", arguments: JSON.stringify(args) } }] } },
    ],
  };
}

describe("parseRequest", () => {
  it("maps a tool call into a SlotRequest", async () => {
    createMock.mockResolvedValue(
      toolResponse({
        title: "Зал",
        category: "gym",
        count: 3,
        duration_min: 60,
        window_from: "2026-06-01",
        window_to: "2026-06-07",
        part_of_day: "morning",
      }),
    );
    const r = await parseRequest("зал 3 раза утром на час", { today: "2026-06-01", timezone: "Europe/Moscow" });
    expect(r.title).toBe("Зал");
    expect(r.category).toBe("gym");
    expect(r.count).toBe(3);
    expect(r.duration_min).toBe(60);
    expect(r.window).toEqual({ from: "2026-06-01", to: "2026-06-07" });
    expect(r.part_of_day).toBe("morning");
  });

  it("clamps count and duration, falls back unknown category to other", async () => {
    createMock.mockResolvedValue(
      toolResponse({
        title: "X",
        category: "banana",
        count: 99,
        duration_min: 5,
        window_from: "2026-06-01",
        window_to: "2026-06-07",
        part_of_day: "weird",
      }),
    );
    const r = await parseRequest("x", { today: "2026-06-01", timezone: "Europe/Moscow" });
    expect(r.category).toBe("other");
    expect(r.count).toBe(14);
    expect(r.duration_min).toBe(15);
    expect(r.part_of_day).toBe("any");
  });

  it("throws when the model returns no tool call", async () => {
    createMock.mockResolvedValue({ choices: [{ message: { content: "?" } }] });
    await expect(parseRequest("x", { today: "2026-06-01", timezone: "Europe/Moscow" })).rejects.toThrow();
  });
});
