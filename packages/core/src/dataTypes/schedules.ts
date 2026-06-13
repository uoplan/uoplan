import {
  DayOfWeek as ProtoDayOfWeek,
  SectionStatus as ProtoSectionStatus,
} from "@uoplan/proto/data";
import type {
  Catalogue as ProtoCatalogue,
  CatalogueManifest as ProtoCatalogueManifest,
  Course as ProtoCourse,
  CourseSchedule as ProtoCourseSchedule,
  Discipline as ProtoDiscipline,
  DisciplinesData as ProtoDisciplinesData,
  Indices as ProtoIndices,
  MeetingDateRange as ProtoMeetingDateRange,
  Program as ProtoProgram,
  RateMyProfessorsData as ProtoRateMyProfessorsData,
  SchedulesData as ProtoSchedulesData,
  Term as ProtoTerm,
  TermsData as ProtoTermsData,
} from "@uoplan/proto/data";
import type {
  Catalogue,
  CatalogueManifest,
  ComponentSection,
  Course,
  CourseSchedule,
  DayOfWeekCode,
  Discipline,
  DisciplinesData,
  Indices,
  MeetingTime,
  Program,
  RateMyProfessorsData,
  SchedulesData,
  Term,
  TermsData,
} from "./domain";
import {
  fromProtoPrereq,
  fromProtoProgramRequirement,
  toProtoPrereq,
  toProtoProgramRequirement,
} from "./prereqs";
import { normalizeCourseCode } from "../utils/courseUtils";
import { dateStringToYyyymmdd, yyyymmddToDateString } from "./protoDates";
import type { NormalizedCourseCode } from "../brand";

function protoDayToCode(day: ProtoDayOfWeek): DayOfWeekCode {
  switch (day) {
    case ProtoDayOfWeek.DAY_OF_WEEK_MO:
      return "Mo";
    case ProtoDayOfWeek.DAY_OF_WEEK_TU:
      return "Tu";
    case ProtoDayOfWeek.DAY_OF_WEEK_WE:
      return "We";
    case ProtoDayOfWeek.DAY_OF_WEEK_TH:
      return "Th";
    case ProtoDayOfWeek.DAY_OF_WEEK_FR:
      return "Fr";
    case ProtoDayOfWeek.DAY_OF_WEEK_SA:
      return "Sa";
    case ProtoDayOfWeek.DAY_OF_WEEK_SU:
      return "Su";
    default:
      return "Mo";
  }
}

function codeDayToProto(day: DayOfWeekCode): ProtoDayOfWeek {
  switch (day) {
    case "Mo":
      return ProtoDayOfWeek.DAY_OF_WEEK_MO;
    case "Tu":
      return ProtoDayOfWeek.DAY_OF_WEEK_TU;
    case "We":
      return ProtoDayOfWeek.DAY_OF_WEEK_WE;
    case "Th":
      return ProtoDayOfWeek.DAY_OF_WEEK_TH;
    case "Fr":
      return ProtoDayOfWeek.DAY_OF_WEEK_FR;
    case "Sa":
      return ProtoDayOfWeek.DAY_OF_WEEK_SA;
    case "Su":
      return ProtoDayOfWeek.DAY_OF_WEEK_SU;
  }
}

function parseTermIdToNumber(termId: string): number {
  const parsed = Number.parseInt(termId, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseCourseCodeParts(courseCode: string): {
  subject: string;
  catalogNumber: string;
} {
  const normalized = courseCode.trim().replaceAll(/\s+/g, " ");
  const [subject = "", catalogNumber = ""] = normalized.split(" ");
  return { subject, catalogNumber };
}

function createCourseCodeTable(courses: Course[]): {
  table: string[];
  indexByCode: Map<NormalizedCourseCode, number>;
} {
  const table: string[] = [];
  const indexByCode = new Map<NormalizedCourseCode, number>();
  const add = (code: string) => {
    const normalized = normalizeCourseCode(code);
    if (!normalized) return;
    if (indexByCode.has(normalized)) return;
    indexByCode.set(normalized, table.length);
    table.push(normalized);
  };
  for (const course of courses) {
    add(course.code);
    for (const alias of course.aliases ?? []) add(alias);
  }
  return { table, indexByCode };
}

function courseIndexFromCode(
  indexByCode: Map<NormalizedCourseCode, number>,
  code: string,
): number | undefined {
  return indexByCode.get(normalizeCourseCode(code));
}

function codeFromCourseIndex(table: string[], index: number | undefined): NormalizedCourseCode {
  if (index === undefined) return normalizeCourseCode("");
  return normalizeCourseCode(table[index] ?? "");
}

function programKeyFromProgram(program: Program): string {
  const p = program as Program & { slug?: string; url?: string };
  if (p.slug && p.slug.trim()) return p.slug.trim();
  if (p.url && p.url.trim()) return p.url.trim();
  return p.title.trim();
}

function programUrlFromKey(key: string): string {
  if (/^https?:\/\//.test(key)) return key;
  return `https://catalogue.uottawa.ca/en/${key.replace(/^\/+/, "")}`;
}

function statusToProto(status: string | null): ProtoSectionStatus {
  if (status === "Open") return ProtoSectionStatus.SECTION_STATUS_OPEN;
  if (status === "Closed") return ProtoSectionStatus.SECTION_STATUS_CLOSED;
  return ProtoSectionStatus.SECTION_STATUS_UNSPECIFIED;
}

function statusFromProto(status: ProtoSectionStatus): string | null {
  if (status === ProtoSectionStatus.SECTION_STATUS_OPEN) return "Open";
  if (status === ProtoSectionStatus.SECTION_STATUS_CLOSED) return "Closed";
  return null;
}

export function toProtoCatalogue(input: Catalogue): ProtoCatalogue {
  const { table, indexByCode } = createCourseCodeTable(input.courses);
  return {
    courseCodes: table,
    courses: input.courses.map(
      (course): ProtoCourse => ({
        code: courseIndexFromCode(indexByCode, course.code) ?? 0,
        title: course.title,
        credits: course.credits,
        component: course.component,
        aliases: (course.aliases ?? [])
          .map((alias) => courseIndexFromCode(indexByCode, alias))
          .filter((v): v is number => v !== undefined),
        hasPrereqText: Boolean(course.prereqText),
        prerequisites: course.prerequisites ? toProtoPrereq(course.prerequisites) : undefined,
      }),
    ),
    programs: input.programs.map(
      (program): ProtoProgram => ({
        title: program.title,
        programKey: programKeyFromProgram(program),
        requirements: program.requirements.map(toProtoProgramRequirement),
      }),
    ),
  };
}

export function fromProtoCatalogue(input: ProtoCatalogue): Catalogue {
  const courseCodeTable = input.courseCodes;
  return {
    courses: input.courses.map(
      (course): Course => ({
        code: codeFromCourseIndex(courseCodeTable, course.code),
        title: course.title,
        credits: Number(course.credits),
        description: "",
        ...(course.component ? { component: course.component } : {}),
        ...(course.aliases.length > 0
          ? {
              aliases: course.aliases
                .map((alias) => codeFromCourseIndex(courseCodeTable, alias))
                .filter(Boolean),
            }
          : {}),
        ...(course.hasPrereqText ? { prereqText: "0" } : {}),
        ...(course.prerequisites ? { prerequisites: fromProtoPrereq(course.prerequisites) } : {}),
      }),
    ),
    programs: input.programs.map(
      (program): Program => ({
        title: program.title,
        url: programUrlFromKey(program.programKey),
        slug: program.programKey,
        requirements: program.requirements.map(fromProtoProgramRequirement),
      }),
    ),
  };
}

export function toProtoSchedulesData(input: SchedulesData): ProtoSchedulesData {
  const courseCodes: string[] = [];
  const indexByCode = new Map<NormalizedCourseCode, number>();
  const addCode = (code: string): number => {
    const normalized = normalizeCourseCode(code);
    const existing = indexByCode.get(normalized);
    if (existing !== undefined) return existing;
    const index = courseCodes.length;
    courseCodes.push(normalized);
    indexByCode.set(normalized, index);
    return index;
  };

  // Dictionary of distinct (start,end) meeting date ranges; each meeting stores a
  // 1-based ref (0/absent = none) instead of an inline submessage.
  const meetingDateRanges: ProtoMeetingDateRange[] = [];
  const dateRangeRefByKey = new Map<string, number>();
  const meetingDatesRefOf = (dates: [string, string] | null | undefined): number | undefined => {
    if (!dates) return undefined;
    const startYyyymmdd = dateStringToYyyymmdd(dates[0] ?? "");
    const endYyyymmdd = dateStringToYyyymmdd(dates[1] ?? "");
    const key = `${startYyyymmdd}-${endYyyymmdd}`;
    const existing = dateRangeRefByKey.get(key);
    if (existing !== undefined) return existing;
    const ref = meetingDateRanges.length + 1;
    meetingDateRanges.push({ startYyyymmdd, endYyyymmdd });
    dateRangeRefByKey.set(key, ref);
    return ref;
  };

  return {
    termId: parseTermIdToNumber(input.termId),
    courseCodes,
    totalCourses: input.totalCourses,
    totalWithSchedules: input.totalWithSchedules,
    meetingDateRanges,
    schedules: input.schedules.map(
      (schedule): ProtoCourseSchedule => ({
        course: addCode(schedule.courseCode),
        title: schedule.title ?? undefined,
        timeZone: schedule.timeZone,
        components: Object.fromEntries(
          Object.entries(schedule.components).map(([component, sections]) => [
            component,
            {
              items: sections.map((section) => ({
                section: section.section,
                sectionCode: section.sectionCode ?? undefined,
                component: section.component ?? undefined,
                session: section.session ?? undefined,
                times: section.times.map((time) => ({
                  day: codeDayToProto(time.day),
                  startMinutes: time.startMinutes,
                  endMinutes: time.endMinutes,
                  virtual: time.virtual,
                  instructor: time.instructor ?? undefined,
                  professorRef: time.professorRef,
                  meetingDatesRef: meetingDatesRefOf(time.meetingDates),
                })),
                status: statusToProto(section.status),
                predictedInstructors: (section.predictedInstructors ?? []).map((p) => ({
                  name: p.name,
                  legacyId: p.legacyId ?? undefined,
                  professorRef: p.professorRef,
                })),
              })),
            },
          ]),
        ),
      }),
    ),
  };
}

export function fromProtoSchedulesData(input: ProtoSchedulesData): SchedulesData {
  const courseCodeTable = input.courseCodes;
  const dateRanges = input.meetingDateRanges ?? [];
  const meetingDatesFromRef = (ref: number | undefined): [string, string] | null => {
    if (!ref) return null;
    const range = dateRanges[ref - 1];
    if (!range) return null;
    return [
      yyyymmddToDateString(Number(range.startYyyymmdd)),
      yyyymmddToDateString(Number(range.endYyyymmdd)),
    ];
  };
  return {
    termId: String(input.termId),
    ...(input.totalCourses !== undefined ? { totalCourses: Number(input.totalCourses) } : {}),
    ...(input.totalWithSchedules !== undefined
      ? { totalWithSchedules: Number(input.totalWithSchedules) }
      : {}),
    schedules: input.schedules.map(
      (schedule): CourseSchedule => ({
        subject: parseCourseCodeParts(codeFromCourseIndex(courseCodeTable, schedule.course))
          .subject,
        catalogNumber: parseCourseCodeParts(codeFromCourseIndex(courseCodeTable, schedule.course))
          .catalogNumber,
        courseCode: codeFromCourseIndex(courseCodeTable, schedule.course),
        title: schedule.title ?? null,
        timeZone: schedule.timeZone,
        components: Object.fromEntries(
          Object.entries(schedule.components).map(([component, list]) => [
            component,
            list.items.map(
              (section): ComponentSection => ({
                section: section.section,
                sectionCode: section.sectionCode ?? null,
                component: section.component ?? null,
                session: section.session ?? null,
                times: section.times.map(
                  (time): MeetingTime => ({
                    day: protoDayToCode(time.day),
                    startMinutes: Number(time.startMinutes),
                    endMinutes: Number(time.endMinutes),
                    virtual: time.virtual,
                    instructor: time.instructor ?? null,
                    ...(time.professorRef ? { professorRef: time.professorRef } : {}),
                    meetingDates: meetingDatesFromRef(time.meetingDatesRef),
                  }),
                ),
                status: statusFromProto(section.status),
                ...(section.predictedInstructors.length > 0
                  ? {
                      predictedInstructors: section.predictedInstructors.map((p) => ({
                        name: p.name,
                        legacyId: p.legacyId ?? null,
                        ...(p.professorRef ? { professorRef: p.professorRef } : {}),
                      })),
                    }
                  : {}),
              }),
            ),
          ]),
        ),
      }),
    ),
  };
}

export function toProtoIndices(input: Indices): ProtoIndices {
  return { courses: input.courses, programs: input.programs, disciplines: input.disciplines };
}

export function fromProtoIndices(input: ProtoIndices): Indices {
  return { courses: input.courses, programs: input.programs, disciplines: input.disciplines };
}

export function toProtoTermsData(input: TermsData): ProtoTermsData {
  return {
    terms: input.terms.map(
      (term): ProtoTerm => ({
        termId: parseTermIdToNumber(term.termId),
        name: term.name,
      }),
    ),
  };
}

export function fromProtoTermsData(input: ProtoTermsData): TermsData {
  return {
    terms: input.terms.map((term): Term => ({ termId: String(term.termId), name: term.name })),
  };
}

export function toProtoCatalogueManifest(input: CatalogueManifest): ProtoCatalogueManifest {
  return { years: input.years };
}

export function fromProtoCatalogueManifest(input: ProtoCatalogueManifest): CatalogueManifest {
  return { years: input.years.map((year) => Number(year)) };
}

export function toProtoRateMyProfessorsData(
  input: RateMyProfessorsData,
): ProtoRateMyProfessorsData {
  return {
    resultCount: input.resultCount,
    professors: input.professors.map((professor) => ({
      id: professor.id ?? "",
      legacyId: professor.legacyId,
      name: professor.name,
      rating: professor.rating ?? undefined,
      numRatings: professor.numRatings,
    })),
  };
}

export function fromProtoRateMyProfessorsData(
  input: ProtoRateMyProfessorsData,
): RateMyProfessorsData {
  return {
    resultCount: Number(input.resultCount),
    professors: input.professors.map((professor) => ({
      ...(professor.id ? { id: professor.id } : {}),
      ...(professor.legacyId !== undefined ? { legacyId: Number(professor.legacyId) } : {}),
      name: professor.name,
      rating: professor.rating ?? null,
      ...(professor.numRatings !== undefined ? { numRatings: Number(professor.numRatings) } : {}),
    })),
  };
}

export function toProtoDisciplinesData(input: DisciplinesData): ProtoDisciplinesData {
  return {
    disciplines: input.disciplines.map(
      (discipline): ProtoDiscipline => ({
        code: discipline.code,
        name: discipline.name,
        nameFr: discipline.nameFr ?? "",
      }),
    ),
  };
}

export function fromProtoDisciplinesData(input: ProtoDisciplinesData): DisciplinesData {
  return {
    disciplines: input.disciplines.map((discipline): Discipline => {
      const result: Discipline = {
        code: discipline.code,
        name: discipline.name,
        ...(discipline.nameFr ? { nameFr: discipline.nameFr } : {}),
      };
      return result;
    }),
  };
}
