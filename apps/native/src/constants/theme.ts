/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import "@/global.css";

import { NATIVE_THEME_COLORS } from "@uoplan/theme";
import { Appearance, Platform } from "react-native";

export const Colors = {
  light: {
    text: "#000000",
    background: "#ffffff",
    backgroundElement: "#F0F0F3",
    backgroundSelected: "#E0E1E6",
    textSecondary: "#60646C",
  },
  dark: {
    text: "#ffffff",
    background: "#000000",
    backgroundElement: "#212225",
    backgroundSelected: "#2E3135",
    textSecondary: "#B0B4BA",
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = {
  /** Display headings + wordmarks — mirrors the web `--app-font-heading`. */
  serif: "DM Serif Display",
  /** Body / UI / labels — the web's `--app-font-body` is DM Mono. */
  sans: "DM Mono",
  /** Numeric / code — same monospace family. */
  mono: "DM Mono",
  /** Slightly heavier mono for emphasised labels (day headers, stats). */
  monoMedium: "DM Mono Medium",
  /** Back-compat alias. */
  rounded: "DM Mono",
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

/**
 * Warm surface palette for the native app shell. These are sourced from the
 * SHARED, generated {@link NATIVE_THEME_COLORS} (`@uoplan/theme`), which is
 * derived byte-for-byte from the web app's `tokens.css` — so the native shell
 * tracks the web's paper aesthetic and blue accent exactly (no drift).
 *
 * The active scheme is resolved ONCE at module load from the device appearance
 * (`Appearance.getColorScheme()`), so when the phone is in dark mode the whole
 * app — including every `StyleSheet.create` block that reads `Surface` — picks
 * up the dark palette. (The app config is `userInterfaceStyle: "automatic"`.)
 * Switching the system appearance applies on the next app launch.
 */
export const ACTIVE_SCHEME: "light" | "dark" =
  Appearance.getColorScheme() === "dark" ? "dark" : "light";

const PALETTE = NATIVE_THEME_COLORS[ACTIVE_SCHEME];

export const Surface = {
  /** App/page background (warm off-white / dark slate). */
  page: PALETTE.bg,
  /** Card / raised surface. */
  card: PALETTE.surface,
  /** Header band / subtle fill. */
  subtle: PALETTE["surface-sunken"],
  /** Hairline borders. */
  border: PALETTE.border,
  /** Primary text. */
  label: PALETTE.text,
  /** Secondary / dimmed text. */
  dimmed: PALETTE["text-muted"],
  /** Faintest text. */
  faint: PALETTE["text-dim"],
  /** Brand accent (web blue). */
  accent: PALETTE.accent,
  /** Soft accent fill (tinted backgrounds, active step bars). */
  accentSoft: PALETTE["accent-soft"],
  /** Text/icon colour on top of the accent. */
  onAccent: PALETTE["on-accent"],
  /** Text colour on top of a course-coloured calendar event. */
  onEvent: PALETTE["on-event"],
  /** Semantic status colours. */
  success: PALETTE.success,
  warning: PALETTE.warning,
  danger: PALETTE.danger,
  /** Translucent danger fill (destructive button backgrounds). */
  dangerSoft: PALETTE["danger-soft"],
  /** Translucent warning fill (warning banner/pill backgrounds). */
  warningSoft: PALETTE["warning-soft"],
  info: PALETTE.info,
  /** Strong translucent fill (empty histogram bars, subtle overlays). */
  translucentStrong: PALETTE["translucent-strong"],
} as const;

/**
 * Theme-aware categorical chart palette — the native analogue of the web's
 * `lib/trends/palette.ts`. Sourced from the SAME generated tokens
 * ({@link NATIVE_THEME_COLORS}, derived byte-for-byte from `tokens.css`), so
 * Trends and grade charts use the exact web hues and track dark mode.
 */
export const ChartPalette: readonly string[] = [
  PALETTE["chart-1"],
  PALETTE["chart-2"],
  PALETTE["chart-3"],
  PALETTE["chart-4"],
  PALETTE["chart-5"],
  PALETTE["chart-6"],
  PALETTE["chart-7"],
  PALETTE["chart-8"],
];

/** Pick a categorical palette colour by index, cycling when out of range. */
export function chartColorForIndex(index: number): string {
  return ChartPalette[index % ChartPalette.length];
}

/** Semantic season colours — Fall (amber), Winter (icy blue), Spring/Summer (green). */
export const SeasonColor = {
  fall: PALETTE["chart-season-fall"],
  winter: PALETTE["chart-season-winter"],
  springSummer: PALETTE["chart-season-springsummer"],
} as const;

/** Grade-band bucket colours (failing → excellent), matching the web tokens. */
export const GradeBandColor = {
  red: PALETTE["chart-grade-red"],
  amber: PALETTE["chart-grade-amber"],
  yellow: PALETTE["chart-grade-yellow"],
  blue: PALETTE["chart-grade-blue"],
  teal: PALETTE["chart-grade-teal"],
  green: PALETTE["chart-grade-green"],
  grey: PALETTE["chart-grade-grey"],
} as const;
