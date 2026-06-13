import { describe, expect, it } from "vitest";

import { NATIVE_THEME_COLORS } from "../nativeTokens.gen";
import { resolveColor } from "../tokenGen";
import { getThemeColors } from "../tokens";

describe("native token generation logic", () => {
  it("oklch conversion anchors at white/black", () => {
    expect(resolveColor("oklch(1 0 0)", {})).toBe("#ffffff");
    expect(resolveColor("oklch(0 0 0)", {})).toBe("#000000");
  });

  it("collapses color-mix(..., transparent) to an rgba alpha", () => {
    expect(resolveColor("color-mix(in oklab, #ff0000 20%, transparent)", {})).toBe(
      "rgba(255, 0, 0, 0.2)",
    );
  });

  it("follows var() references within a theme", () => {
    const map = { "--app-accent": "oklch(1 0 0)", "--app-x": "var(--app-accent)" };
    expect(resolveColor("var(--app-x)", map)).toBe("#ffffff");
  });
});

describe("theme colour tokens", () => {
  const ids = ["dark", "light", "geegees"] as const;

  it("exposes all three themes with identical, non-empty key sets", () => {
    const darkKeys = Object.keys(NATIVE_THEME_COLORS.dark).sort();
    expect(darkKeys.length).toBeGreaterThan(20);
    for (const id of ids) {
      expect(Object.keys(NATIVE_THEME_COLORS[id]).sort()).toEqual(darkKeys);
    }
  });

  it("every value is an RN-renderable colour string", () => {
    const ok = /^(#[0-9a-f]{6}|rgba?\([^)]+\)|transparent)$/i;
    for (const id of ids) {
      for (const [key, value] of Object.entries(getThemeColors(id))) {
        expect(value, `${id}.${key}`).toMatch(ok);
      }
    }
  });

  it("dark and light backgrounds sit on opposite ends of the lightness range", () => {
    const lum = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    expect(lum(getThemeColors("dark").bg)).toBeLessThan(80);
    expect(lum(getThemeColors("light").bg)).toBeGreaterThan(220);
  });
});
