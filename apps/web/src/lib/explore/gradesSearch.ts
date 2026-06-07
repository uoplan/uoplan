import Fuse from "fuse.js";
import type { IFuseOptions } from "fuse.js";
import type {
  Catalogue,
  CourseGradesData,
  GradeVizData,
  ProfessorRatingsMap,
  SchedulesData,
} from "@uoplan/core";
import {
  normalizeCourseCode,
  normalizeProfessorName,
  normalizeGradeVizDistribution,
  getCourseLanguageBucket,
} from "@uoplan/core";
import { searchProfessorsScored, type ProfessorSearchEntry } from "../graph/professorGraphSearch";
import { formatTermLabelPlain } from "../term/termLabelPlain";
import { getCourseLevel, getCourseDiscipline, type ExploreFilterLevel } from "./exploreFilters";

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
  gradeViz: GradeVizData | null;
  level: ExploreFilterLevel | null;
  language: "en" | "fr" | null;
  maxProfessorRating: number | null;
  /** Identifier of the alias group this course belongs to (its own normCode when standalone). */
  componentId: string;
};

/** One row per distinct professor — search index for explore. */
export type ExploreProfessorSearchEntry = {
  groupId: string;
  legacyId?: number;
  displayName: string;
  searchText: string;
  uniqueCourseCount: number;
  disciplines: string[];
  gradeViz: GradeVizData | null;
  maxRating: number | null;
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
  /** True when the section has no real instructor (e.g. the "Staff" placeholder). */
  unassignedInstructor?: boolean;
};

/**
 * Display name used for offerings without a real instructor. Kept empty so these
 * rows never surface "Staff" in search text, links, or professor indices.
 */
const UNASSIGNED_INSTRUCTOR = "";

/** Stable group id collecting every unassigned-instructor offering of a course. */
const UNASSIGNED_GROUP_ID = "unassigned";

/**
 * "Staff" is uOttawa's placeholder for an unassigned instructor. Treat it (and an
 * already-empty name) as "no professor" rather than a real person.
 */
function isUnassignedInstructorName(name: string): boolean {
  const norm = normalizeProfessorName(name).toLowerCase();
  return norm === "" || norm === "staff";
}

/** Whether an offering has no real instructor (collapsed into the unassigned group). */
function isUnassignedOffering(o: ExploreOfferingFlat): boolean {
  return o.unassignedInstructor === true || isUnassignedInstructorName(o.professorName);
}

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
): ExploreOfferingFlat[] {
  const out: ExploreOfferingFlat[] = [];
  for (const c of grades.courses) {
    const norm = normalizeCourseCode(c.code);
    const title = titleByCode.get(norm) ?? "";
    for (const p of c.professors) {
      // "Staff" is a placeholder for an unassigned instructor: keep the offering so the
      // course stays searchable, but strip the fake professor (no name, no legacyId).
      const unassigned = isUnassignedInstructorName(p.name);
      const professorName = unassigned ? UNASSIGNED_INSTRUCTOR : p.name;
      const legacyId = unassigned ? undefined : p.legacyId;
      const termLabel = formatTermLabelPlain(p.termId);
      const fuseText = [
        c.code,
        norm,
        title,
        professorName,
        legacyId != null ? String(legacyId) : "",
        termLabel,
        p.section ?? "",
      ]
        .join(" ")
        .toLowerCase();

      out.push({
        id: offeringId({
          courseCode: c.code,
          legacyId,
          name: professorName,
          termId: p.termId,
          section: p.section,
        }),
        courseCode: c.code,
        courseTitle: title,
        professorName,
        legacyId,
        termId: p.termId,
        termLabel,
        section: p.section,
        fuseText,
        distribution: p.distribution,
        unassignedInstructor: unassigned,
      });
    }
  }
  return out;
}

export function createExploreFuse(offerings: ExploreOfferingFlat[]) {
  return new Fuse(offerings, EXPLORE_FUSE_OPTIONS);
}

/** Group offerings by normalized course code in a single pass (shared lookup index). */
export function buildOfferingsByCourseNorm(
  offerings: ExploreOfferingFlat[],
): Map<string, ExploreOfferingFlat[]> {
  const byNorm = new Map<string, ExploreOfferingFlat[]>();
  for (const o of offerings) {
    const norm = normalizeCourseCode(o.courseCode);
    let list = byNorm.get(norm);
    if (!list) {
      list = [];
      byNorm.set(norm, list);
    }
    list.push(o);
  }
  return byNorm;
}

/** Count distinct professors in a set of offerings using the same grouping key as
 * {@link groupOfferingsByProfessor} (legacyId when present, else normalized name). */
export function countDistinctProfessors(offerings: ExploreOfferingFlat[]): number {
  const ids = new Set<string>();
  for (const o of offerings) {
    ids.add(
      o.legacyId != null
        ? `id:${o.legacyId}`
        : `name:${normalizeProfessorName(o.professorName).toLowerCase()}`,
    );
  }
  return ids.size;
}

/** Connected-component grouping of course codes linked by catalogue aliases. */
export type AliasGroups = {
  /** Maps each member's normalized code to its component id. Standalone courses are absent. */
  componentByNorm: Map<string, string>;
  /** Maps a component id to its sorted member normalized codes (size >= 2). */
  membersByComponent: Map<string, string[]>;
};

/**
 * Build connected components over the undirected alias graph. Each course is linked to
 * every code in its `aliases` list; the transitive closure forms a component that is
 * treated as one course. The component id is the lexicographically smallest member code
 * (deterministic). Courses with no alias relation are omitted (callers treat a missing
 * lookup as a standalone component keyed by the code itself).
 */
export function buildAliasGroups(catalogue: Catalogue | null): AliasGroups {
  const parent = new Map<string, string>();
  const add = (x: string) => {
    if (!parent.has(x)) parent.set(x, x);
  };
  const find = (x: string): string => {
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root) as string;
    let cur = x;
    while (parent.get(cur) !== root) {
      const next = parent.get(cur) as string;
      parent.set(cur, root);
      cur = next;
    }
    return root;
  };
  const union = (a: string, b: string) => {
    add(a);
    add(b);
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(rb, ra);
  };

  if (catalogue) {
    for (const c of catalogue.courses) {
      const own = normalizeCourseCode(c.code);
      add(own);
      for (const a of c.aliases ?? []) {
        const aliasNorm = normalizeCourseCode(a);
        if (aliasNorm && aliasNorm !== own) union(own, aliasNorm);
      }
    }
  }

  const membersByRoot = new Map<string, string[]>();
  for (const node of parent.keys()) {
    const root = find(node);
    let list = membersByRoot.get(root);
    if (!list) {
      list = [];
      membersByRoot.set(root, list);
    }
    list.push(node);
  }

  const componentByNorm = new Map<string, string>();
  const membersByComponent = new Map<string, string[]>();
  for (const members of membersByRoot.values()) {
    if (members.length < 2) continue;
    members.sort((a, b) => a.localeCompare(b, "en"));
    const id = members[0];
    membersByComponent.set(id, members);
    for (const m of members) componentByNorm.set(m, id);
  }
  return { componentByNorm, membersByComponent };
}

/** Resolve a normalized code to its alias-component id (the code itself when standalone). */
export function resolveComponentId(norm: string, componentByNorm: Map<string, string>): string {
  return componentByNorm.get(norm) ?? norm;
}

/** Bucket offerings by alias-component id so an alias group shares one merged offering list. */
export function buildOfferingsByComponent(
  offerings: ExploreOfferingFlat[],
  componentByNorm: Map<string, string>,
): Map<string, ExploreOfferingFlat[]> {
  const byComponent = new Map<string, ExploreOfferingFlat[]>();
  for (const o of offerings) {
    const comp = resolveComponentId(normalizeCourseCode(o.courseCode), componentByNorm);
    let list = byComponent.get(comp);
    if (!list) {
      list = [];
      byComponent.set(comp, list);
    }
    list.push(o);
  }
  return byComponent;
}

/** Keep one entry per alias component, preserving input order (caller controls ranking). */
export function dedupeCourseEntriesByComponent(
  entries: ExploreCourseSearchEntry[],
): ExploreCourseSearchEntry[] {
  const seen = new Set<string>();
  const out: ExploreCourseSearchEntry[] = [];
  for (const e of entries) {
    if (seen.has(e.componentId)) continue;
    seen.add(e.componentId);
    out.push(e);
  }
  return out;
}

export function buildCourseSearchEntries(
  offerings: ExploreOfferingFlat[],
  titleByCode?: Map<string, string> | null,
  professorRatings?: ProfessorRatingsMap | null,
  componentByNorm?: Map<string, string> | null,
  membersByComponent?: Map<string, string[]> | null,
): ExploreCourseSearchEntry[] {
  type Acc = {
    courseCode: string;
    courseTitle: string;
    dists: Record<string, number>[];
    professorNames: string[];
  };
  const byNorm = new Map<string, Acc>();
  for (const o of offerings) {
    const norm = normalizeCourseCode(o.courseCode);
    const existing = byNorm.get(norm);
    if (existing) {
      existing.dists.push(o.distribution);
      existing.professorNames.push(o.professorName);
    } else {
      const catalogueTitle = titleByCode?.get(norm)?.trim() ?? "";
      const title = catalogueTitle || o.courseTitle.trim();
      byNorm.set(norm, {
        courseCode: o.courseCode,
        courseTitle: title,
        dists: [o.distribution],
        professorNames: [o.professorName],
      });
    }
  }

  const componentIdFor = (norm: string) =>
    componentByNorm ? resolveComponentId(norm, componentByNorm) : norm;

  // Merge grade distributions and professor names across each component's member codes so
  // every member entry exposes the same combined stats ("as if the same course").
  const compDists = new Map<string, Record<string, number>[]>();
  const compProfessorNames = new Map<string, string[]>();
  for (const [norm, acc] of byNorm) {
    const id = componentIdFor(norm);
    let dists = compDists.get(id);
    if (!dists) {
      dists = [];
      compDists.set(id, dists);
    }
    for (const d of acc.dists) dists.push(d);
    let names = compProfessorNames.get(id);
    if (!names) {
      names = [];
      compProfessorNames.set(id, names);
    }
    for (const n of acc.professorNames) names.push(n);
  }

  const mergedRatingFor = (id: string): number | null => {
    if (!professorRatings) return null;
    let max: number | null = null;
    for (const name of compProfessorNames.get(id) ?? []) {
      const entry = professorRatings[normalizeProfessorName(name)];
      if (entry && Number.isFinite(entry.rating)) {
        if (max === null || entry.rating > max) max = entry.rating;
      }
    }
    return max;
  };
  const mergedVizFor = (id: string): GradeVizData | null =>
    normalizeGradeVizDistribution(mergeGradeDistributionCounts(compDists.get(id) ?? []));

  const makeEntry = (
    norm: string,
    courseCode: string,
    courseTitle: string,
  ): ExploreCourseSearchEntry => {
    const id = componentIdFor(norm);
    const langBucket = getCourseLanguageBucket(courseCode);
    return {
      normCode: norm,
      courseCode,
      courseTitle,
      fuseText: [courseCode, norm, courseTitle].filter(Boolean).join(" ").toLowerCase(),
      gradeViz: mergedVizFor(id),
      level: getCourseLevel(courseCode),
      language: langBucket === "en" || langBucket === "fr" ? langBucket : null,
      maxProfessorRating: mergedRatingFor(id),
      componentId: id,
    };
  };

  const entries: ExploreCourseSearchEntry[] = [];
  const emitted = new Set<string>();
  for (const [norm, acc] of byNorm) {
    entries.push(makeEntry(norm, acc.courseCode, acc.courseTitle));
    emitted.add(norm);
  }

  // Synthesize searchable entries for alias members that have no offerings of their own,
  // so searching an older code still surfaces the merged course.
  if (membersByComponent) {
    for (const [id, members] of membersByComponent) {
      if (!compDists.has(id)) continue;
      for (const m of members) {
        if (emitted.has(m)) continue;
        const title = titleByCode?.get(m)?.trim() ?? "";
        entries.push(makeEntry(m, m, title));
        emitted.add(m);
      }
    }
  }

  return entries;
}

export function createExploreCourseFuse(entries: ExploreCourseSearchEntry[]) {
  return new Fuse(entries, EXPLORE_COURSE_FUSE_OPTIONS);
}

export function buildExploreProfessorSearchEntries(
  offerings: ExploreOfferingFlat[],
  professorRatings?: ProfessorRatingsMap | null,
): ExploreProfessorSearchEntry[] {
  return groupOfferingsByProfessor(offerings)
    .filter((g) => !g.unassigned)
    .map((g) => {
      const rmpEntry = professorRatings?.[normalizeProfessorName(g.displayName)];
      const maxRating = rmpEntry && Number.isFinite(rmpEntry.rating) ? rmpEntry.rating : null;
      const disciplines = Array.from(
        new Set(
          g.offerings
            .map((o) => getCourseDiscipline(o.courseCode))
            .filter((d): d is string => d !== null),
        ),
      );
      return {
        groupId: g.groupId,
        legacyId: g.legacyId,
        displayName: g.displayName,
        searchText: [g.displayName, g.legacyId != null ? String(g.legacyId) : ""]
          .filter(Boolean)
          .join(" ")
          .toLowerCase(),
        uniqueCourseCount: new Set(g.offerings.map((o) => normalizeCourseCode(o.courseCode))).size,
        disciplines,
        gradeViz: normalizeGradeVizDistribution(
          mergeGradeDistributionCounts(g.offerings.map((o) => o.distribution)),
        ),
        maxRating,
      };
    });
}

/** Stable group id for an offering's professor, matching {@link groupOfferingsByProfessor}. */
function professorGroupIdForOffering(o: ExploreOfferingFlat): string {
  if (isUnassignedOffering(o)) return UNASSIGNED_GROUP_ID;
  return o.legacyId != null
    ? `id:${o.legacyId}`
    : `name:${normalizeProfessorName(o.professorName).toLowerCase()}`;
}

/**
 * Per-term presence index derived from the merged offerings. Keyed by numeric term id,
 * each set lists the course-component ids / professor-group ids that appear in that term —
 * the same identities carried by {@link ExploreCourseSearchEntry.componentId} and
 * {@link ExploreProfessorSearchEntry.groupId}, so result entries can be intersected
 * directly against a term's sets.
 */
export type TermPresenceIndex = {
  courseComponentsByTerm: Map<number, Set<string>>;
  profGroupsByTerm: Map<number, Set<string>>;
};

export function buildTermPresenceIndex(
  offerings: ExploreOfferingFlat[],
  componentByNorm?: Map<string, string> | null,
): TermPresenceIndex {
  const courseComponentsByTerm = new Map<number, Set<string>>();
  const profGroupsByTerm = new Map<number, Set<string>>();

  for (const o of offerings) {
    if (!Number.isFinite(o.termId)) continue;

    const norm = normalizeCourseCode(o.courseCode);
    const componentId = componentByNorm ? resolveComponentId(norm, componentByNorm) : norm;
    let courses = courseComponentsByTerm.get(o.termId);
    if (!courses) {
      courses = new Set();
      courseComponentsByTerm.set(o.termId, courses);
    }
    courses.add(componentId);

    // "Staff" is a placeholder for an unassigned instructor; never index it as a prof.
    if (!o.unassignedInstructor && !isUnassignedInstructorName(o.professorName)) {
      let profs = profGroupsByTerm.get(o.termId);
      if (!profs) {
        profs = new Set();
        profGroupsByTerm.set(o.termId, profs);
      }
      profs.add(professorGroupIdForOffering(o));
    }
  }

  return { courseComponentsByTerm, profGroupsByTerm };
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

  // Dedupe in score order so each alias group surfaces once via its closest-matched
  // (i.e. the user-requested) member code, then cap the result count.
  const rawResults = engine.search(q);
  const seen = new Set<string>();
  const deduped: typeof rawResults = [];
  for (const r of rawResults) {
    if (seen.has(r.item.componentId)) continue;
    seen.add(r.item.componentId);
    deduped.push(r);
    if (deduped.length >= EXPLORE_MAX_COURSE_RESULTS) break;
  }
  return {
    items: deduped.map((r) => r.item),
    topScore: deduped[0]?.score ?? null,
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
  /** True for the synthetic group collecting sections with no real instructor. */
  unassigned?: boolean;
};

export function groupOfferingsByProfessor(items: ExploreOfferingFlat[]): ProfessorOfferingGroup[] {
  const byGroup = new Map<string, ExploreOfferingFlat[]>();
  const meta = new Map<string, { legacyId?: number; displayName: string; unassigned: boolean }>();

  for (const o of items) {
    const unassigned = isUnassignedOffering(o);
    const groupId = unassigned
      ? UNASSIGNED_GROUP_ID
      : o.legacyId != null
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
      meta.set(groupId, {
        legacyId: unassigned ? undefined : o.legacyId,
        displayName: unassigned ? UNASSIGNED_INSTRUCTOR : o.professorName,
        unassigned,
      });
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
      unassigned: m.unassigned,
    });
  }

  // Real professors sorted by name; the unassigned group (if any) always sorts last.
  groups.sort((a, b) => {
    if (a.unassigned !== b.unassigned) return a.unassigned ? 1 : -1;
    return a.displayName.localeCompare(b.displayName, "en");
  });
  return groups;
}

export type CourseOfferingGroup = {
  groupId: string;
  courseCode: string;
  courseTitles: string[];
  offerings: ExploreOfferingFlat[];
};

function scheduleOfferingId(courseCode: string, name: string, termId: number) {
  return [courseCode, "", normalizeProfessorName(name).toLowerCase(), String(termId), ""].join("|");
}

/**
 * Dedup key for schedule-derived offerings, which carry no grade data and are
 * combined per professor per term (section is intentionally ignored).
 */
function scheduleOfferingDedupKey(courseCode: string, name: string, termId: number) {
  return [
    normalizeCourseCode(courseCode),
    normalizeProfessorName(name).toLowerCase(),
    String(termId),
  ].join("|");
}

export function buildScheduleOfferings(
  allSchedules: SchedulesData[],
  titleByCode: Map<string, string>,
): ExploreOfferingFlat[] {
  const seen = new Set<string>();
  const out: ExploreOfferingFlat[] = [];

  for (const schedData of allSchedules) {
    const termId = Number.parseInt(schedData.termId, 10);
    if (!Number.isFinite(termId)) continue;
    const termLabel = formatTermLabelPlain(termId);

    for (const sched of schedData.schedules) {
      const norm = normalizeCourseCode(sched.courseCode);
      const title = titleByCode.get(norm) ?? sched.title ?? "";

      // Combine all sections by professor for this course + term. Schedule data
      // has no grade distribution and its raw section labels (e.g. "M00-LEC
      // FullSess.") are not meaningful here, so collapse to one row per prof.
      const instructors = new Set<string>();
      for (const sections of Object.values(sched.components)) {
        for (const section of sections) {
          for (const t of section.times) {
            if (t.instructor) instructors.add(t.instructor);
          }
        }
      }

      for (const instructor of instructors) {
        // "Staff" means no real instructor: keep the section so the course is searchable,
        // but collapse all such sections to a single unassigned offering (no professor).
        const unassigned = isUnassignedInstructorName(instructor);
        const professorName = unassigned ? UNASSIGNED_INSTRUCTOR : instructor;

        const key = scheduleOfferingDedupKey(sched.courseCode, professorName, termId);
        if (seen.has(key)) continue;
        seen.add(key);

        const fuseText = [sched.courseCode, norm, title, professorName, termLabel]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        out.push({
          id: scheduleOfferingId(sched.courseCode, professorName, termId),
          courseCode: sched.courseCode,
          courseTitle: title,
          professorName,
          termId,
          termLabel,
          fuseText,
          distribution: {},
          unassignedInstructor: unassigned,
        });
      }
    }
  }

  return out;
}

/**
 * Maps each professor's normalized name to its grade-data legacyId, but only
 * when that name resolves to exactly one legacyId. Names shared by distinct
 * professors (multiple legacyIds) are omitted so we never mis-merge two people.
 */
function buildUnambiguousLegacyIdByName(
  gradeOfferings: ExploreOfferingFlat[],
): Map<string, number> {
  const idsByName = new Map<string, Set<number>>();
  for (const o of gradeOfferings) {
    if (o.legacyId == null) continue;
    const name = normalizeProfessorName(o.professorName).toLowerCase();
    if (!name) continue;
    let ids = idsByName.get(name);
    if (!ids) {
      ids = new Set();
      idsByName.set(name, ids);
    }
    ids.add(o.legacyId);
  }
  const out = new Map<string, number>();
  for (const [name, ids] of idsByName) {
    if (ids.size === 1) out.set(name, [...ids][0]);
  }
  return out;
}

export function mergeOfferingsWithSchedule(
  gradeOfferings: ExploreOfferingFlat[],
  scheduleOfferings: ExploreOfferingFlat[],
): ExploreOfferingFlat[] {
  // Schedule offerings have no section, while grade offerings do, so dedup by
  // (course, prof, term) ignoring section: a prof/term already present in grade
  // data should not be duplicated by a section-less schedule row.
  const gradeKeys = new Set<string>();
  for (const o of gradeOfferings) {
    gradeKeys.add(scheduleOfferingDedupKey(o.courseCode, o.professorName, o.termId));
  }
  // Backfill legacyId onto schedule rows so a professor who has grade data is not
  // split into a separate name-keyed entry by their schedule-only offerings.
  const legacyIdByName = buildUnambiguousLegacyIdByName(gradeOfferings);
  const newEntries = scheduleOfferings
    .filter(
      (o) => !gradeKeys.has(scheduleOfferingDedupKey(o.courseCode, o.professorName, o.termId)),
    )
    .map((o) => {
      if (o.legacyId != null) return o;
      const legacyId = legacyIdByName.get(normalizeProfessorName(o.professorName).toLowerCase());
      return legacyId == null ? o : { ...o, legacyId };
    });
  return [...gradeOfferings, ...newEntries];
}

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
