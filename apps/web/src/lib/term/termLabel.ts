import type { TermSeason } from "@uoplan/core";
import { tr } from "../../i18n";
import { decode, fallback, formatTermLabelPlain } from "./termLabelPlain";

const SEASON_LABEL_ID: Record<TermSeason, string> = {
  winter: "term.season.winter",
  springSummer: "term.season.summer",
  fall: "term.season.fall",
};

/**
 * Canonical, localized term label shared across the app, e.g. `Winter 2025`
 * (French: `Hiver 2025`). Derived from the PeopleSoft term id via
 * {@link decodeTermMeta} so grades, schedules, and pickers all render the same
 * format. Falls back to the raw id string when it can't be decoded.
 *
 * Reads the active locale at call time, so React callers must subscribe via
 * `useTr()` to re-render on locale change.
 */
export function formatTermLabel(termId: number | string): string {
  const decoded = decode(termId);
  if (!decoded) return fallback(termId);
  return `${tr(SEASON_LABEL_ID[decoded.season])} ${decoded.year}`;
}

/**
 * Compact localized term label for dense axes, e.g. `W25` (French `H25`).
 * Season initial (localized) + two-digit year. Falls back to the raw id.
 */
export function formatTermLabelShort(termId: number | string): string {
  const decoded = decode(termId);
  if (!decoded) return fallback(termId);
  const season = tr(SEASON_LABEL_ID[decoded.season]);
  const initial = season.charAt(0).toUpperCase();
  return `${initial}${String(decoded.year).slice(-2)}`;
}

/**
 * Re-exported for convenience. Non-localized counterpart to
 * {@link formatTermLabel}; defined in `./termLabelPlain` (which has no i18n
 * dependency) so it can be used from web workers and search indexing without
 * bundling the translation catalogs.
 */
export { formatTermLabelPlain };
