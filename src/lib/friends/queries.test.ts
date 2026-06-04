import { describe, it, expect } from "vitest";
import { generateInviteCode } from "./queries";

describe("generateInviteCode", () => {
  it("produces an 8-char code from the safe alphabet", () => {
    const code = generateInviteCode();
    expect(code).toHaveLength(8);
    expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/);
  });

  it("produces different codes on repeated calls", () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateInviteCode()));
    expect(codes.size).toBeGreaterThan(1);
  });
});
