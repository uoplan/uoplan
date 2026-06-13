import { describe, expect, it } from "vitest";
import { isThemeId, resolveTheme, THEME_LIST, THEME_STORAGE_KEY } from "../index";
import type { ThemeSelection } from "../index";

describe("resolveTheme", () => {
  it("returns the explicitly selected theme regardless of system base", () => {
    expect(resolveTheme("dark", "light").id).toBe("dark");
    expect(resolveTheme("light", "dark").id).toBe("light");
  });

  it("maps a system selection through the system base", () => {
    expect(resolveTheme("system", "dark").id).toBe("dark");
    expect(resolveTheme("system", "light").id).toBe("light");
  });

  it("falls back to the system mapping for an unknown selection", () => {
    // A stale persisted id could reach resolveTheme at runtime; cast to exercise
    // the defensive fallback branch despite the strict ThemeSelection type.
    expect(resolveTheme("does-not-exist" as ThemeSelection, "light").id).toBe("light");
    expect(resolveTheme("does-not-exist" as ThemeSelection, "dark").id).toBe("dark");
  });

  it("preserves each theme's base colour scheme", () => {
    expect(resolveTheme("geegees", "light").base).toBe("dark");
    expect(resolveTheme("light", "dark").base).toBe("light");
  });
});

describe("isThemeId", () => {
  it("accepts every registered theme id", () => {
    for (const theme of THEME_LIST) {
      expect(isThemeId(theme.id)).toBe(true);
    }
  });

  it("rejects unregistered ids", () => {
    expect(isThemeId("system")).toBe(false);
    expect(isThemeId("neon")).toBe(false);
    expect(isThemeId("")).toBe(false);
  });
});

describe("registry", () => {
  it("exposes the expected themes with stable label ids", () => {
    expect(THEME_LIST.map((t) => t.id)).toEqual(["dark", "light", "geegees"]);
    expect(THEME_LIST.map((t) => t.labelId)).toEqual([
      "theme.dark",
      "theme.light",
      "theme.geegees",
    ]);
  });

  it("exposes a stable storage key", () => {
    expect(THEME_STORAGE_KEY).toBe("uoplan.theme");
  });
});
