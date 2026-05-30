/**
 * UI utilities for colors, display formatting, and visual helpers.
 */

import type { GeneratedSchedule } from "../generation/types";

/**
 * Color palette for course calendar events.
 */
export const COURSE_COLORS = [
  "violet",
  "blue",
  "teal",
  "cyan",
  "pink",
  "grape",
  "indigo",
  "orange",
  "red",
  "green",
  "yellow",
  "lime",
  "plum",
  "fuschia",
  "sky",
] as const;

export type CourseColor = (typeof COURSE_COLORS)[number];

/**
 * Hex color values for course colors.
 */
export const COURSE_COLOR_HEX: Record<CourseColor, string> = {
  violet: "#7950f2",
  blue: "#228be6",
  teal: "#12b886",
  cyan: "#15aabf",
  pink: "#e64980",
  grape: "#be4bdb",
  indigo: "#4c6ef5",
  orange: "#fd7e14",
  red: "#fa5252",
  green: "#40c057",
  yellow: "#fab005",
  lime: "#82c91e",
  plum: "#845ef7",
  fuschia: "#f06595",
  sky: "#339af0",
};

/**
 * Get a course color by index (cycles through available colors).
 */
export function getCourseColor(index: number): CourseColor {
  return COURSE_COLORS[index % COURSE_COLORS.length];
}

/**
 * Get the hex value for a course color by index.
 */
export function getCourseColorHex(index: number): string {
  const color = getCourseColor(index);
  return COURSE_COLOR_HEX[color];
}

/**
 * Build the canonical course → colour-index map for a schedule.
 *
 * Course codes are de-duplicated, sorted alphabetically, and assigned colour
 * indices by position (`i % COURSE_COLORS.length`). This is the single source of
 * truth shared by the web calendar and the OG-image preview, so colours stay
 * consistent between them. Swap colour-inheritance is layered on top of this base
 * map by the caller (see scheduleFromState reconstruction and the web store).
 */
export function buildColorMap(schedule: GeneratedSchedule): Record<string, number> {
  const codes = [...new Set(schedule.enrollments.map((e) => e.courseCode))].sort();
  const map: Record<string, number> = {};
  codes.forEach((code, i) => {
    map[code] = i % COURSE_COLORS.length;
  });
  return map;
}

/**
 * Transfer a course's colour index to its swapped-in replacement, mirroring the
 * web store's `tryApplyOneSwap`: the new course code inherits the old course's
 * colour index and the old code is dropped. If the old code had no colour, the
 * new code simply gains none. Keeps OG-image preview colours consistent with the
 * live calendar across swaps.
 */
export function transferSwapColor(
  colorMap: Record<string, number>,
  oldCode: string,
  newCode: string,
): Record<string, number> {
  const oldColorIdx = colorMap[oldCode];
  const { [oldCode]: _removed, ...rest } = colorMap;
  return oldColorIdx !== undefined ? { ...rest, [newCode]: oldColorIdx } : rest;
}

/**
 * Parse a hex color to RGB components.
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleanHex = hex.replace("#", "");
  const parts = cleanHex.match(/.{2}/g);
  if (!parts || parts.length < 3) {
    return { r: 0, g: 0, b: 0 };
  }
  return {
    r: parseInt(parts[0], 16),
    g: parseInt(parts[1], 16),
    b: parseInt(parts[2], 16),
  };
}

/**
 * Rating color categories.
 */
export type RatingColor = "red" | "orange" | "yellow" | "green" | "gray";

/**
 * Convert a professor rating (1-5 scale) to a color category.
 */
export function ratingToColor(rating: number | null | undefined): RatingColor {
  if (rating == null || rating <= 0) return "gray";
  if (rating < 2.5) return "red";
  if (rating < 3.3) return "orange";
  if (rating < 4.0) return "yellow";
  return "green";
}

/**
 * Requirement completion status colors.
 */
export type RequirementStatus = "complete" | "partial" | "incomplete" | "selected";

/**
 * Get the Mantine color for a requirement status.
 */
export function getRequirementStatusColor(status: RequirementStatus): string {
  switch (status) {
    case "complete":
      return "green";
    case "partial":
      return "yellow";
    case "selected":
      return "blue";
    case "incomplete":
    default:
      return "gray";
  }
}

/**
 * Format credits for display.
 * e.g., 3 -> "3 credits", 1 -> "1 credit"
 */
export function formatCredits(credits: number): string {
  return credits === 1 ? "1 credit" : `${credits} credits`;
}

/**
 * Truncate text to a maximum length with ellipsis.
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1) + "…";
}
