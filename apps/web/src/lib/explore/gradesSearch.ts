import Fuse from "fuse.js";
import type { IFuseOptions } from "fuse.js";
import type {
  Catalogue,
  CanonicalProfessorName,
  CourseGradesData,
  GradeVizData,
  NormalizedCourseCode,
  ProfessorRatingsMap,
  ProfessorRegistry,
} from "@uoplan/core";
import {
  normalizeCourseCode,
  normalizeProfessorName,
  normalizeGradeVizDistribution,
  getCourseLanguageBucket,
  professorIndexFromRef,
} from "@uoplan/core";
import { searchProfessorsScored, type ProfessorSearchEntry } from "../graph/professorGraphSearch";
import { formatTermLabelPlain } from "../term/termLabelPlain";
import { getCourseLevel, getCourseDiscipline, type ExploreFilterLevel } from "./exploreFilters";
import {
  type ExploreOfferingFlat,
  UNASSIGNED_GROUP_ID,
  UNASSIGNED_INSTRUCTOR,
  isUnassignedInstructorName,
  isUnassignedOffering,
  professorGroupId,
  resolveCanonicalProfessor,
} from "./offeringTypes";
import {
  type ProfessorOfferingGroup,
  type CourseOfferingGroup,
  groupOfferingsByProfessor,
  groupOfferingsByCourse,
  buildScheduleOfferings,
  mergeOfferingsWithSchedule,
} from "./offeringGroups";

export type { ExploreOfferingFlat } from "./offeringTypes";
export type { ProfessorOfferingGroup, CourseOfferingGroup };
export {
  groupOfferingsByProfessor,
  groupOfferingsByCourse,
  buildScheduleOfferings,
  mergeOfferingsWithSchedule,
};

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
  normCode: NormalizedCourseCode;
  courseCode: NormalizedCourseCode;
  courseTitle: string;
  fuseText: string;
  gradeViz: GradeVizData | null;
  level: ExploreFilterLevel | null;
  language: "en" | "fr" | null;
  maxProfessorRating: number | null;
  /** Identifier of the alias group this course belongs to (its own normCode when standalone). */
  componentId: NormalizedCourseCode;
};

/** One row per distinct professor — search index for explore. */
export type ExploreProfessorSearchEntry = {
  groupId: string;
  legacyId?: number;
  /** 0-based canonical registry index, when resolved. */
  professorRef?: number;
  /** URL slug for the canonical professor, when resolved from the registry. */
  slug?: string;
  displayName: CanonicalProfessorName;
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
  registry?: ProfessorRegistry | null,
): ExploreOfferingFlat[] {
  const out: ExploreOfferingFlat[] = [];
  for (const c of grades.courses) {
    const norm = normalizeCourseCode(c.code);
    const title = titleByCode.get(norm) ?? "";
    for (const p of c.professors) {
      // "Staff" is a placeholder for an unassigned instructor: keep the offering so the
      // course stays searchable, but strip the fake professor (no name, no legacyId).
      const unassigned = isUnassignedInstructorName(p.name);
      const canonical = unassigned
        ? { professorName: UNASSIGNED_INSTRUCTOR }
        : resolveCanonicalProfessor(
            registry,
            professorIndexFromRef(p.professorRef),
            p.legacyId,
            p.name,
          );
      const professorName = canonical.professorName;
      const professorRef = canonical.professorRef;
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
        ...(professorRef != null ? { professorRef } : {}),
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
 * {@link groupOfferingsByProfessor} (registry index when present, else legacyId, else name). */
export function countDistinctProfessors(offerings: ExploreOfferingFlat[]): number {
  const ids = new Set<string>();
  for (const o of offerings) {
    ids.add(professorGroupId(o.professorRef, o.legacyId, o.professorName));
  }
  return ids.size;
}

/** Connected-component grouping of course codes linked by catalogue aliases. */
export type AliasGroups = {
  /** Maps each member's normalized code to its component id. Standalone courses are absent. */
  componentByNorm: Map<NormalizedCourseCode, NormalizedCourseCode>;
  /** Maps a component id to its sorted member normalized codes (size >= 2). */
  membersByComponent: Map<NormalizedCourseCode, NormalizedCourseCode[]>;
};

/**
 * Build connected components over the undirected alias graph. Each course is linked to
 * every code in its `aliases` list; the transitive closure forms a component that is
 * treated as one course. The component id is the lexicographically smallest member code
 * (deterministic). Courses with no alias relation are omitted (callers treat a missing
 * lookup as a standalone component keyed by the code itself).
 */
export function buildAliasGroups(catalogue: Catalogue | null): AliasGroups {
  const parent = new Map<NormalizedCourseCode, NormalizedCourseCode>();
  const add = (x: NormalizedCourseCode) => {
    if (!parent.has(x)) parent.set(x, x);
  };
  const find = (x: NormalizedCourseCode): NormalizedCourseCode => {
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root) as NormalizedCourseCode;
    let cur = x;
    while (parent.get(cur) !== root) {
      const next = parent.get(cur) as NormalizedCourseCode;
      parent.set(cur, root);
      cur = next;
    }
    return root;
  };
  const union = (a: NormalizedCourseCode, b: NormalizedCourseCode) => {
    add(a);
    add(b);
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(rb, ra);
  };

  if (catalogue) {
    for (const c of catalogue.courses) {
      const own = c.code;
      add(own);
      for (const a of c.aliases ?? []) {
        const aliasNorm = normalizeCourseCode(a);
        if (aliasNorm && aliasNorm !== own) union(own, aliasNorm);
      }
    }
  }

  const membersByRoot = new Map<NormalizedCourseCode, NormalizedCourseCode[]>();
  for (const node of parent.keys()) {
    const root = find(node);
    let list = membersByRoot.get(root);
    if (!list) {
      list = [];
      membersByRoot.set(root, list);
    }
    list.push(node);
  }

  const componentByNorm = new Map<NormalizedCourseCode, NormalizedCourseCode>();
  const membersByComponent = new Map<NormalizedCourseCode, NormalizedCourseCode[]>();
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
export function resolveComponentId(
  norm: NormalizedCourseCode,
  componentByNorm: Map<NormalizedCourseCode, NormalizedCourseCode>,
): NormalizedCourseCode {
  return componentByNorm.get(norm) ?? norm;
}

/** Bucket offerings by alias-component id so an alias group shares one merged offering list. */
export function buildOfferingsByComponent(
  offerings: ExploreOfferingFlat[],
  componentByNorm: Map<NormalizedCourseCode, NormalizedCourseCode>,
): Map<NormalizedCourseCode, ExploreOfferingFlat[]> {
  const byComponent = new Map<NormalizedCourseCode, ExploreOfferingFlat[]>();
  for (const o of offerings) {
    const comp = resolveComponentId(o.courseCode, componentByNorm);
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
  const seen = new Set<NormalizedCourseCode>();
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
  componentByNorm?: Map<NormalizedCourseCode, NormalizedCourseCode> | null,
  membersByComponent?: Map<NormalizedCourseCode, NormalizedCourseCode[]> | null,
): ExploreCourseSearchEntry[] {
  type Acc = {
    courseCode: NormalizedCourseCode;
    courseTitle: string;
    dists: Record<string, number>[];
    professorNames: string[];
  };
  const byNorm = new Map<NormalizedCourseCode, Acc>();
  for (const o of offerings) {
    const norm = o.courseCode;
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

  const componentIdFor = (norm: NormalizedCourseCode): NormalizedCourseCode =>
    componentByNorm ? resolveComponentId(norm, componentByNorm) : norm;

  // Merge grade distributions and professor names across each component's member codes so
  // every member entry exposes the same combined stats ("as if the same course").
  const compDists = new Map<NormalizedCourseCode, Record<string, number>[]>();
  const compProfessorNames = new Map<NormalizedCourseCode, string[]>();
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

  const mergedRatingFor = (id: NormalizedCourseCode): number | null => {
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
  const mergedVizFor = (id: NormalizedCourseCode): GradeVizData | null =>
    normalizeGradeVizDistribution(mergeGradeDistributionCounts(compDists.get(id) ?? []));

  const makeEntry = (
    norm: NormalizedCourseCode,
    courseCode: NormalizedCourseCode,
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
  const emitted = new Set<NormalizedCourseCode>();
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
  registry?: ProfessorRegistry | null,
): ExploreProfessorSearchEntry[] {
  return groupOfferingsByProfessor(offerings, registry)
    .filter((g) => !g.unassigned)
    .map((g) => {
      const entry = g.professorRef != null ? registry?.entries[g.professorRef] : null;
      const rmpEntry = professorRatings?.[normalizeProfessorName(g.displayName)];
      const maxRating =
        entry?.rating != null && Number.isFinite(entry.rating)
          ? entry.rating
          : rmpEntry && Number.isFinite(rmpEntry.rating)
            ? rmpEntry.rating
            : null;
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
        ...(g.professorRef != null ? { professorRef: g.professorRef } : {}),
        ...(entry?.slug ? { slug: entry.slug } : {}),
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
  return professorGroupId(o.professorRef, o.legacyId, o.professorName);
}

/**
 * Per-term presence index derived from the merged offerings. Keyed by numeric term id,
 * each set lists the course-component ids / professor-group ids that appear in that term —
 * the same identities carried by {@link ExploreCourseSearchEntry.componentId} and
 * {@link ExploreProfessorSearchEntry.groupId}, so result entries can be intersected
 * directly against a term's sets.
 */
export type TermPresenceIndex = {
  courseComponentsByTerm: Map<number, Set<NormalizedCourseCode>>;
  profGroupsByTerm: Map<number, Set<string>>;
};

export function buildTermPresenceIndex(
  offerings: ExploreOfferingFlat[],
  componentByNorm?: Map<NormalizedCourseCode, NormalizedCourseCode> | null,
): TermPresenceIndex {
  const courseComponentsByTerm = new Map<number, Set<NormalizedCourseCode>>();
  const profGroupsByTerm = new Map<number, Set<string>>();

  for (const o of offerings) {
    if (!Number.isFinite(o.termId)) continue;

    const norm = o.courseCode;
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
 * Aggregate grade distribution across a set of normalized course codes (used for the
 * explore discipline / program cards). Returns null when none of the codes have offerings.
 */
export function aggregateGradeVizForCourseNorms(
  offeringsByCourseNorm: Map<string, ExploreOfferingFlat[]>,
  norms: Iterable<string>,
): GradeVizData | null {
  const dists: Record<string, number>[] = [];
  for (const norm of norms) {
    const list = offeringsByCourseNorm.get(norm);
    if (!list) continue;
    for (const o of list) dists.push(o.distribution);
  }
  if (dists.length === 0) return null;
  return normalizeGradeVizDistribution(mergeGradeDistributionCounts(dists));
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
