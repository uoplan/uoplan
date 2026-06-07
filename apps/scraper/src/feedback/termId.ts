/**
 * Map an S-Reports season+year label (e.g. "Fall 2025", "Spring/Summer 2025")
 * to the uOttawa PeopleSoft STRM id used by grades.json / schedules.* (e.g. "2259").
 *
 * STRM = 2000 + (year % 100) * 10 + seasonCode, where the season code is
 * Winter = 1, Spring/Summer = 5, Fall = 9. Verified against data/terms.json:
 *   Fall 2026 -> 2269, Winter 2027 -> 2271, Spring/Summer 2026 -> 2265,
 *   Fall 2025 -> 2259 (the most recent term present in grades.json).
 *
 * The label year is the calendar year of the term as the portal displays it,
 * which already matches PeopleSoft's encoding (Winter 2026 -> 2261).
 */

const SEASON_CODE: Record<string, number> = {
  winter: 1,
  spring: 5,
  summer: 5,
  "spring/summer": 5,
  fall: 9,
  autumn: 9,
};

export interface ParsedTermLabel {
  season: string;
  year: number;
  termId: string;
}

const LABEL_RE =
  /\b(spring\s*\/\s*summer|spring|summer|winter|fall|autumn)\b[^0-9]*((?:19|20)\d{2})/i;

export function parseTermLabel(label: string): ParsedTermLabel | null {
  const m = LABEL_RE.exec(label);
  if (!m) return null;
  const season = m[1].toLowerCase().replace(/\s+/g, "");
  const year = Number(m[2]);
  const code = SEASON_CODE[season] ?? SEASON_CODE[season.replace("summer", "").replace("/", "")];
  if (code === undefined) return null;
  return { season, year, termId: termIdFor(year, code) };
}

export function labelToTermId(label: string): string | null {
  return parseTermLabel(label)?.termId ?? null;
}

function termIdFor(year: number, seasonCode: number): string {
  return String(2000 + (year % 100) * 10 + seasonCode);
}
