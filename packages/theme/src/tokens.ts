/**
 * Cross-platform design tokens.
 *
 * Colours are generated from the web source of truth
 * (`apps/web/src/styles/tokens.css`) into {@link NATIVE_THEME_COLORS} — see
 * `scripts/generate-native-tokens.ts`. Web renders the tokens as CSS variables
 * (`var(--app-*)`); native reads the resolved values here. Shape/typography
 * tokens that RN expresses as numbers / family names live below.
 */
import { NATIVE_THEME_COLORS } from "./nativeTokens.gen";
import type { ThemeId } from "./model";

/** A semantic colour token name (the `--app-` prefix stripped). */
export type ThemeColorToken = keyof (typeof NATIVE_THEME_COLORS)["dark"];

/** Resolved colour values for a single theme, keyed by {@link ThemeColorToken}. */
export type ThemeColors = Record<ThemeColorToken, string>;

/**
 * Resolved colour values for `id`, ready to drop into React Native style
 * objects (every value is a `#rrggbb`, `rgba(...)`, or `transparent` string).
 */
export function getThemeColors(id: ThemeId): ThemeColors {
  return NATIVE_THEME_COLORS[id];
}

export { NATIVE_THEME_COLORS };

/**
 * Corner radii (px) — mirrors the `--app-radius-*` scale. `pill` is the
 * fully-rounded sentinel (RN clamps it to half the height).
 */
export const radii = {
  sm: 8,
  md: 12,
  lg: 18,
  pill: 999,
} as const;

/** Hairline border width (px) — mirrors `--app-border-width`. */
export const borderWidth = 1;

/**
 * Logical font-family names — mirrors `--app-font-*`. On native these are the
 * names the shell registers the bundled DM fonts under (via `expo-font`); on
 * web they map to the CSS family stacks. Use the logical name, not a stack.
 */
export const fontFamilies = {
  body: "DM Mono",
  heading: "DM Serif Display",
  mono: "DM Mono",
} as const;

export type FontFamilyToken = keyof typeof fontFamilies;
