import type { ProfessorNameKey } from "./brand";

export type ProfessorRatingsEntry = {
  id?: string;
  legacyId?: number;
  rating: number;
  numRatings: number;
};
export type ProfessorRatingsMap = Record<string, ProfessorRatingsEntry>;

/**
 * True when an entry represents a real RateMyProfessors rating. Unrated
 * professors come through the data as `rating: 0, numRatings: 0`, which must be
 * treated as "no rating" rather than a 0.0 average.
 */
export function hasProfessorRatings(
  entry: ProfessorRatingsEntry | null | undefined,
): entry is ProfessorRatingsEntry {
  return (
    entry != null &&
    (entry.numRatings ?? 0) > 0 &&
    Number.isFinite(entry.rating) &&
    entry.rating > 0
  );
}

export function normalizeProfessorName(name: string): ProfessorNameKey {
  return (name ?? "").trim().replace(/\s+/g, " ") as ProfessorNameKey;
}

/**
 * Yield each instructor exactly once, paired with its normalized name key.
 * Empty names and duplicate keys are skipped. Shared by every consumer that
 * walks a section's instructor list (ratings, sentiment) so the dedupe/normalize
 * rule lives in one place.
 */
export function* uniqueInstructors(
  instructors: Iterable<string> | null | undefined,
): Generator<{ key: ProfessorNameKey; raw: string }> {
  if (!instructors) return;
  const seen = new Set<ProfessorNameKey>();
  for (const raw of instructors) {
    const key = normalizeProfessorName(raw);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    yield { key, raw };
  }
}

export function buildProfessorRatingsMap(input: {
  professors: Array<{
    id?: string;
    legacyId?: number;
    name: string;
    rating: number | null;
    numRatings?: number;
  }>;
}): ProfessorRatingsMap {
  const map: ProfessorRatingsMap = {};
  for (const p of input.professors ?? []) {
    const key = normalizeProfessorName(p.name);
    if (!key) continue;
    const rating = typeof p.rating === "number" ? p.rating : Number(p.rating);
    if (!Number.isFinite(rating)) continue;
    map[key] = { id: p.id, legacyId: p.legacyId, rating, numRatings: p.numRatings ?? 0 };
  }
  return map;
}

export function getRatingsForInstructors(
  instructors: string[] | null | undefined,
  map: ProfessorRatingsMap | null | undefined,
): number[] {
  if (!map || !instructors?.length) return [];
  const out: number[] = [];
  for (const { key } of uniqueInstructors(instructors)) {
    const entry = map[key];
    if (entry && Number.isFinite(entry.rating) && entry.numRatings > 0) out.push(entry.rating);
  }
  return out;
}

export function getRatingDetailsForInstructors(
  instructors: string[] | null | undefined,
  map: ProfessorRatingsMap | null | undefined,
): Array<{ id?: string; legacyId?: number; name: string; rating: number; numRatings: number }> {
  if (!map || !instructors?.length) return [];
  const out: Array<{
    id?: string;
    legacyId?: number;
    name: string;
    rating: number;
    numRatings: number;
  }> = [];
  for (const { key, raw } of uniqueInstructors(instructors)) {
    const entry = map[key];
    if (entry && Number.isFinite(entry.rating)) {
      out.push({
        id: entry.id,
        legacyId: entry.legacyId,
        name: raw.trim(),
        rating: entry.rating,
        numRatings: entry.numRatings,
      });
    }
  }
  return out;
}

export function isSectionAllowedByMinRating(args: {
  instructors: string[] | null | undefined;
  minRating: number | null | undefined;
  professorRatings: ProfessorRatingsMap | null | undefined;
}): boolean {
  const { instructors, minRating, professorRatings } = args;
  if (minRating == null || !Number.isFinite(minRating)) return true;
  const ratings = getRatingsForInstructors(instructors, professorRatings);
  if (ratings.length === 0) return true; // no rating => always allowed
  return ratings.every((r) => r >= minRating);
}
