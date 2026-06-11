/**
 * Resolve a feedback professor name to a RateMyProfessors professor
 * (`apps/scraper/data/ratemyprofessors.json`), returning the RMP canonical
 * display name and `legacyId` when matched.
 *
 * Matching strategy (names are normalized: accents stripped, lowercased,
 * punctuation collapsed to spaces):
 *   1. exact normalized full-name match;
 *   2. otherwise a (first token, last token) match, but ONLY when that pair is
 *      unambiguous in RMP (a single distinct professor) — this captures middle
 *      names dropped on RMP (e.g. feedback "Andrew James Henry Forward" ->
 *      RMP "Andrew Forward") without guessing between distinct same-named people.
 *
 * When no match is found the original feedback name is returned with no
 * `legacyId` (matching the existing dataset, where ~24% of entries carry none).
 */

import { readJson } from "../shared/json.ts";
import { RATEMYPROFESSORS_FILE } from "../shared/paths.ts";

interface RmpProfessor {
  legacyId: number;
  name: string;
}

interface RmpFile {
  professors: RmpProfessor[];
}

export interface ResolvedProfessor {
  name: string;
  legacyId?: number;
}

export type ProfessorResolver = (feedbackName: string) => ResolvedProfessor;

/** Accent-insensitive, punctuation-insensitive name key. */
export function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replaceAll(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, " ")
    .trim();
}

function fuzzyKey(normalized: string): string | null {
  const tokens = normalized.split(" ");
  if (tokens.length < 2 || tokens[0] === "") return null;
  return `${tokens[0]}|${tokens[tokens.length - 1]}`;
}

export function createProfessorResolver(professors: RmpProfessor[]): ProfessorResolver {
  const exact = new Map<string, RmpProfessor>();
  // value === null marks an ambiguous (first, last) pair to be skipped.
  const fuzzy = new Map<string, RmpProfessor | null>();

  for (const prof of professors) {
    if (!prof?.name || typeof prof.legacyId !== "number") continue;
    const normalized = normalizeName(prof.name);
    if (!normalized) continue;

    if (!exact.has(normalized)) exact.set(normalized, prof);

    const key = fuzzyKey(normalized);
    if (!key) continue;
    if (!fuzzy.has(key)) {
      fuzzy.set(key, prof);
    } else {
      const current = fuzzy.get(key);
      if (current && current.legacyId !== prof.legacyId) fuzzy.set(key, null);
    }
  }

  return (feedbackName: string): ResolvedProfessor => {
    const normalized = normalizeName(feedbackName);
    const exactMatch = exact.get(normalized);
    if (exactMatch) {
      return { name: exactMatch.name, legacyId: exactMatch.legacyId };
    }
    const key = fuzzyKey(normalized);
    const fuzzyMatch = key ? fuzzy.get(key) : undefined;
    if (fuzzyMatch) {
      return { name: fuzzyMatch.name, legacyId: fuzzyMatch.legacyId };
    }
    return { name: feedbackName.trim() };
  };
}

export async function buildProfessorResolver(
  file: string = RATEMYPROFESSORS_FILE,
): Promise<ProfessorResolver> {
  let data: RmpFile;
  try {
    data = await readJson<RmpFile>(file);
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === "ENOENT") {
      return (name: string) => ({ name: name.trim() });
    }
    throw err;
  }
  return createProfessorResolver(data.professors ?? []);
}
