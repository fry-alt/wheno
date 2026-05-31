import { describe, it, expect } from "vitest";

describe("transcribeVoice", () => {
  it("is exported from openai.ts", async () => {
    const mod = await import("./openai");
    expect(typeof mod.transcribeVoice).toBe("function");
  });
});
