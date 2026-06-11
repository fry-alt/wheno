import { describe, it, expect } from "vitest";
import { INTEREST_TAGS, isInterestSlug, interestLabel, normalizeInterests } from "./interests";

describe("interest tags", () => {
  it("every tag has slug/emoji/label and slugs are unique", () => {
    const slugs = new Set<string>();
    for (const t of INTEREST_TAGS) {
      expect(t.slug).toMatch(/^[a-z]+$/);
      expect(t.emoji).toBeTruthy();
      expect(t.label).toBeTruthy();
      expect(slugs.has(t.slug), `dup ${t.slug}`).toBe(false);
      slugs.add(t.slug);
    }
  });

  it("isInterestSlug recognises curated slugs only", () => {
    expect(isInterestSlug("tennis")).toBe(true);
    expect(isInterestSlug("nonsense")).toBe(false);
  });

  it("interestLabel renders curated as emoji+label, custom as raw", () => {
    expect(interestLabel("tennis")).toBe("🎾 Теннис");
    expect(interestLabel("вязание")).toBe("вязание");
  });

  it("normalizeInterests keeps slugs, trims custom, dedupes, caps at 12, drops empties", () => {
    expect(normalizeInterests(["tennis", "tennis", " coffee ", "  ", "вязание"]))
      .toEqual(["tennis", "coffee", "вязание"]);
    expect(normalizeInterests("nope")).toEqual([]);
    expect(normalizeInterests(Array.from({ length: 20 }, (_, i) => `c${i}`))).toHaveLength(12);
  });
});
