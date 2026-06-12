import { describe, it, expect } from "vitest";
import {
  parseThemePref,
  parseLanguagePref,
  parseSysTheme,
  parseSysLanguage,
  resolveTheme,
  resolveLanguage,
} from "./preferences-shared";

describe("parseThemePref / parseLanguagePref", () => {
  it("explicit values pass through; everything else is system", () => {
    expect(parseThemePref("light")).toBe("light");
    expect(parseThemePref("dark")).toBe("dark");
    expect(parseThemePref("system")).toBe("system");
    expect(parseThemePref(undefined)).toBe("system");
    expect(parseThemePref("garbage")).toBe("system");
    expect(parseLanguagePref("ru")).toBe("ru");
    expect(parseLanguagePref("en")).toBe("en");
    expect(parseLanguagePref(null)).toBe("system");
  });
});

describe("parseSysTheme / parseSysLanguage (client hints)", () => {
  it("only valid hints survive, otherwise null", () => {
    expect(parseSysTheme("dark")).toBe("dark");
    expect(parseSysTheme("nope")).toBeNull();
    expect(parseSysLanguage("ru")).toBe("ru");
    expect(parseSysLanguage(undefined)).toBeNull();
  });
});

describe("resolveTheme", () => {
  it("explicit pref wins over hint", () => {
    expect(resolveTheme("light", "dark")).toBe("light");
    expect(resolveTheme("dark", "light")).toBe("dark");
  });
  it("system follows the hint, falling back to dark", () => {
    expect(resolveTheme("system", "light")).toBe("light");
    expect(resolveTheme("system", "dark")).toBe("dark");
    expect(resolveTheme("system", null)).toBe("dark");
  });
});

describe("resolveLanguage", () => {
  it("explicit pref wins; system follows hint, fallback en", () => {
    expect(resolveLanguage("ru", "en")).toBe("ru");
    expect(resolveLanguage("system", "ru")).toBe("ru");
    expect(resolveLanguage("system", null)).toBe("en");
  });
});
