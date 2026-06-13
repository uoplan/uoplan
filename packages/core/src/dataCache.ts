import type {
  Catalogue,
  Course,
  CourseSchedule,
  Discipline,
  DisciplinesData,
  Faculty,
  SchedulesData,
} from "./dataTypes";
import { getDiscipline, isWorkTermCourse, normalizeCourseCode } from "./utils/courseUtils";
import type { FacultyId, NormalizedCourseCode } from "./brand";

// Re-export for backwards compatibility
export { normalizeCourseCode } from "./utils/courseUtils";

export interface DataCache {
  getCourse(code: NormalizedCourseCode | string): Course | undefined;
  /** Returns the canonical course code for `code`, resolving aliases. Returns normalized `code` if not found. */
  resolveToCanonical(code: NormalizedCourseCode | string): NormalizedCourseCode;
  getSchedule(code: NormalizedCourseCode | string): CourseSchedule | undefined;
  getCoursesByDiscipline(discipline: string): Course[];
  getAllCourses(): Course[];
  getAllSchedules(): CourseSchedule[];
  /** Faculty for a faculty id, or undefined when unknown / no disciplines data was provided. */
  getFaculty(facultyId: FacultyId | string): Faculty | undefined;
  /** Faculty that offers a discipline (e.g. "CSI"), or undefined when unknown. */
  getFacultyForDiscipline(discipline: string): Faculty | undefined;
  /** Disciplines belonging to a faculty (empty when unknown / no disciplines data). */
  getDisciplinesByFaculty(facultyId: FacultyId | string): Discipline[];
  /** All courses whose discipline belongs to a faculty (empty when unknown). */
  getCoursesByFaculty(facultyId: FacultyId | string): Course[];
}

/**
 * Faculty lookup maps derived from {@link DisciplinesData}. When no disciplines
 * data is provided every map is empty and the cache's faculty helpers degrade to
 * "unknown" (so `faculty_elective` requirements fall back to broad candidates).
 */
interface FacultyMaps {
  facultyById: Map<string, Faculty>;
  disciplineToFacultyId: Map<string, FacultyId>;
  facultyToDisciplines: Map<string, Discipline[]>;
}

function buildFacultyMaps(disciplinesData?: DisciplinesData): FacultyMaps {
  const facultyById = new Map<string, Faculty>();
  const disciplineToFacultyId = new Map<string, FacultyId>();
  const facultyToDisciplines = new Map<string, Discipline[]>();
  if (disciplinesData) {
    for (const faculty of disciplinesData.faculties) {
      facultyById.set(faculty.id, faculty);
    }
    for (const discipline of disciplinesData.disciplines) {
      if (!discipline.facultyId) continue;
      disciplineToFacultyId.set(discipline.code.toUpperCase().trim(), discipline.facultyId);
      const list = facultyToDisciplines.get(discipline.facultyId) ?? [];
      list.push(discipline);
      facultyToDisciplines.set(discipline.facultyId, list);
    }
  }
  return { facultyById, disciplineToFacultyId, facultyToDisciplines };
}

/**
 * When merging a first-year catalogue with the latest catalogue, prerequisite
 * fields always come from the year row, stripping latest prereqs when absent.
 */
export function applyYearPrerequisites(latest: Course, year: Course): Course {
  const { prerequisites: _p, prereqText: _t, ...rest } = latest;
  return {
    ...rest,
    ...(year.prerequisites !== undefined ? { prerequisites: year.prerequisites } : {}),
    ...(year.prereqText !== undefined ? { prereqText: year.prereqText } : {}),
  };
}

export function applyLatestAliasesToMergedCourses(
  latestCourses: readonly Course[],
  mergedCourses: Course[],
): Course[] {
  const latestByCode = new Map(latestCourses.map((c) => [c.code, c]));
  return mergedCourses.map((course) => {
    const latest = latestByCode.get(course.code);
    if (!latest || latest.aliases === undefined) return course;
    return { ...course, aliases: latest.aliases };
  });
}

/**
 * Drop merged catalogue rows whose codes are listed only as `aliases` on the latest
 * catalogue (legacy renumbered courses). Keeps canonical rows so `getCourse` does not
 * return duplicate courses for old and new codes.
 */
export function removeMergedCoursesSupersededByAliases(
  latestCourses: readonly Course[],
  mergedCourses: Course[],
): Course[] {
  const supersededCodes = new Set<NormalizedCourseCode>();
  for (const c of latestCourses) {
    for (const a of c.aliases ?? []) {
      supersededCodes.add(a);
    }
  }
  return mergedCourses.filter((c) => !supersededCodes.has(c.code));
}

/**
 * Merges the latest catalogue with the start-year catalogue.
 * Latest provides programs, new courses, and metadata; year-specific
 * prerequisites override for every overlapping code. Completed courses that
 * exist in the year catalogue keep the full year row (credits/level).
 * Alias→canonical mapping is applied and superseded alias rows are removed.
 */
export function getMergedCatalogue(
  latest: Catalogue,
  yearCourses: Course[] | null,
  completedCourses: string[],
): Catalogue {
  if (!yearCourses) return latest;

  const completedSet = new Set(completedCourses.map(normalizeCourseCode));
  const yearMap = new Map(yearCourses.map((c) => [c.code, c]));
  const latestMap = new Map(latest.courses.map((c) => [c.code, c]));

  const merged = new Map<NormalizedCourseCode, Course>();

  for (const course of latest.courses) {
    const key = course.code;
    const yearCourse = yearMap.get(key);
    if (!yearCourse) {
      merged.set(key, course);
    } else if (completedSet.has(key)) {
      merged.set(key, yearCourse);
    } else {
      merged.set(key, applyYearPrerequisites(course, yearCourse));
    }
  }

  for (const course of yearCourses) {
    const key = course.code;
    if (!latestMap.has(key)) merged.set(key, course);
  }

  const mergedList = Array.from(merged.values());
  const withAliases = applyLatestAliasesToMergedCourses(latest.courses, mergedList);
  const courses = removeMergedCoursesSupersededByAliases(latest.courses, withAliases);
  return { ...latest, courses };
}

/**
 * Wrap an existing DataCache with additional courses (e.g. OPT transfer credit stubs).
 * Extra courses are included in getCourse, getCoursesByDiscipline, and getAllCourses.
 */
export function withExtraCourses(base: DataCache, courses: Course[]): DataCache {
  const extra = new Map<NormalizedCourseCode, Course>();
  const byDiscipline = new Map<string, Course[]>();

  for (const course of courses) {
    const key = course.code;
    extra.set(key, course);
    const discipline = getDiscipline(course.code);
    if (discipline) {
      const list = byDiscipline.get(discipline) ?? [];
      list.push(course);
      byDiscipline.set(discipline, list);
    }
  }

  return {
    getCourse(code) {
      return base.getCourse(code) ?? extra.get(normalizeCourseCode(code));
    },
    resolveToCanonical(code) {
      return base.resolveToCanonical(code);
    },
    getSchedule(code) {
      return base.getSchedule(code);
    },
    getCoursesByDiscipline(discipline) {
      const key = discipline.toUpperCase().trim();
      return [...base.getCoursesByDiscipline(discipline), ...(byDiscipline.get(key) ?? [])];
    },
    getAllCourses() {
      return [...base.getAllCourses(), ...extra.values()];
    },
    getAllSchedules() {
      return base.getAllSchedules();
    },
    getFaculty(facultyId) {
      return base.getFaculty(facultyId);
    },
    getFacultyForDiscipline(discipline) {
      return base.getFacultyForDiscipline(discipline);
    },
    getDisciplinesByFaculty(facultyId) {
      return base.getDisciplinesByFaculty(facultyId);
    },
    getCoursesByFaculty(facultyId) {
      return base.getCoursesByFaculty(facultyId);
    },
  };
}

export function buildDataCache(
  catalogue: Catalogue,
  schedulesData: SchedulesData,
  disciplinesData?: DisciplinesData,
): DataCache {
  const courseMap = new Map<NormalizedCourseCode, Course>();
  const scheduleMap = new Map<NormalizedCourseCode, CourseSchedule>();
  const disciplineMap = new Map<string, Course[]>();
  const eligibleCourses: Course[] = [];
  const { facultyById, disciplineToFacultyId, facultyToDisciplines } =
    buildFacultyMaps(disciplinesData);

  for (const course of catalogue.courses) {
    const key = course.code;
    courseMap.set(key, course);
    for (const alias of course.aliases ?? []) {
      courseMap.set(alias, course);
    }

    if (isWorkTermCourse(course)) {
      continue;
    }

    eligibleCourses.push(course);

    const subject = course.code.split(/\s+/)[0]?.toUpperCase() ?? "";
    if (subject) {
      const list = disciplineMap.get(subject) ?? [];
      list.push(course);
      disciplineMap.set(subject, list);
    }
  }

  for (const schedule of schedulesData.schedules) {
    const key = schedule.courseCode;
    scheduleMap.set(key, schedule);
  }

  return {
    getCourse(code: NormalizedCourseCode | string): Course | undefined {
      return courseMap.get(normalizeCourseCode(code));
    },
    resolveToCanonical(code: NormalizedCourseCode | string): NormalizedCourseCode {
      const norm = normalizeCourseCode(code);
      const course = courseMap.get(norm);
      return course ? course.code : norm;
    },
    getSchedule(code: NormalizedCourseCode | string): CourseSchedule | undefined {
      return scheduleMap.get(normalizeCourseCode(code));
    },
    getCoursesByDiscipline(discipline: string): Course[] {
      const key = discipline.toUpperCase().trim();
      return disciplineMap.get(key) ?? [];
    },
    getAllCourses(): Course[] {
      return eligibleCourses;
    },
    getAllSchedules(): CourseSchedule[] {
      return schedulesData.schedules;
    },
    getFaculty(facultyId: FacultyId | string): Faculty | undefined {
      return facultyById.get(facultyId);
    },
    getFacultyForDiscipline(discipline: string): Faculty | undefined {
      const facultyId = disciplineToFacultyId.get(discipline.toUpperCase().trim());
      return facultyId ? facultyById.get(facultyId) : undefined;
    },
    getDisciplinesByFaculty(facultyId: FacultyId | string): Discipline[] {
      return facultyToDisciplines.get(facultyId) ?? [];
    },
    getCoursesByFaculty(facultyId: FacultyId | string): Course[] {
      const disciplines = facultyToDisciplines.get(facultyId) ?? [];
      return disciplines.flatMap((d) => disciplineMap.get(d.code.toUpperCase().trim()) ?? []);
    },
  };
}
