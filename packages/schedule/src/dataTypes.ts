import {
  CoursePrereqNodeType,
  DayOfWeek as ProtoDayOfWeek,
  RequirementType,
  SectionStatus as ProtoSectionStatus,
} from "./proto/data";
import type {
  Catalogue as ProtoCatalogue,
  CatalogueManifest as ProtoCatalogueManifest,
  Course as ProtoCourse,
  CourseIndex as ProtoCourseIndex,
  CoursePrereqNode as ProtoCoursePrereqNode,
  CourseSchedule as ProtoCourseSchedule,
  DisciplineLevel as ProtoDisciplineLevel,
  Indices as ProtoIndices,
  Program as ProtoProgram,
  ProgramRequirement as ProtoProgramRequirement,
  RateMyProfessorsData as ProtoRateMyProfessorsData,
  SchedulesData as ProtoSchedulesData,
  Term as ProtoTerm,
  TermsData as ProtoTermsData,
} from "./proto/data";

export type CoursePrereqDisciplineLevel = {
  discipline: string;
  levels?: number[];
};

export type CoursePrereqNode = {
  type: "course" | "or_group" | "and_group" | "non_course";
  code?: string;
  text?: string;
  credits?: number;
  disciplines?: string[];
  levels?: number[];
  disciplineLevels?: CoursePrereqDisciplineLevel[];
  programs?: string[];
  children?: CoursePrereqNode[];
};

export type Course = {
  code: string;
  title: string;
  credits: number;
  description: string;
  component?: string;
  aliases?: string[];
  prereqText?: string;
  prerequisites?: CoursePrereqNode;
};

export type ProgramRequirement = {
  type:
    | "course"
    | "elective"
    | "group"
    | "pick"
    | "options_group"
    | "discipline_elective"
    | "free_elective"
    | "non_discipline_elective"
    | "faculty_elective"
    | "section"
    | "and"
    | "or_group"
    | "or_course";
  title?: string;
  code?: string;
  credits?: number;
  disciplineLevels?: Array<{ discipline: string; levels?: number[] }>;
  excluded_disciplines?: string[];
  faculty?: string;
  indented?: boolean;
  options?: ProgramRequirement[];
};

export type Program = {
  title: string;
  url: string;
  slug?: string;
  requirements: ProgramRequirement[];
};

export type Catalogue = {
  courses: Course[];
  programs: Program[];
};

export type DayOfWeekCode = "Mo" | "Tu" | "We" | "Th" | "Fr" | "Sa" | "Su";
export type DayOfWeek = DayOfWeekCode;

export type MeetingTime = {
  day: DayOfWeekCode;
  startMinutes: number;
  endMinutes: number;
  virtual: boolean;
};

export type GradeDistribution = Record<string, number>;

function toProtoDistribution(distribution: GradeDistribution | undefined) {
  const d = distribution ?? {};
  return {
    aPlus: d["A+"] ?? 0,
    a: d["A"] ?? 0,
    aMinus: d["A-"] ?? 0,
    bPlus: d["B+"] ?? 0,
    b: d["B"] ?? 0,
    cPlus: d["C+"] ?? 0,
    c: d["C"] ?? 0,
    dPlus: d["D+"] ?? 0,
    d: d["D"] ?? 0,
    e: d["E"] ?? 0,
    f: d["F"] ?? 0,
    ein: d["EIN"] ?? 0,
    ns: d["NS"] ?? 0,
    nc: d["NC"] ?? 0,
    abs: d["ABS"] ?? 0,
    p: d["P"] ?? 0,
    s: d["S"] ?? 0,
  };
}

function fromProtoDistribution(distribution: {
  aPlus: number;
  a: number;
  aMinus: number;
  bPlus: number;
  b: number;
  cPlus: number;
  c: number;
  dPlus: number;
  d: number;
  e: number;
  f: number;
  ein: number;
  ns: number;
  nc: number;
  abs: number;
  p: number;
  s: number;
} | undefined): GradeDistribution | undefined {
  if (!distribution) return undefined;
  const out: GradeDistribution = {
    "A+": Number(distribution.aPlus),
    "A": Number(distribution.a),
    "A-": Number(distribution.aMinus),
    "B+": Number(distribution.bPlus),
    "B": Number(distribution.b),
    "C+": Number(distribution.cPlus),
    "C": Number(distribution.c),
    "D+": Number(distribution.dPlus),
    "D": Number(distribution.d),
    "E": Number(distribution.e),
    "F": Number(distribution.f),
    "EIN": Number(distribution.ein),
    "NS": Number(distribution.ns),
    "NC": Number(distribution.nc),
    "ABS": Number(distribution.abs),
    "P": Number(distribution.p),
    "S": Number(distribution.s),
  };
  if (Object.values(out).every((v) => v === 0)) return undefined;
  return out;
}

export type ComponentSection = {
  section: string;
  sectionCode: string | null;
  component: string | null;
  session: string | null;
  times: MeetingTime[];
  instructors: string[];
  meetingDates: string[] | null;
  status: string | null;
  distribution?: GradeDistribution;
};

export type CourseSchedule = {
  subject: string;
  catalogNumber: string;
  courseCode: string;
  title: string | null;
  timeZone: string;
  components: Record<string, ComponentSection[]>;
};

export type SchedulesData = {
  termId: string;
  generatedAt?: string;
  totalCourses?: number;
  totalWithSchedules?: number;
  schedules: CourseSchedule[];
};

export type Indices = {
  courses: string[];
  programs: string[];
};

export type Term = {
  termId: string;
  name: string;
};

export type TermsData = {
  generatedAt?: string;
  terms: Term[];
};

export type CatalogueManifest = {
  years: number[];
};

export type Professor = {
  id?: string;
  legacyId?: number;
  name: string;
  rating: number | null;
  numRatings?: number;
};

export type RateMyProfessorsData = {
  resultCount: number;
  professors: Professor[];
};

function reqTypeFromProto(value: RequirementType): ProgramRequirement["type"] {
  switch (value) {
    case RequirementType.REQUIREMENT_TYPE_COURSE:
      return "course";
    case RequirementType.REQUIREMENT_TYPE_ELECTIVE:
      return "elective";
    case RequirementType.REQUIREMENT_TYPE_GROUP:
      return "group";
    case RequirementType.REQUIREMENT_TYPE_PICK:
      return "pick";
    case RequirementType.REQUIREMENT_TYPE_OPTIONS_GROUP:
      return "options_group";
    case RequirementType.REQUIREMENT_TYPE_DISCIPLINE_ELECTIVE:
      return "discipline_elective";
    case RequirementType.REQUIREMENT_TYPE_FREE_ELECTIVE:
      return "free_elective";
    case RequirementType.REQUIREMENT_TYPE_NON_DISCIPLINE_ELECTIVE:
      return "non_discipline_elective";
    case RequirementType.REQUIREMENT_TYPE_FACULTY_ELECTIVE:
      return "faculty_elective";
    case RequirementType.REQUIREMENT_TYPE_SECTION:
      return "section";
    case RequirementType.REQUIREMENT_TYPE_AND:
      return "and";
    case RequirementType.REQUIREMENT_TYPE_OR_GROUP:
      return "or_group";
    case RequirementType.REQUIREMENT_TYPE_OR_COURSE:
      return "or_course";
    default:
      return "course";
  }
}

function reqTypeToProto(value: ProgramRequirement["type"]): RequirementType {
  switch (value) {
    case "course":
      return RequirementType.REQUIREMENT_TYPE_COURSE;
    case "elective":
      return RequirementType.REQUIREMENT_TYPE_ELECTIVE;
    case "group":
      return RequirementType.REQUIREMENT_TYPE_GROUP;
    case "pick":
      return RequirementType.REQUIREMENT_TYPE_PICK;
    case "options_group":
      return RequirementType.REQUIREMENT_TYPE_OPTIONS_GROUP;
    case "discipline_elective":
      return RequirementType.REQUIREMENT_TYPE_DISCIPLINE_ELECTIVE;
    case "free_elective":
      return RequirementType.REQUIREMENT_TYPE_FREE_ELECTIVE;
    case "non_discipline_elective":
      return RequirementType.REQUIREMENT_TYPE_NON_DISCIPLINE_ELECTIVE;
    case "faculty_elective":
      return RequirementType.REQUIREMENT_TYPE_FACULTY_ELECTIVE;
    case "section":
      return RequirementType.REQUIREMENT_TYPE_SECTION;
    case "and":
      return RequirementType.REQUIREMENT_TYPE_AND;
    case "or_group":
      return RequirementType.REQUIREMENT_TYPE_OR_GROUP;
    case "or_course":
      return RequirementType.REQUIREMENT_TYPE_OR_COURSE;
  }
}

function prereqTypeFromProto(value: CoursePrereqNodeType): CoursePrereqNode["type"] {
  switch (value) {
    case CoursePrereqNodeType.COURSE_PREREQ_NODE_TYPE_COURSE:
      return "course";
    case CoursePrereqNodeType.COURSE_PREREQ_NODE_TYPE_OR_GROUP:
      return "or_group";
    case CoursePrereqNodeType.COURSE_PREREQ_NODE_TYPE_AND_GROUP:
      return "and_group";
    case CoursePrereqNodeType.COURSE_PREREQ_NODE_TYPE_NON_COURSE:
      return "non_course";
    default:
      return "non_course";
  }
}

function prereqTypeToProto(value: CoursePrereqNode["type"]): CoursePrereqNodeType {
  switch (value) {
    case "course":
      return CoursePrereqNodeType.COURSE_PREREQ_NODE_TYPE_COURSE;
    case "or_group":
      return CoursePrereqNodeType.COURSE_PREREQ_NODE_TYPE_OR_GROUP;
    case "and_group":
      return CoursePrereqNodeType.COURSE_PREREQ_NODE_TYPE_AND_GROUP;
    case "non_course":
      return CoursePrereqNodeType.COURSE_PREREQ_NODE_TYPE_NON_COURSE;
  }
}

function toProtoPrereq(node: CoursePrereqNode): ProtoCoursePrereqNode {
  return {
    type: prereqTypeToProto(node.type),
    code: node.code,
    text: node.text,
    credits: node.credits,
    disciplines: node.disciplines ?? [],
    levels: node.levels ?? [],
    disciplineLevels: (node.disciplineLevels ?? []).map((d) => ({
      discipline: d.discipline,
      levels: d.levels ?? [],
    })),
    programs: node.programs ?? [],
    children: (node.children ?? []).map(toProtoPrereq),
  };
}

function fromProtoPrereq(node: ProtoCoursePrereqNode): CoursePrereqNode {
  return {
    type: prereqTypeFromProto(node.type),
    ...(node.code ? { code: node.code } : {}),
    ...(node.text ? { text: node.text } : {}),
    ...(node.credits !== undefined ? { credits: node.credits } : {}),
    ...(node.disciplines.length > 0 ? { disciplines: node.disciplines } : {}),
    ...(node.levels.length > 0 ? { levels: node.levels.map((n) => Number(n)) } : {}),
    ...(node.disciplineLevels.length > 0
      ? {
          disciplineLevels: node.disciplineLevels.map((d) => ({
            discipline: d.discipline,
            ...(d.levels.length > 0 ? { levels: d.levels.map((n) => Number(n)) } : {}),
          })),
        }
      : {}),
    ...(node.programs.length > 0 ? { programs: node.programs } : {}),
    ...(node.children.length > 0 ? { children: node.children.map(fromProtoPrereq) } : {}),
  };
}

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

function dateStringToYyyymmdd(value: string): number {
  const compact = value.replaceAll("-", "");
  const parsed = Number.parseInt(compact, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function yyyymmddToDateString(value: number): string {
  const s = String(Math.trunc(value)).padStart(8, "0");
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

function parseCourseCodeParts(courseCode: string): { subject: string; catalogNumber: string } {
  const normalized = courseCode.trim().replace(/\s+/g, " ");
  const [subject = "", catalogNumber = ""] = normalized.split(" ");
  return { subject, catalogNumber };
}

function createCourseCodeTable(courses: Course[]): { table: string[]; indexByCode: Map<string, number> } {
  const table: string[] = [];
  const indexByCode = new Map<string, number>();
  const add = (code: string) => {
    const normalized = code.trim();
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

function courseIndexFromCode(indexByCode: Map<string, number>, code: string): ProtoCourseIndex | undefined {
  const idx = indexByCode.get(code.trim());
  return idx === undefined ? undefined : { index: idx };
}

function codeFromCourseIndex(table: string[], index: ProtoCourseIndex | undefined): string {
  if (!index) return "";
  return table[index.index] ?? "";
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

function toProtoProgramRequirement(requirement: ProgramRequirement): ProtoProgramRequirement {
  return {
    type: reqTypeToProto(requirement.type),
    title: requirement.title,
    code: requirement.code,
    credits: requirement.credits,
    disciplineLevels: (requirement.disciplineLevels ?? []).map(
      (d): ProtoDisciplineLevel => ({
        discipline: d.discipline,
        levels: d.levels ?? [],
      }),
    ),
    excludedDisciplines: requirement.excluded_disciplines ?? [],
    faculty: requirement.faculty,
    indented: requirement.indented,
    options: (requirement.options ?? []).map(toProtoProgramRequirement),
  };
}

function fromProtoProgramRequirement(requirement: ProtoProgramRequirement): ProgramRequirement {
  return {
    type: reqTypeFromProto(requirement.type),
    ...(requirement.title ? { title: requirement.title } : {}),
    ...(requirement.code ? { code: requirement.code } : {}),
    ...(requirement.credits !== undefined ? { credits: Number(requirement.credits) } : {}),
    ...(requirement.disciplineLevels.length > 0
      ? {
          disciplineLevels: requirement.disciplineLevels.map((d) => ({
            discipline: d.discipline,
            ...(d.levels.length > 0 ? { levels: d.levels.map((n) => Number(n)) } : {}),
          })),
        }
      : {}),
    ...(requirement.excludedDisciplines.length > 0
      ? { excluded_disciplines: requirement.excludedDisciplines }
      : {}),
    ...(requirement.faculty ? { faculty: requirement.faculty } : {}),
    ...(requirement.indented !== undefined ? { indented: requirement.indented } : {}),
    ...(requirement.options.length > 0
      ? { options: requirement.options.map(fromProtoProgramRequirement) }
      : {}),
  };
}

export function toProtoCatalogue(input: Catalogue): ProtoCatalogue {
  const { table, indexByCode } = createCourseCodeTable(input.courses);
  return {
    courseCodes: table,
    courses: input.courses.map((course): ProtoCourse => ({
      code: courseIndexFromCode(indexByCode, course.code),
      title: course.title,
      credits: course.credits,
      component: course.component,
      aliases: (course.aliases ?? [])
        .map((alias) => courseIndexFromCode(indexByCode, alias))
        .filter((v): v is ProtoCourseIndex => v !== undefined),
      hasPrereqText: Boolean(course.prereqText),
      prerequisites: course.prerequisites ? toProtoPrereq(course.prerequisites) : undefined,
    })),
    programs: input.programs.map((program): ProtoProgram => ({
      title: program.title,
      programKey: programKeyFromProgram(program),
      requirements: program.requirements.map(toProtoProgramRequirement),
    })),
  };
}

export function fromProtoCatalogue(input: ProtoCatalogue): Catalogue {
  const courseCodeTable = input.courseCodes;
  return {
    courses: input.courses.map((course): Course => ({
      code: codeFromCourseIndex(courseCodeTable, course.code),
      title: course.title,
      credits: Number(course.credits),
      description: "",
      ...(course.component ? { component: course.component } : {}),
      ...(course.aliases.length > 0
        ? { aliases: course.aliases.map((alias) => codeFromCourseIndex(courseCodeTable, alias)).filter(Boolean) }
        : {}),
      ...(course.hasPrereqText ? { prereqText: "0" } : {}),
      ...(course.prerequisites ? { prerequisites: fromProtoPrereq(course.prerequisites) } : {}),
    })),
    programs: input.programs.map((program): Program => ({
      title: program.title,
      url: programUrlFromKey(program.programKey),
      slug: program.programKey,
      requirements: program.requirements.map(fromProtoProgramRequirement),
    })),
  };
}

export function toProtoSchedulesData(input: SchedulesData): ProtoSchedulesData {
  const courseCodes: string[] = [];
  const indexByCode = new Map<string, number>();
  const addCode = (code: string): ProtoCourseIndex => {
    const normalized = code.trim();
    const existing = indexByCode.get(normalized);
    if (existing !== undefined) return { index: existing };
    const index = courseCodes.length;
    courseCodes.push(normalized);
    indexByCode.set(normalized, index);
    return { index };
  };
  return {
    termId: parseTermIdToNumber(input.termId),
    courseCodes,
    totalCourses: input.totalCourses,
    totalWithSchedules: input.totalWithSchedules,
    schedules: input.schedules.map((schedule): ProtoCourseSchedule => ({
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
              })),
              instructors: section.instructors,
              meetingDates: section.meetingDates
                ? {
                    startYyyymmdd: dateStringToYyyymmdd(section.meetingDates[0] ?? ""),
                    endYyyymmdd: dateStringToYyyymmdd(section.meetingDates[1] ?? ""),
                  }
                : undefined,
              status: statusToProto(section.status),
              distribution: section.distribution ? toProtoDistribution(section.distribution) : undefined,
            })),
          },
        ]),
      ),
    })),
  };
}

export function fromProtoSchedulesData(input: ProtoSchedulesData): SchedulesData {
  const courseCodeTable = input.courseCodes;
  return {
    termId: String(input.termId),
    ...(input.totalCourses !== undefined ? { totalCourses: Number(input.totalCourses) } : {}),
    ...(input.totalWithSchedules !== undefined
      ? { totalWithSchedules: Number(input.totalWithSchedules) }
      : {}),
    schedules: input.schedules.map((schedule): CourseSchedule => ({
      subject: parseCourseCodeParts(codeFromCourseIndex(courseCodeTable, schedule.course)).subject,
      catalogNumber: parseCourseCodeParts(codeFromCourseIndex(courseCodeTable, schedule.course)).catalogNumber,
      courseCode: codeFromCourseIndex(courseCodeTable, schedule.course),
      title: schedule.title ?? null,
      timeZone: schedule.timeZone,
      components: Object.fromEntries(
        Object.entries(schedule.components).map(([component, list]) => [
          component,
          list.items.map((section): ComponentSection => ({
            section: section.section,
            sectionCode: section.sectionCode ?? null,
            component: section.component ?? null,
            session: section.session ?? null,
            times: section.times.map((time): MeetingTime => ({
              day: protoDayToCode(time.day),
              startMinutes: Number(time.startMinutes),
              endMinutes: Number(time.endMinutes),
              virtual: time.virtual,
            })),
            instructors: section.instructors,
            meetingDates: section.meetingDates
              ? [
                  yyyymmddToDateString(Number(section.meetingDates.startYyyymmdd)),
                  yyyymmddToDateString(Number(section.meetingDates.endYyyymmdd)),
                ]
              : null,
            status: statusFromProto(section.status),
            ...(fromProtoDistribution(section.distribution)
              ? { distribution: fromProtoDistribution(section.distribution) }
              : {}),
          })),
        ]),
      ),
    })),
  };
}

export function toProtoIndices(input: Indices): ProtoIndices {
  return { courses: input.courses, programs: input.programs };
}

export function fromProtoIndices(input: ProtoIndices): Indices {
  return { courses: input.courses, programs: input.programs };
}

export function toProtoTermsData(input: TermsData): ProtoTermsData {
  return {
    terms: input.terms.map((term): ProtoTerm => ({
      termId: parseTermIdToNumber(term.termId),
      name: term.name,
    })),
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

export function toProtoRateMyProfessorsData(input: RateMyProfessorsData): ProtoRateMyProfessorsData {
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

export function fromProtoRateMyProfessorsData(input: ProtoRateMyProfessorsData): RateMyProfessorsData {
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
