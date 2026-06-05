import { type TermSeason, decodeTermMeta } from "@uoplan/core";

/** English season words, for non-localized contexts (search indexing, workers). */
const SEASON_LABEL_EN: Record<TermSeason, string> = {
  winter: "Winter",
  springSummer: "Summer",
  fall: "Fall",
};

type DecodedTerm = { season: TermSeason; year: number };

export function decode(termId: number | string): DecodedTerm | null {
  const id = typeof termId === "string" ? Number.parseInt(termId, 10) : termId;
  if (!Number.isFinite(id)) return null;
  const meta = decodeTermMeta(id);
  if (!meta.season || meta.year <= 0) return null;
  return { season: meta.season, year: meta.year };
}

export function fallback(termId: number | string): string {
  if (typeof termId === "string") return termId;
  if (!Number.isFinite(termId)) return String(termId);
  return String(Math.abs(Math.floor(termId)));
}

/**
 * Non-localized term label (always English, e.g. `Fall 2026`). Use this for
 * search indexing and any context without an active i18n catalog (e.g. web
 * workers). This module deliberately avoids importing the i18n runtime so it can
 * be bundled into workers without dragging in the translation catalogs.
 *
 * Display surfaces should use `formatTermLabel` from `./termLabel` so the label
 * is localized and locale-reactive.
 */
export function formatTermLabelPlain(termId: number | string): string {
  const decoded = decode(termId);
  if (!decoded) return fallback(termId);
  return `${SEASON_LABEL_EN[decoded.season]} ${decoded.year}`;
}
