/**
 * Faculty identity helpers — the single source of truth for turning the free-text
 * faculty strings scraped from the uOttawa catalogue (and referenced in program
 * requirements) into a stable, comparable {@link FacultyId}.
 *
 * Each discipline's catalogue page carries an `<h2>` like
 *   EN: "Courses in computer science (CSI) are offered by the Faculty of Engineering"
 *   FR: "Les cours en informatique (CSI) sont offerts par la Faculté de génie"
 * and program requirements occasionally reference a faculty by a short name
 * (e.g. "Science"). Both sides are normalized through {@link facultyIdFromName}
 * so a `faculty_elective` requirement can be matched to the disciplines that
 * belong to that faculty. The id is always derived from the **English** name so
 * the English short form ("Science") and the full form ("Faculty of Science")
 * collapse to the same slug ("science").
 */

import type { FacultyId } from "./brand";

/** Leading English article ("the "). */
const EN_ARTICLE_RE = /^the\s+/i;
/** Leading French article ("la ", "le ", "les ", "l'"/"l’"). */
const FR_ARTICLE_RE = /^(?:l['’]\s*|(?:la|le|les)\s+)/i;
/** English role prefix stripped before slugifying ("Faculty of ", "School of "). */
const EN_ROLE_PREFIX_RE = /^(?:faculty\s+of\s+|school\s+of\s+)/i;
/** "Courses in … are offered by <FACULTY>" / "Cours … sont offerts par <FACULTY>". */
const EN_OFFERED_BY_RE = /offered by\s+(.+)$/i;
const FR_OFFERED_BY_RE = /offert(?:s)? par\s+(.+)$/i;

function stripDiacritics(value: string): string {
  return value.normalize("NFKD").replaceAll(/[\u0300-\u036f]/g, "");
}

/**
 * Canonicalize known catalogue inconsistencies onto a single id. uOttawa's
 * per-discipline pages occasionally name the same faculty differently (e.g.
 * "Faculty of Sciences" on one page vs "Faculty of Science" on every other), so
 * we collapse the stray variant onto the canonical slug.
 */
const FACULTY_ID_ALIASES: Record<string, string> = {
  sciences: "science",
};

/**
 * Clean a raw faculty string into a display name: collapse whitespace, drop a
 * trailing period, and strip the leading article for the given locale.
 * e.g. "the Faculty of Science" → "Faculty of Science"; "la Faculté de génie" →
 * "Faculté de génie".
 */
export function cleanFacultyDisplayName(raw: string, locale: "en" | "fr" = "en"): string {
  let value = raw.replaceAll(/\s+/g, " ").trim().replace(/\.+$/, "").trim();
  value = value.replace(locale === "fr" ? FR_ARTICLE_RE : EN_ARTICLE_RE, "").trim();
  return value;
}

/**
 * Derive the stable {@link FacultyId} from an English faculty name. Strips the
 * leading article and the "Faculty of"/"School of" role prefix, then slugifies
 * the remainder (diacritic-free, lower-case, non-alphanumerics → hyphen).
 * Returns `null` when the name has no usable content.
 */
export function facultyIdFromName(enName: string): FacultyId | null {
  const cleaned = cleanFacultyDisplayName(enName, "en").replace(EN_ROLE_PREFIX_RE, "").trim();
  const slug = stripDiacritics(cleaned)
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "");
  if (!slug) return null;
  const canonical = FACULTY_ID_ALIASES[slug] ?? slug;
  return canonical as unknown as FacultyId;
}

/**
 * Extract the cleaned faculty display name from a discipline catalogue heading,
 * or `null` when the heading does not contain an "offered by" clause.
 */
export function extractFacultyFromHeading(heading: string, locale: "en" | "fr"): string | null {
  const normalized = heading.replaceAll(/\s+/g, " ").trim();
  const match = normalized.match(locale === "fr" ? FR_OFFERED_BY_RE : EN_OFFERED_BY_RE);
  if (!match?.[1]) return null;
  const cleaned = cleanFacultyDisplayName(match[1], locale);
  return cleaned || null;
}
