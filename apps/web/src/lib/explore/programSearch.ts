import Fuse from "fuse.js";
import type { IFuseOptions } from "fuse.js";
import type { Program } from "@uoplan/core";
import { buildProgramCourseFilter, programSlug } from "@uoplan/core";

/** One row per distinct program — search index for explore. */
export type ExploreProgramSearchEntry = {
  slug: string;
  title: string;
  /** Number of concrete required course codes (for the result card). */
  courseCount: number;
  searchText: string;
};

const EXPLORE_PROGRAM_FUSE_OPTIONS: IFuseOptions<ExploreProgramSearchEntry> = {
  keys: ["title", "slug"],
  threshold: 0.34,
  ignoreLocation: true,
  minMatchCharLength: 1,
  distance: 64,
};

/** Compact lowercase program slug for a URL splat (slashes preserved). */
export function programSlugToPathParam(slug: string): string {
  return slug.replace(/^\/+/, "").replace(/\/+$/, "");
}

/** Normalise a splat path param back to a comparable program slug. */
export function parseProgramPathParam(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;
  return raw.trim().replace(/^\/+/, "").replace(/\/+$/, "");
}

/**
 * Build the explore program search index, de-duplicated by slug. The first
 * program seen for a slug wins so detail resolution and cards stay consistent.
 */
export function buildProgramSearchEntries(programs: Program[]): ExploreProgramSearchEntry[] {
  const seen = new Set<string>();
  const out: ExploreProgramSearchEntry[] = [];
  for (const program of programs) {
    const slug = programSlug(program);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    const courseCount = buildProgramCourseFilter(program).codes.size;
    out.push({
      slug,
      title: program.title,
      courseCount,
      searchText: [program.title, slug].filter(Boolean).join(" ").toLowerCase(),
    });
  }
  out.sort((a, b) => a.title.localeCompare(b.title, "en"));
  return out;
}

export function createExploreProgramFuse(entries: ExploreProgramSearchEntry[]) {
  return new Fuse(entries, EXPLORE_PROGRAM_FUSE_OPTIONS);
}

/** Cheap substring pre-pass, then Fuse over the narrowed pool (or full index). */
export function searchExplorePrograms(
  fuse: Fuse<ExploreProgramSearchEntry> | null,
  entries: ExploreProgramSearchEntry[],
  rawQuery: string,
  limit = 8,
): ExploreProgramSearchEntry[] {
  const q = rawQuery.trim().toLowerCase();
  if (!fuse || q.length === 0) return [];
  const pool = entries.filter((e) => e.searchText.includes(q));
  const engine = pool.length > 0 ? new Fuse(pool, EXPLORE_PROGRAM_FUSE_OPTIONS) : fuse;
  return engine
    .search(q)
    .slice(0, limit)
    .map((r) => r.item);
}
