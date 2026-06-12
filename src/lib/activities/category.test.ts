import { describe, it, expect } from "vitest";
import { categoryForType, matchesCategories, ACTIVITY_CATEGORIES, categoryColor } from "./category";

describe("categoryForType", () => {
  it("buckets known interest slugs", () => {
    expect(categoryForType("running")).toBe("sport");
    expect(categoryForType("gym")).toBe("sport");
    expect(categoryForType("coffee")).toBe("food");
    expect(categoryForType("cooking")).toBe("food");
    expect(categoryForType("movies")).toBe("culture");
    expect(categoryForType("boardgames")).toBe("games");
  });
  it("unknown / custom types fall back to other", () => {
    expect(categoryForType("квест")).toBe("other");
    expect(categoryForType("")).toBe("other");
  });
});

describe("matchesCategories", () => {
  it("empty filter matches everything", () => {
    expect(matchesCategories("running", [])).toBe(true);
    expect(matchesCategories("квест", [])).toBe(true);
  });
  it("matches when the type's category is selected", () => {
    expect(matchesCategories("running", ["sport"])).toBe(true);
    expect(matchesCategories("coffee", ["sport", "food"])).toBe(true);
    expect(matchesCategories("movies", ["sport"])).toBe(false);
  });
});

describe("ACTIVITY_CATEGORIES / categoryColor", () => {
  it("every category key has a color and the list covers all keys", () => {
    const keys = ACTIVITY_CATEGORIES.map((c) => c.key);
    expect(new Set(keys)).toEqual(new Set(["sport", "food", "culture", "games", "other"]));
    for (const c of ACTIVITY_CATEGORIES) {
      expect(c.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(categoryColor(c.key)).toBe(c.color);
    }
  });
});
