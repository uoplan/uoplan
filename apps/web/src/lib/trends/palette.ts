import type { GradeVizBucketId, TermSeason } from "@uoplan/core";

/**
 * Categorical chart palette — distinct theme-aware hues for trends charts. Each
 * entry is a CSS variable defined per theme in `tokens.css`, so the charts
 * harmonise with the active theme (dark / light / geegees). Cycle with
 * `colorForIndex` when a chart has more categories than colours.
 */
export const CATEGORICAL_PALETTE: readonly string[] = [
  "var(--app-chart-1)",
  "var(--app-chart-2)",
  "var(--app-chart-3)",
  "var(--app-chart-4)",
  "var(--app-chart-5)",
  "var(--app-chart-6)",
  "var(--app-chart-7)",
  "var(--app-chart-8)",
];

/** Pick a categorical palette colour by index, cycling when out of range. */
export function colorForIndex(index: number): string {
  return CATEGORICAL_PALETTE[index % CATEGORICAL_PALETTE.length];
}

/** Semantic season colours — Fall (amber), Winter (icy blue), Spring/Summer (green). */
export const SEASON_COLOR: Record<TermSeason, string> = {
  fall: "var(--app-chart-season-fall)",
  winter: "var(--app-chart-season-winter)",
  springSummer: "var(--app-chart-season-springsummer)",
};

/** Theme-aware tokens for the grade-band buckets (failing → excellent). */
export const GRADE_BAND_TOKEN: Record<GradeVizBucketId, string> = {
  red: "var(--app-chart-grade-red)",
  amber: "var(--app-chart-grade-amber)",
  yellow: "var(--app-chart-grade-yellow)",
  blue: "var(--app-chart-grade-blue)",
  teal: "var(--app-chart-grade-teal)",
  green: "var(--app-chart-grade-green)",
};
