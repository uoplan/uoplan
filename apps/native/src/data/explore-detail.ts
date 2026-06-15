/**
 * Pure selectors for the native Explore detail screens, derived from the loaded
 * data bundle + the prebuilt explore index. Each resolves an entity by its route
 * param and the related entities the web detail pages show (a course's
 * professors, a professor's courses, a discipline's courses, a faculty's
 * disciplines). Kept side-effect-free so they're unit-testable without RN/proto.
 */
import type { CalendarEvent } from "@uoplan/calendar/types";
import { aliasSiblings, resolveComponentId, type AliasGroups } from "@uoplan/core/courseAlias";
import type {
  ComponentSection,
  CourseSchedule,
  Program,
  SchedulesData,
} from "@uoplan/core/dataTypes";
import {
  collectTimes,
  getValidSectionCombos,
  sectionHasTimes,
} from "@uoplan/core/generation/sectionCombos";
import { timesOverlap } from "@uoplan/core/generation/overlaps";
import type { GradeVizData } from "@uoplan/core/gradeDistribution";
import { distributionGpa, normalizeGradeVizDistribution } from "@uoplan/core/gradeDistribution";
import { addInto } from "@uoplan/core/gradeTrends";
import { normalizeProfessorName } from "@uoplan/core/professorRatings";
import { buildProgramCourseFilter, programSlug } from "@uoplan/core/programTrends";
import { normalizeCourseCode } from "@uoplan/core/utils/courseUtils";

import {
  type AppDataBundle,
  type ExploreCourseEntry,
  type ExploreDisciplineEntry,
  type ExploreFacultyEntry,
  type ExploreIndex,
  type ExploreProfessorEntry,
  gradedHeadcount,
} from "./explore-index";

type Distribution = Record<string, number>;
export type CourseSectionSelection = Record<string, string>;
const UNASSIGNED_PROFESSOR_REF = 0;
const UNASSIGNED_PROFESSOR_NAME = "No professor assigned";

/** RateMyProf-style quality rating for a professor, by name, if present. */
function ratingFor(bundle: AppDataBundle, name: string): number | null {
  if (!name) return null;
  return bundle.ratings[normalizeProfessorName(name)]?.rating ?? null;
}

type OfferingRecord = { termId: number; section?: string; distribution: Distribution };

/**
 * Collapse raw per-record grade rows into one offering per (term, section) —
 * pooling distributions that share the same term + section (e.g. cross-listed
 * codes) — sorted newest term first, then by section.
 */
function buildOfferings(records: readonly OfferingRecord[]): SectionOffering[] {
  const byKey = new Map<string, { termId: number; section?: string; dist: Distribution }>();
  for (const record of records) {
    const key = `${record.termId}|${record.section ?? ""}`;
    const existing = byKey.get(key);
    if (existing) {
      addInto(existing.dist, record.distribution);
    } else {
      byKey.set(key, {
        termId: record.termId,
        ...(record.section ? { section: record.section } : {}),
        dist: { ...record.distribution },
      });
    }
  }
  return [...byKey.values()]
    .map((offering) => ({
      termId: offering.termId,
      ...(offering.section ? { section: offering.section } : {}),
      graded: gradedHeadcount(offering.dist),
      gpa: distributionGpa(offering.dist),
      gradeViz: normalizeGradeVizDistribution(offering.dist),
    }))
    .sort((a, b) => b.termId - a.termId || (a.section ?? "").localeCompare(b.section ?? "", "en"));
}

/** A single (term, section) a professor taught of a course, with its own grades. */
export interface SectionOffering {
  termId: number;
  section?: string;
  graded: number;
  gpa: number | null;
  gradeViz: GradeVizData | null;
}

export interface RelatedProfessor {
  slug?: string;
  name: string;
  graded: number;
  gpa: number | null;
  rating: number | null;
  gradeViz: GradeVizData | null;
  /** Each (term, section) this professor taught of the course, newest term first. */
  offerings?: SectionOffering[];
}

export interface RelatedCourse {
  code: string;
  title: string;
  graded: number;
  gpa: number | null;
  gradeViz: GradeVizData | null;
  /** Each (term, section) the professor taught of this course, newest term first. */
  offerings?: SectionOffering[];
}

export interface CourseDetail {
  course: ExploreCourseEntry;
  professors: RelatedProfessor[];
  /** Other codes in the same alias group that have their own page ("also known as"). */
  aliasCodes: string[];
}

export interface ProfessorDetail {
  professor: ExploreProfessorEntry;
  courses: RelatedCourse[];
}

export interface DisciplineDetail {
  discipline: ExploreDisciplineEntry;
  courses: ExploreCourseEntry[];
}

export interface FacultyDetail {
  faculty: ExploreFacultyEntry;
  disciplines: ExploreDisciplineEntry[];
}

export interface ProgramDetail {
  program: Program;
  slug: string;
  coreCourses: RelatedCourse[];
  requirementCount: number;
}

export interface CourseScheduleDetail {
  termId: string;
  course: CourseSchedule;
  events: CalendarEvent[];
  sectionCount: number;
  meetingCount: number;
}

type RouteParam = string | string[] | null | undefined;

function routeParamText(raw: RouteParam): string | null {
  if (Array.isArray(raw)) {
    const joined = raw.filter((part) => part.trim().length > 0).join("/");
    return joined.length > 0 ? joined : null;
  }
  const trimmed = raw?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

export function parseProgramSlugParam(raw: RouteParam): string | null {
  const text = routeParamText(raw);
  if (!text) return null;
  const slug = text.replace(/^\/+/, "").replace(/\/+$/, "");
  return slug.length > 0 ? slug : null;
}

function parseCourseCodeParam(raw: RouteParam): string | null {
  const text = routeParamText(raw);
  if (!text) return null;
  const normalized = normalizeCourseCode(text);
  return /^[A-Z]{3,4}\s+\d{4,5}[A-Z]?$/u.test(normalized) ? normalized : null;
}

export function courseScheduleSectionId(section: ComponentSection): string {
  return section.sectionCode ?? section.section;
}

function isKnownInstructor(name: string | null | undefined): name is string {
  if (!name) return false;
  const trimmed = name.trim();
  if (!trimmed) return false;
  return !/^(staff|tba|to be announced|unknown)$/iu.test(trimmed);
}

const DAY_ORDER: Record<CalendarEvent["day"], number> = {
  Mo: 0,
  Tu: 1,
  We: 2,
  Th: 3,
  Fr: 4,
  Sa: 5,
  Su: 6,
};

function selectedSectionForComponent(
  course: CourseSchedule,
  selection: CourseSectionSelection,
  component: string,
): ComponentSection | null {
  const selectedId = selection[component];
  if (!selectedId) return null;
  return (
    (course.components[component] ?? []).find(
      (section) => courseScheduleSectionId(section) === selectedId,
    ) ?? null
  );
}

/** Pick one section per component: first valid no-overlap combo, else first timed section, else first listed. */
export function defaultCourseSectionSelection(course: CourseSchedule): CourseSectionSelection {
  const selection: CourseSectionSelection = {};
  for (const [component, sections] of Object.entries(course.components)) {
    const pick = sections.find(sectionHasTimes) ?? sections[0];
    if (pick) selection[component] = courseScheduleSectionId(pick);
  }

  const combos = getValidSectionCombos(course);
  if (combos[0]) {
    for (const [component, { section }] of Object.entries(combos[0])) {
      selection[component] = courseScheduleSectionId(section);
    }
  }

  return selection;
}

/** True when this section would overlap a selected section in a different component. */
export function sectionOverlapsSelection(
  course: CourseSchedule,
  selection: CourseSectionSelection,
  component: string,
  section: ComponentSection,
): boolean {
  const otherSections = Object.keys(course.components)
    .filter((key) => key !== component)
    .map((key) => selectedSectionForComponent(course, selection, key))
    .filter((selected): selected is ComponentSection => selected !== null);
  const otherTimes = collectTimes(otherSections);
  if (otherTimes.length === 0) return false;

  return collectTimes([section]).some((time) =>
    otherTimes.some((other) => timesOverlap(time, other)),
  );
}

function sortedCourseScheduleEvents(events: CalendarEvent[]): CalendarEvent[] {
  return events.sort((a, b) => {
    const day = DAY_ORDER[a.day] - DAY_ORDER[b.day];
    if (day !== 0) return day;
    const start = a.startMinutes - b.startMinutes;
    if (start !== 0) return start;
    return a.componentSection.localeCompare(b.componentSection, "en");
  });
}

function eventsForSectionEntries(
  course: CourseSchedule,
  entries: Array<{ component: string; section: ComponentSection }>,
  courseFallbackDistribution?: Record<string, number> | null,
): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  for (const { component, section } of entries) {
    const id = courseScheduleSectionId(section);
    const instructors = [
      ...new Set(section.times.map((time) => time.instructor).filter(isKnownInstructor)),
    ];
    const professor = (
      instructors.length > 0 ? instructors.join(", ") : "Staff"
    ) as CalendarEvent["professor"];
    const predictedInstructors =
      instructors.length === 0 && section.predictedInstructors?.length
        ? section.predictedInstructors.map((instructor) => ({
            name: instructor.name as CalendarEvent["professor"],
            legacyId: instructor.legacyId,
          }))
        : undefined;
    const gradeViz =
      normalizeGradeVizDistribution(section.distribution ?? null) ??
      normalizeGradeVizDistribution(courseFallbackDistribution);

    let validTimeIndex = 0;
    for (const time of section.times) {
      if (time.startMinutes >= time.endMinutes) continue;
      events.push({
        id: `${course.courseCode}-${component}-${id}-${validTimeIndex}`,
        courseCode: course.courseCode,
        enrollmentIndex: 0,
        day: time.day,
        startMinutes: time.startMinutes,
        endMinutes: time.endMinutes,
        componentSection: `${component} - ${id}`,
        virtual: Boolean(time.virtual),
        professor,
        ...(predictedInstructors ? { predictedInstructors } : {}),
        ...(gradeViz ? { gradeViz } : {}),
        meetingDates: time.meetingDates ?? null,
      });
      validTimeIndex += 1;
    }
  }

  return sortedCourseScheduleEvents(events);
}

/** Flatten only the currently selected sections into native WeekCalendar events. */
export function selectedCourseScheduleEvents(
  course: CourseSchedule,
  selection: CourseSectionSelection,
  courseFallbackDistribution?: Record<string, number> | null,
): CalendarEvent[] {
  const entries = Object.keys(course.components)
    .sort((a, b) => a.localeCompare(b, "en"))
    .map((component) => {
      const section = selectedSectionForComponent(course, selection, component);
      return section ? { component, section } : null;
    })
    .filter((entry): entry is { component: string; section: ComponentSection } => entry !== null);

  return eventsForSectionEntries(course, entries, courseFallbackDistribution);
}

/** A program and its concrete required course codes from the catalogue tree. */
export function programDetail(
  bundle: AppDataBundle,
  index: ExploreIndex,
  slugParam: RouteParam,
): ProgramDetail | null {
  const slug = parseProgramSlugParam(slugParam);
  if (!slug) return null;

  const program = bundle.catalogue.programs.find((p) => programSlug(p) === slug) ?? null;
  if (!program) return null;

  const titleByCode = new Map(
    bundle.catalogue.courses.map((course) => [normalizeCourseCode(course.code), course.title]),
  );
  const entryByCode = new Map(
    index.courses.map((course) => [normalizeCourseCode(course.code), course]),
  );
  const coreCodes = [...buildProgramCourseFilter(program).codes].sort((a, b) =>
    a.localeCompare(b, "en"),
  );

  const coreCourses = coreCodes.map((code): RelatedCourse => {
    const entry = entryByCode.get(code);
    return {
      code,
      title: entry?.title ?? titleByCode.get(code) ?? code,
      graded: entry?.graded ?? 0,
      gpa: entry?.gpa ?? null,
      gradeViz: entry?.gradeViz ?? null,
    };
  });

  return {
    program,
    slug,
    coreCourses,
    requirementCount: program.requirements.length,
  };
}

/** Flatten one course's section meeting times into native WeekCalendar events. */
export function courseScheduleEvents(course: CourseSchedule): CalendarEvent[] {
  const entries: Array<{ component: string; section: ComponentSection }> = [];
  const components = Object.keys(course.components).sort((a, b) => a.localeCompare(b, "en"));

  for (const component of components) {
    const sections = course.components[component] ?? [];
    for (const section of sections) {
      entries.push({ component, section });
    }
  }

  return eventsForSectionEntries(course, entries);
}

/** Resolve a course schedule in the requested term, or newest loaded term. */
export function courseScheduleDetail(
  schedulesByTerm: ReadonlyMap<string, SchedulesData>,
  codeParam: RouteParam,
  termParam?: RouteParam,
): CourseScheduleDetail | null {
  const code = parseCourseCodeParam(codeParam);
  if (!code) return null;

  const requestedTerm = routeParamText(termParam);
  const candidates = requestedTerm
    ? [[requestedTerm, schedulesByTerm.get(requestedTerm)]].filter(
        (entry): entry is [string, SchedulesData] => entry[1] != null,
      )
    : [...schedulesByTerm.entries()].sort((a, b) => Number(b[0]) - Number(a[0]));

  for (const [termId, schedules] of candidates) {
    const course =
      schedules.schedules.find((entry) => normalizeCourseCode(entry.courseCode) === code) ?? null;
    if (!course) continue;
    const events = courseScheduleEvents(course);
    const sectionCount = Object.values(course.components).reduce(
      (count, sections) => count + sections.length,
      0,
    );
    return {
      termId: schedules.termId || termId,
      course,
      events,
      sectionCount,
      meetingCount: events.length,
    };
  }

  return null;
}

/** Term ids (newest first) for which the given course has loaded schedule data. */
export function courseScheduleTerms(
  schedulesByTerm: ReadonlyMap<string, SchedulesData>,
  codeParam: RouteParam,
): number[] {
  const code = parseCourseCodeParam(codeParam);
  if (!code) return [];

  const terms = new Set<number>();
  for (const [termKey, schedules] of schedulesByTerm.entries()) {
    const offered = schedules.schedules.some(
      (entry) => normalizeCourseCode(entry.courseCode) === code,
    );
    if (!offered) continue;
    const termId = Number(schedules.termId || termKey);
    if (Number.isFinite(termId)) terms.add(termId);
  }

  return [...terms].sort((a, b) => b - a);
}

/** A course + the professors who have taught it (aggregated over all terms). */
export function courseDetail(
  bundle: AppDataBundle,
  index: ExploreIndex,
  code: string,
  aliasGroups: AliasGroups | null = null,
): CourseDetail | null {
  const course = index.courses.find((c) => c.code === code);
  if (!course) return null;

  // Pool grades across the whole alias group (cross-listed codes are one course),
  // mirroring the web explore page. Standalone courses resolve to just themselves.
  const urlNorm = normalizeCourseCode(code);
  const componentId = aliasGroups
    ? resolveComponentId(urlNorm, aliasGroups.componentByNorm)
    : urlNorm;
  const memberNorms = aliasGroups?.membersByComponent.get(componentId) ?? [urlNorm];
  const memberSet = new Set<string>(memberNorms);

  const byRef = new Map<number, Distribution>();
  const nameByRef = new Map<number, string>();
  const recordsByRef = new Map<number, OfferingRecord[]>();
  for (const c of bundle.grades.courses) {
    if (!memberSet.has(normalizeCourseCode(c.code))) continue;
    for (const prof of c.sections) {
      const sectionName = prof.name?.trim() ?? "";
      const ref =
        prof.professorRef && prof.professorRef > 0
          ? prof.professorRef
          : sectionName
            ? null
            : UNASSIGNED_PROFESSOR_REF;
      if (ref == null) continue;
      const dist = byRef.get(ref) ?? {};
      addInto(dist, prof.distribution);
      byRef.set(ref, dist);
      if (!nameByRef.has(ref)) {
        nameByRef.set(
          ref,
          ref === UNASSIGNED_PROFESSOR_REF ? UNASSIGNED_PROFESSOR_NAME : sectionName,
        );
      }
      const records = recordsByRef.get(ref) ?? [];
      records.push({
        termId: prof.termId,
        ...(prof.section ? { section: prof.section } : {}),
        distribution: prof.distribution,
      });
      recordsByRef.set(ref, records);
    }
  }

  const professors: RelatedProfessor[] = [...byRef.entries()]
    .map(([ref, dist]) => {
      const entry = ref > 0 ? bundle.professors[ref - 1] : undefined;
      const name = entry?.name ?? nameByRef.get(ref) ?? "";
      return {
        slug: entry?.slug,
        name,
        graded: gradedHeadcount(dist),
        gpa: distributionGpa(dist),
        rating: ref > 0 ? (entry?.rating ?? ratingFor(bundle, name)) : null,
        gradeViz: normalizeGradeVizDistribution(dist),
        offerings: buildOfferings(recordsByRef.get(ref) ?? []),
      };
    })
    .filter((p) => p.name.length > 0)
    .sort((a, b) => b.graded - a.graded);

  // Sibling codes that have their own explore page, for the "also known as" note.
  const indexNorms = new Set(index.courses.map((c) => normalizeCourseCode(c.code)));
  const aliasCodes = aliasGroups
    ? aliasSiblings(urlNorm, aliasGroups).filter((m) => indexNorms.has(m))
    : [];

  return { course, professors, aliasCodes };
}

/** A professor + the courses they have taught (aggregated over all terms). */
export function professorDetail(
  bundle: AppDataBundle,
  index: ExploreIndex,
  slug: string,
): ProfessorDetail | null {
  const professor = index.professors.find((p) => p.slug === slug);
  if (!professor) return null;

  const refIndex = bundle.professors.findIndex((e) => e.slug === slug);
  const ref = refIndex >= 0 ? refIndex + 1 : -1;

  const titleByCode = new Map(index.courses.map((c) => [c.code, c.title] as const));
  const byCourse = new Map<string, Distribution>();
  const recordsByCourse = new Map<string, OfferingRecord[]>();
  if (ref > 0) {
    for (const c of bundle.grades.courses) {
      for (const prof of c.sections) {
        if (prof.professorRef !== ref) continue;
        const dist = byCourse.get(c.code) ?? {};
        addInto(dist, prof.distribution);
        byCourse.set(c.code, dist);
        const records = recordsByCourse.get(c.code) ?? [];
        records.push({
          termId: prof.termId,
          ...(prof.section ? { section: prof.section } : {}),
          distribution: prof.distribution,
        });
        recordsByCourse.set(c.code, records);
      }
    }
  }

  const courses: RelatedCourse[] = [...byCourse.entries()]
    .map(([code, dist]) => ({
      code,
      title: titleByCode.get(code) ?? code,
      graded: gradedHeadcount(dist),
      gpa: distributionGpa(dist),
      gradeViz: normalizeGradeVizDistribution(dist),
      offerings: buildOfferings(recordsByCourse.get(code) ?? []),
    }))
    .sort((a, b) => b.graded - a.graded);

  return { professor, courses };
}

/** A discipline + its courses (highest graded volume first). */
export function disciplineDetail(index: ExploreIndex, code: string): DisciplineDetail | null {
  const upper = code.toUpperCase();
  const discipline = index.disciplines.find((d) => d.code.toUpperCase() === upper);
  if (!discipline) return null;
  const courses = index.courses
    .filter((c) => c.discipline === upper)
    .sort((a, b) => b.graded - a.graded);
  return { discipline, courses };
}

/**
 * Professors-per-course for every course in a discipline, in ONE pass over the
 * grades dataset (so the discipline accordion can expand a course to its
 * professor breakdown without an O(courses × grades) rescan). Keyed by course
 * code; each value is the professor list sorted by graded volume.
 */
export function disciplineCourseProfessors(
  bundle: AppDataBundle,
  code: string,
): Map<string, RelatedProfessor[]> {
  const upper = code.toUpperCase();
  const byCourse = new Map<string, Map<number, Distribution>>();
  const nameByRef = new Map<number, string>();
  for (const c of bundle.grades.courses) {
    const prefix = c.code.split(" ")[0]?.toUpperCase();
    if (prefix !== upper) continue;
    let refs = byCourse.get(c.code);
    if (!refs) {
      refs = new Map();
      byCourse.set(c.code, refs);
    }
    for (const prof of c.sections) {
      const sectionName = prof.name?.trim() ?? "";
      const ref =
        prof.professorRef && prof.professorRef > 0
          ? prof.professorRef
          : sectionName
            ? null
            : UNASSIGNED_PROFESSOR_REF;
      if (ref == null) continue;
      const dist = refs.get(ref) ?? {};
      addInto(dist, prof.distribution);
      refs.set(ref, dist);
      if (!nameByRef.has(ref)) {
        nameByRef.set(
          ref,
          ref === UNASSIGNED_PROFESSOR_REF ? UNASSIGNED_PROFESSOR_NAME : sectionName,
        );
      }
    }
  }

  const out = new Map<string, RelatedProfessor[]>();
  for (const [courseCode, refs] of byCourse) {
    const profs: RelatedProfessor[] = [...refs.entries()]
      .map(([ref, dist]) => {
        const entry = ref > 0 ? bundle.professors[ref - 1] : undefined;
        const name = entry?.name ?? nameByRef.get(ref) ?? "";
        return {
          slug: entry?.slug,
          name,
          graded: gradedHeadcount(dist),
          gpa: distributionGpa(dist),
          rating: ref > 0 ? (entry?.rating ?? ratingFor(bundle, name)) : null,
          gradeViz: normalizeGradeVizDistribution(dist),
        };
      })
      .filter((p) => p.name.length > 0)
      .sort((a, b) => b.graded - a.graded);
    out.set(courseCode, profs);
  }
  return out;
}

/** A faculty + its disciplines (highest graded volume first). */
export function facultyDetail(index: ExploreIndex, id: string): FacultyDetail | null {
  const faculty = index.faculties.find((f) => f.id === id);
  if (!faculty) return null;
  const disciplines = index.disciplines
    .filter((d) => d.facultyId === id)
    .sort((a, b) => b.graded - a.graded);
  return { faculty, disciplines };
}
