import type { ProfessorGraphNode } from "@uoplan/schedule";

export type ProfessorSearchEntry = {
  id: string;
  displayName: string;
  legacyId?: number;
  /** Lowercased name + legacy id for fast substring search. */
  searchText: string;
};

const PROFESSOR_GRAPH_SEARCH_MAX = 24;

/** Stop scanning after this many matches (e.g. single-letter queries). */
const MATCH_COLLECT_CAP = 256;

export function buildProfessorSearchEntries(nodes: ProfessorGraphNode[]): ProfessorSearchEntry[] {
  return nodes.map((n) => ({
    id: n.id,
    displayName: n.displayName,
    legacyId: n.legacyId,
    searchText: [n.displayName, n.legacyId != null ? String(n.legacyId) : ""]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
  }));
}

function rankProfessorSearchMatch(
  entry: Pick<ProfessorSearchEntry, "displayName" | "searchText">,
  q: string,
): number | null {
  if (!entry.searchText.includes(q)) return null;
  const name = entry.displayName.toLowerCase();
  if (name.startsWith(q)) return 0;
  if (entry.searchText.startsWith(q)) return 1;
  return 2;
}

type ProfessorSearchScored = {
  items: ProfessorSearchEntry[];
  topRank: number | null;
};

/**
 * Substring search on name / legacy id only (no Fuse) — fast enough for ~5k professors.
 */
export function searchProfessorsScored(
  entries: ProfessorSearchEntry[],
  rawQuery: string,
): ProfessorSearchScored {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return { items: [], topRank: null };

  const scored: { entry: ProfessorSearchEntry; rank: number }[] = [];

  for (const entry of entries) {
    const rank = rankProfessorSearchMatch(entry, q);
    if (rank == null) continue;
    scored.push({ entry, rank });
    if (scored.length >= MATCH_COLLECT_CAP) break;
  }

  scored.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    return a.entry.displayName.localeCompare(b.entry.displayName, "en");
  });

  const slice = scored.slice(0, PROFESSOR_GRAPH_SEARCH_MAX);
  return {
    items: slice.map((s) => s.entry),
    topRank: slice[0]?.rank ?? null,
  };
}

export function searchProfessors(
  entries: ProfessorSearchEntry[],
  rawQuery: string,
): ProfessorSearchEntry[] {
  return searchProfessorsScored(entries, rawQuery).items;
}
