import { describe, it, expect } from "vitest";
import { CATEGORIES, CATEGORY_EMOJI, CATEGORY_DEFAULT_FIXED, CATEGORY_LABEL_RU, CATEGORY_COLOR, categoryEmoji, categoryColor } from "./categories";

describe("categories", () => {
  it("every category has an emoji, a default fixedness, and a RU label", () => {
    for (const c of CATEGORIES) {
      expect(CATEGORY_EMOJI[c], `emoji for ${c}`).toBeTruthy();
      expect(typeof CATEGORY_DEFAULT_FIXED[c], `fixed for ${c}`).toBe("boolean");
      expect(CATEGORY_LABEL_RU[c], `label for ${c}`).toBeTruthy();
    }
  });

  it("study/work/meeting default to fixed; gym defaults to flexible", () => {
    expect(CATEGORY_DEFAULT_FIXED.study).toBe(true);
    expect(CATEGORY_DEFAULT_FIXED.work).toBe(true);
    expect(CATEGORY_DEFAULT_FIXED.meeting).toBe(true);
    expect(CATEGORY_DEFAULT_FIXED.gym).toBe(false);
  });

  it("categoryEmoji falls back to 📌 for unknown", () => {
    expect(categoryEmoji("nonsense")).toBe("📌");
    expect(categoryEmoji("gym")).toBe("🏋️");
  });

  it("every category has a hex color", () => {
    for (const c of CATEGORIES) {
      expect(CATEGORY_COLOR[c], `color for ${c}`).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it("categoryColor falls back to the 'other' color for unknown", () => {
    expect(categoryColor("nonsense")).toBe(CATEGORY_COLOR.other);
    expect(categoryColor("gym")).toBe(CATEGORY_COLOR.gym);
  });
});
