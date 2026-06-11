/**
 * Grade-distribution primitives shared across the grades scraper.
 *
 * `GRADE_KEYS` is the canonical, ordered list of grade buckets used by the
 * committed `grades.json`. The order is significant: it is preserved when
 * serializing each `distribution` object so the generated output diffs cleanly
 * against the existing dataset.
 */

export const GRADE_KEYS = [
  "A+",
  "A",
  "A-",
  "B+",
  "B",
  "C+",
  "C",
  "D+",
  "D",
  "E",
  "F",
  "EIN",
  "NS",
  "NC",
  "ABS",
  "P",
  "S",
] as const;

export type GradeKey = (typeof GRADE_KEYS)[number];

export type Distribution = Record<GradeKey, number>;

const GRADE_KEY_SET = new Set<string>(GRADE_KEYS);

export function isGradeKey(value: string): value is GradeKey {
  return GRADE_KEY_SET.has(value);
}

export function emptyDistribution(): Distribution {
  const dist = {} as Distribution;
  for (const key of GRADE_KEYS) dist[key] = 0;
  return dist;
}

/** Add `from` into `into` in place, bucket by bucket. */
export function addDistribution(into: Distribution, from: Distribution): void {
  for (const key of GRADE_KEYS) into[key] += from[key];
}

/** Re-key a distribution into canonical `GRADE_KEYS` order for stable output. */
export function orderDistribution(dist: Distribution): Distribution {
  const ordered = {} as Distribution;
  for (const key of GRADE_KEYS) ordered[key] = dist[key] ?? 0;
  return ordered;
}

/**
 * Normalize a uOttawa course code to the spaced-uppercase form used everywhere
 * in uoplan data (e.g. `"adm1100"` / `"ADM 1100 "` -> `"ADM 1100"`).
 */
export function normalizeCode(value: string): string {
  const compact = value.trim().toUpperCase().replaceAll(/\s+/g, " ");
  // Insert the single canonical space between the subject letters and the
  // course number when the source omits it (e.g. "ADM1100").
  const match = /^([A-Z]{2,4})\s*([0-9]{3,5}[A-Z]?)$/.exec(compact);
  if (match) return `${match[1]} ${match[2]}`;
  return compact;
}
