import type { RatingColor } from "@uoplan/core";

/**
 * Map a professor-rating color tier to the corresponding Mantine CSS variable.
 * Mantine-specific, so it lives in the web app rather than in the
 * platform-agnostic @uoplan/core package.
 */
export function ratingColorToCssVar(color: RatingColor): string {
  switch (color) {
    case "red":
      return "var(--mantine-color-red-6)";
    case "orange":
      return "var(--mantine-color-orange-6)";
    case "yellow":
      return "var(--mantine-color-yellow-6)";
    case "green":
      return "var(--mantine-color-green-6)";
    case "gray":
      return "var(--mantine-color-gray-6)";
  }
}
