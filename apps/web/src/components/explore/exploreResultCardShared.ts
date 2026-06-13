import type { CSSProperties } from "react";
import type { GradeVizData } from "@uoplan/core";

/**
 * Shared chrome for the four Explore search-result cards (course, professor,
 * program, discipline). The `<Link>` itself stays in each card because TanStack
 * Router types `to`/`params` per route, but everything route-agnostic lives here.
 */
export const EXPLORE_RESULT_CARD_STYLE: CSSProperties = {
  width: 190,
  minWidth: 190,
  position: "relative",
  flexShrink: 0,
  display: "flex",
  flexDirection: "column",
  minHeight: 155,
  backgroundColor: "var(--app-surface-sunken)",
  border: "var(--app-border-width) solid var(--app-border)",
  borderRadius: "var(--app-radius)",
  overflow: "hidden",
  textDecoration: "none",
  color: "inherit",
  transition:
    "background-color var(--app-transition), border-color var(--app-transition), transform var(--app-transition), box-shadow var(--app-transition)",
};

const LETTER_GRADES = new Set(["F", "E", "D", "D+", "C", "C+", "B", "B+", "A-", "A", "A+"]);

/** The single most-awarded letter grade in a distribution, or null when empty. */
export function mostCommonGrade(gradeViz: GradeVizData): string | null {
  return (
    gradeViz.histogram
      .filter((h) => LETTER_GRADES.has(h.grade) && h.count > 0)
      .reduce<{ grade: string; count: number } | null>(
        (best, h) => (best === null || h.count > best.count ? h : best),
        null,
      )?.grade ?? null
  );
}
