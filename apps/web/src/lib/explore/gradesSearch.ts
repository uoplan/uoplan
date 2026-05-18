import Fuse from "fuse.js";
import type { IFuseOptions } from "fuse.js";
import type { CourseGradesData } from "schedule";
import { normalizeCourseCode, normalizeProfessorName } from "schedule";
import { searchProfessorsScored, type ProfessorSearchEntry } from "../graph/professorGraphSearch";
import { formatUottawaTermIdLabel } from "./uottawaTermId";

/** Max section rows returned when searching all offerings (legacy / tests). */
const EXPLORE_MAX_RESULTS = 120;

/** Max distinct courses returned from course-only explore search. */
const EXPLORE_MAX_COURSE_RESULTS = 24;

/**
 * Maps professor substring rank (0–2) to a scale comparable to Fuse scores (lower = better).
 * rank 0 ≈ 0, rank 1 ≈ 0.14, rank 2 ≈ 0.28 vs typical course scores 0–0.34.
 */
const EXPLORE_SECTION_RANK_SCALE = 0.14;

/** Cap substring pre-filter pool size before running Fuse on that subset. */
const SUBSTRING_POOL_MAX = 5000;

/** Avoid scanning the entire corpus when the needle is common (e.g. "an"). */
const SUBSTRING_MAX_SCAN = 120_000;

/** One row per distinct normalized course code — search index for explore (course-only). */
export type ExploreCourseSearchEntry = {
  normCode: string;
  courseCode: string;
  courseTitle: string;
  fuseText: string;
};

/** One row per distinct professor — search index for explore. */
export type ExploreProfessorSearchEntry = {
  groupId: string;
  legacyId?: number;
  displayName: string;
  searchText: string;
  uniqueCourseCount: number;
};

type ExploreSearchResult = {
  professors: ExploreProfessorSearchEntry[];
  courses: ExploreCourseSearchEntry[];
  professorsFirst: boolean;
};

export type ExploreOfferingFlat = {
  id: string;
  courseCode: string;
  courseTitle: string;
  professorName: string;
  legacyId?: number;
  termId: number;
  termLabel: string;
  section?: string;
  fuseText: string;
  distribution: Record<string, number>;
};

const EXPLORE_FUSE_OPTIONS: IFuseOptions<ExploreOfferingFlat> = {
  keys: ["fuseText"],
  threshold: 0.34,
  ignoreLocation: true,
  minMatchCharLength: 1,
  distance: 48,
};

const EXPLORE_COURSE_FUSE_OPTIONS: IFuseOptions<ExploreCourseSearchEntry> = {
  keys: ["fuseText"],
  threshold: 0.32,
  ignoreLocation: true,
  minMatchCharLength: 1,
  distance: 56,
};

function offeringId(parts: {
  courseCode: string;
  legacyId?: number;
  name: string;
  termId: number;
  section?: string;
}) {
  return [
    parts.courseCode,
    parts.legacyId ?? "",
    normalizeProfessorName(parts.name).toLowerCase(),
    String(parts.termId),
    parts.section ?? "",
  ].join("|");
}

export function buildExploreOfferings(
  grades: CourseGradesData,
  titleByCode: Map<string, string>,
  termNameById: Map<number, string>,
): ExploreOfferingFlat[] {
  const out: ExploreOfferingFlat[] = [];
  for (const c of grades.courses) {
    const norm = normalizeCourseCode(c.code);
    const title = titleByCode.get(norm) ?? "";
    for (const p of c.professors) {
      const termLabel = termNameById.get(p.termId) ?? formatUottawaTermIdLabel(p.termId);
      const fuseText = [
        c.code,
        norm,
        title,
        p.name,
        p.legacyId != null ? String(p.legacyId) : "",
        termLabel,
        p.section ?? "",
      ]
        .join(" ")
        .toLowerCase();

      out.push({
        id: offeringId({
          courseCode: c.code,
          legacyId: p.legacyId,
          name: p.name,
          termId: p.termId,
          section: p.section,
        }),
        courseCode: c.code,
        courseTitle: title,
        professorName: p.name,
        legacyId: p.legacyId,
        termId: p.termId,
        termLabel,
        section: p.section,
        fuseText,
        distribution: p.distribution,
      });
    }
  }
  return out;
}

export function createExploreFuse(offerings: ExploreOfferingFlat[]) {
  return new Fuse(offerings, EXPLORE_FUSE_OPTIONS);
}

export function buildCourseSearchEntries(
  offerings: ExploreOfferingFlat[],
  titleByCode?: Map<string, string> | null,
): ExploreCourseSearchEntry[] {
  const byNorm = new Map<string, ExploreCourseSearchEntry>();
  for (const o of offerings) {
    const norm = normalizeCourseCode(o.courseCode);
    if (byNorm.has(norm)) continue;
    const catalogueTitle = titleByCode?.get(norm)?.trim() ?? "";
    const title = catalogueTitle || o.courseTitle.trim();
    byNorm.set(norm, {
      normCode: norm,
      courseCode: o.courseCode,
      courseTitle: title,
      fuseText: [o.courseCode, norm, title].filter(Boolean).join(" ").toLowerCase(),
    });
  }
  return [...byNorm.values()];
}

export function createExploreCourseFuse(entries: ExploreCourseSearchEntry[]) {
  return new Fuse(entries, EXPLORE_COURSE_FUSE_OPTIONS);
}

export function buildExploreProfessorSearchEntries(
  offerings: ExploreOfferingFlat[],
): ExploreProfessorSearchEntry[] {
  return groupOfferingsByProfessor(offerings).map((g) => ({
    groupId: g.groupId,
    legacyId: g.legacyId,
    displayName: g.displayName,
    searchText: [g.displayName, g.legacyId != null ? String(g.legacyId) : ""]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
    uniqueCourseCount: new Set(g.offerings.map((o) => normalizeCourseCode(o.courseCode))).size,
  }));
}

function exploreProfessorToGraphEntry(e: ExploreProfessorSearchEntry): ProfessorSearchEntry {
  return {
    id: e.groupId,
    displayName: e.displayName,
    legacyId: e.legacyId,
    searchText: e.searchText,
  };
}

/** Sum grade bucket counts (same keys as proto distributions). */
export function mergeGradeDistributionCounts(
  dists: ReadonlyArray<Record<string, number>>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const d of dists) {
    for (const [k, v] of Object.entries(d)) {
      const n = Number(v);
      if (!Number.isFinite(n) || n <= 0) continue;
      out[k] = (out[k] ?? 0) + n;
    }
  }
  return out;
}

/**
 * Cheap substring pre-pass on a bounded scan, then Fuse only on that subset (or full index fallback).
 */
function narrowOfferingsBySubstring(
  offerings: ExploreOfferingFlat[],
  needle: string,
): ExploreOfferingFlat[] {
  const pool: ExploreOfferingFlat[] = [];
  let scanned = 0;
  for (const o of offerings) {
    if (scanned >= SUBSTRING_MAX_SCAN) break;
    scanned += 1;
    if (o.fuseText.includes(needle)) {
      pool.push(o);
      if (pool.length >= SUBSTRING_POOL_MAX) break;
    }
  }
  return pool;
}

function narrowCoursesBySubstring(
  entries: ExploreCourseSearchEntry[],
  needle: string,
): ExploreCourseSearchEntry[] {
  const pool: ExploreCourseSearchEntry[] = [];
  let scanned = 0;
  for (const e of entries) {
    if (scanned >= SUBSTRING_MAX_SCAN) break;
    scanned += 1;
    if (e.fuseText.includes(needle)) {
      pool.push(e);
      if (pool.length >= SUBSTRING_POOL_MAX) break;
    }
  }
  return pool;
}

type ExploreCourseSearchScored = {
  items: ExploreCourseSearchEntry[];
  topScore: number | null;
};

function searchExploreCoursesScored(
  fuse: Fuse<ExploreCourseSearchEntry>,
  entries: ExploreCourseSearchEntry[],
  rawQuery: string,
): ExploreCourseSearchScored {
  const q = rawQuery.trim().toLowerCase();
  if (!fuse || q.length === 0) return { items: [], topScore: null };

  const pool = narrowCoursesBySubstring(entries, q);
  const engine = pool.length > 0 ? new Fuse(pool, EXPLORE_COURSE_FUSE_OPTIONS) : fuse;

  const results = engine.search(q).slice(0, EXPLORE_MAX_COURSE_RESULTS);
  return {
    items: results.map((r) => r.item),
    topScore: results[0]?.score ?? null,
  };
}

export function searchExploreCourses(
  fuse: Fuse<ExploreCourseSearchEntry>,
  entries: ExploreCourseSearchEntry[],
  rawQuery: string,
): ExploreCourseSearchEntry[] {
  return searchExploreCoursesScored(fuse, entries, rawQuery).items;
}

export function searchExploreProfessors(
  entries: ExploreProfessorSearchEntry[],
  rawQuery: string,
): ExploreProfessorSearchEntry[] {
  return searchExploreProfessorsScored(entries, rawQuery).items;
}

function searchExploreProfessorsScored(
  entries: ExploreProfessorSearchEntry[],
  rawQuery: string,
): { items: ExploreProfessorSearchEntry[]; topRank: number | null } {
  const graphEntries = entries.map(exploreProfessorToGraphEntry);
  const byGroupId = new Map(entries.map((e) => [e.groupId, e]));
  const { items, topRank } = searchProfessorsScored(graphEntries, rawQuery);
  return {
    items: items
      .map((p) => byGroupId.get(p.id))
      .filter((e): e is ExploreProfessorSearchEntry => e != null),
    topRank,
  };
}

/** Compare best professor rank vs best course Fuse score; lower metric wins. */
export function exploreProfessorsSectionFirst(
  profTopRank: number | null,
  courseTopScore: number | null,
): boolean {
  return (
    profTopRank != null &&
    (courseTopScore == null || profTopRank * EXPLORE_SECTION_RANK_SCALE < courseTopScore)
  );
}

export function searchExplore(
  rawQuery: string,
  opts: {
    courseFuse: Fuse<ExploreCourseSearchEntry> | null;
    courseEntries: ExploreCourseSearchEntry[];
    professorEntries: ExploreProfessorSearchEntry[];
  },
): ExploreSearchResult {
  const courseScored =
    opts.courseFuse && opts.courseEntries.length > 0
      ? searchExploreCoursesScored(opts.courseFuse, opts.courseEntries, rawQuery)
      : { items: [] as ExploreCourseSearchEntry[], topScore: null as number | null };
  const { items: courses, topScore: courseTopScore } = courseScored;
  const { items: professors, topRank: profTopRank } = searchExploreProfessorsScored(
    opts.professorEntries,
    rawQuery,
  );

  const professorsFirst = exploreProfessorsSectionFirst(profTopRank, courseTopScore);

  return { professors, courses, professorsFirst };
}

export function searchExploreOfferings(
  fuse: Fuse<ExploreOfferingFlat>,
  offerings: ExploreOfferingFlat[],
  rawQuery: string,
): ExploreOfferingFlat[] {
  const q = rawQuery.trim().toLowerCase();
  if (!fuse || q.length === 0) return [];

  const pool = narrowOfferingsBySubstring(offerings, q);
  const engine = pool.length > 0 ? new Fuse(pool, EXPLORE_FUSE_OPTIONS) : fuse;

  return engine
    .search(q)
    .slice(0, EXPLORE_MAX_RESULTS)
    .map((r) => r.item);
}

export type ProfessorOfferingGroup = {
  groupId: string;
  legacyId?: number;
  displayName: string;
  offerings: ExploreOfferingFlat[];
};

export function groupOfferingsByProfessor(items: ExploreOfferingFlat[]): ProfessorOfferingGroup[] {
  const byGroup = new Map<string, ExploreOfferingFlat[]>();
  const meta = new Map<string, { legacyId?: number; displayName: string }>();

  for (const o of items) {
    const groupId =
      o.legacyId != null
        ? `id:${o.legacyId}`
        : `name:${normalizeProfessorName(o.professorName).toLowerCase()}`;
    let list = byGroup.get(groupId);
    if (!list) {
      list = [];
      byGroup.set(groupId, list);
    }
    list.push(o);

    const prev = meta.get(groupId);
    if (!prev) {
      meta.set(groupId, { legacyId: o.legacyId, displayName: o.professorName });
    }
  }

  const groups: ProfessorOfferingGroup[] = [];
  for (const [groupId, offerings] of byGroup) {
    const m = meta.get(groupId);
    if (!m) continue;
    offerings.sort((a, b) => {
      const c = a.courseCode.localeCompare(b.courseCode, "en");
      if (c !== 0) return c;
      if (b.termId !== a.termId) return b.termId - a.termId;
      return String(a.section ?? "").localeCompare(String(b.section ?? ""), "en");
    });
    groups.push({
      groupId,
      legacyId: m.legacyId,
      displayName: m.displayName,
      offerings,
    });
  }

  groups.sort((a, b) => a.displayName.localeCompare(b.displayName, "en"));
  return groups;
}

export type CourseOfferingGroup = {
  groupId: string;
  courseCode: string;
  courseTitles: string[];
  offerings: ExploreOfferingFlat[];
};

export function groupOfferingsByCourse(items: ExploreOfferingFlat[]): CourseOfferingGroup[] {
  const byGroup = new Map<string, ExploreOfferingFlat[]>();
  const titles = new Map<string, Set<string>>();

  for (const o of items) {
    const normCode = normalizeCourseCode(o.courseCode);

    // Add to group
    let list = byGroup.get(normCode);
    if (!list) {
      list = [];
      byGroup.set(normCode, list);
    }
    list.push(o);

    // Track unique titles
    let titleSet = titles.get(normCode);
    if (!titleSet) {
      titleSet = new Set();
      titles.set(normCode, titleSet);
    }
    if (o.courseTitle.trim()) {
      titleSet.add(o.courseTitle.trim());
    }
  }

  const groups: CourseOfferingGroup[] = [];
  for (const [normCode, offerings] of byGroup) {
    // Sort offerings: most recent term first, then by section
    offerings.sort((a, b) => {
      if (b.termId !== a.termId) return b.termId - a.termId;
      return String(a.section ?? "").localeCompare(String(b.section ?? ""), "en");
    });

    const courseTitles = Array.from(titles.get(normCode) ?? []);

    groups.push({
      groupId: normCode,
      courseCode: offerings[0].courseCode,
      courseTitles,
      offerings,
    });
  }

  // Sort groups alphabetically by course code
  groups.sort((a, b) => a.courseCode.localeCompare(b.courseCode, "en"));
  return groups;
}
