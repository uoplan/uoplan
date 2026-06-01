import { type TermSeason, decodeTermMeta } from "@uoplan/core";
import { tr } from "../../i18n";

const SEASON_LABEL_ID: Record<TermSeason, string> = {
  winter: "term.season.winter",
  springSummer: "term.season.summer",
  fall: "term.season.fall",
};

/** English season words, for non-localized contexts (search indexing, workers). */
const SEASON_LABEL_EN: Record<TermSeason, string> = {
  winter: "Winter",
  springSummer: "Summer",
  fall: "Fall",
};

type DecodedTerm = { season: TermSeason; year: number };

function decode(termId: number | string): DecodedTerm | null {
  const id = typeof termId === "string" ? Number.parseInt(termId, 10) : termId;
  if (!Number.isFinite(id)) return null;
  const meta = decodeTermMeta(id);
  if (!meta.season || meta.year <= 0) return null;
  return { season: meta.season, year: meta.year };
}

function fallback(termId: number | string): string {
  if (typeof termId === "string") return termId;
  if (!Number.isFinite(termId)) return String(termId);
  return String(Math.abs(Math.floor(termId)));
}

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
 * Non-localized counterpart to {@link formatTermLabel} (always English, e.g.
 * `Fall 2026`). Use this for search indexing and any context without an active
 * i18n catalog (e.g. web workers). Display surfaces should use
 * {@link formatTermLabel} so the label is localized and locale-reactive.
 */
export function formatTermLabelPlain(termId: number | string): string {
  const decoded = decode(termId);
  if (!decoded) return fallback(termId);
  return `${SEASON_LABEL_EN[decoded.season]} ${decoded.year}`;
}
