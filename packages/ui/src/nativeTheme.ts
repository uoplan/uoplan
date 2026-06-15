import { NATIVE_THEME_COLORS } from "@uoplan/theme";
import { Appearance } from "react-native";

/**
 * Resolved-once native colour palette for the `@uoplan/ui` React Native
 * primitives. The active scheme is read from the device appearance at module
 * load (`Appearance.getColorScheme()`), so when the phone is in dark mode every
 * native primitive — and the `StyleSheet.create` blocks that capture these
 * constants — uses the dark palette. Values come from the SHARED generated
 * {@link NATIVE_THEME_COLORS} (byte-derived from the web `tokens.css`), keeping
 * native and web in lockstep. (The app config is `userInterfaceStyle:
 * "automatic"`; switching the system appearance applies on the next launch.)
 *
 * This module is native-only — no web variant imports it, so the web bundle
 * never pulls in `react-native`.
 */
const SCHEME: "light" | "dark" = Appearance.getColorScheme() === "dark" ? "dark" : "light";
const P = NATIVE_THEME_COLORS[SCHEME];

/** Semantic status tone → solid foreground + soft tinted background. */
export interface NativeTone {
  fg: string;
  soft: string;
}

export const NativeColors = {
  scheme: SCHEME,
  /** Primary text. */
  text: P.text,
  /** Secondary / muted text. */
  textMuted: P["text-muted"],
  /** Faintest text / placeholders. */
  textDim: P["text-dim"],
  /** Text colour that contrasts the primary `text` fill (for inverted buttons). */
  textInverse: P["text-inverse"],
  /** App/page background. */
  bg: P.bg,
  /** Card / raised surface. */
  surface: P.surface,
  /** Hover / active fill. */
  surfaceHover: P["surface-hover"],
  /** Sunken track / header fill. */
  surfaceSunken: P["surface-sunken"],
  /** Hairline border. */
  border: P.border,
  /** Stronger control border (inputs, checkboxes). */
  borderStrong: P["border-strong"],
  /** Brand accent. */
  accent: P.accent,
  /** Soft accent fill. */
  accentSoft: P["accent-soft"],
  /** Text/icon colour on top of the accent. */
  onAccent: P["on-accent"],
  /** Modal/drawer backdrop scrim. */
  scrim: P["overlay-scrim"],
  /** Semantic status tones (Alert / Notification). */
  tone: {
    info: { fg: P.info, soft: P["info-soft"] },
    success: { fg: P.success, soft: P["success-soft"] },
    warning: { fg: P.warning, soft: P["warning-soft"] },
    danger: { fg: P.danger, soft: P["danger-soft"] },
    neutral: { fg: P["text-muted"], soft: P["surface-hover"] },
  } satisfies Record<string, NativeTone>,
} as const;
