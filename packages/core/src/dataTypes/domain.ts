export type CoursePrereqDisciplineLevel = {
  discipline: string;
  levels?: number[];
};

export type CoursePrereqKind =
  | "permission"
  | "audition"
  | "language"
  | "equivalent"
  | "highschool"
  | "standing"
  | "topic"
  | "coursework"
  | "knowledge"
  | "recommended";

export type CoursePrereqNode = {
  type: "course" | "or_group" | "and_group" | "non_course";
  code?: string;
  text?: string;
  credits?: number;
  disciplines?: string[];
  levels?: number[];
  disciplineLevels?: CoursePrereqDisciplineLevel[];
  programs?: string[];
  kind?: CoursePrereqKind;
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
  levels?: number[];
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

/**
 * The single canonical ordering of weekday codes used throughout the domain.
 *
 * This is the in-code source of truth for day-of-week ordering. The two
 * protobuf schemas encode days with *different* wire numbers and must not be
 * unified at the wire level (doing so would corrupt existing share URLs and
 * committed `.pb` assets):
 *   - `data.proto` DayOfWeek is 1-indexed (Mo = 1 … Su = 7, 0 = unspecified).
 *   - `state.proto` DayOfWeek is 0-indexed by this array's position
 *     (Mo = 0 … Su = 6).
 * See `dayOfWeekWire.test.ts` for the golden mappings.
 */
export const DAY_OF_WEEK_CODES = [
  "Mo",
  "Tu",
  "We",
  "Th",
  "Fr",
  "Sa",
  "Su",
] as const satisfies readonly DayOfWeekCode[];

export type MeetingTime = {
  day: DayOfWeekCode;
  startMinutes: number;
  endMinutes: number;
  virtual: boolean;
  instructor?: string | null;
  meetingDates?: [string, string] | null;
};

export type GradeDistribution = Record<string, number>;

/**
 * Build-time guess of an instructor for a section that has no assigned
 * instructor. Informational only — never fed into grade/rating/engine paths.
 */
export type PredictedInstructor = {
  name: string;
  legacyId?: number | null;
};

export type ComponentSection = {
  section: string;
  sectionCode: string | null;
  component: string | null;
  session: string | null;
  times: MeetingTime[];
  status: string | null;
  distribution?: GradeDistribution;
  /** Guessed instructors; present only for sections with no known instructor. */
  predictedInstructors?: PredictedInstructor[];
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
  disciplines: string[];
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

export type Discipline = {
  code: string;
  name: string;
  nameFr?: string;
};

export type DisciplinesData = {
  disciplines: Discipline[];
};
