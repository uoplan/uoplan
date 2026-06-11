import type {
  CanonicalProfessorName,
  ComponentSection,
  DayOfWeek,
  GeneratedSchedule,
  GradeDistribution,
  NormalizedCourseCode,
  PredictedInstructor,
} from "@uoplan/core";
import { unsafeBrand } from "@uoplan/core";
import type { CalendarEvent } from "../types";

function courseCode(value: string): NormalizedCourseCode {
  return unsafeBrand<NormalizedCourseCode>(value);
}

export function professorName(value: string): CanonicalProfessorName {
  return unsafeBrand<CanonicalProfessorName>(value);
}

export interface TimeFixture {
  day: DayOfWeek;
  startMinutes: number;
  endMinutes: number;
  virtual?: boolean;
  instructor?: string | null;
  meetingDates?: [string, string] | null;
}

export interface SectionFixture {
  component: string;
  section?: string;
  sectionCode?: string | null;
  times: TimeFixture[];
  distribution?: GradeDistribution;
  predictedInstructors?: PredictedInstructor[];
}

export function makeSchedule(
  courses: Array<{ courseCode: string; sections: SectionFixture[] }>,
): GeneratedSchedule {
  return {
    enrollments: courses.map(({ courseCode: rawCode, sections }) => {
      const sectionCombo: GeneratedSchedule["enrollments"][number]["sectionCombo"] = {};
      const times: GeneratedSchedule["enrollments"][number]["times"] = [];

      for (const sectionFixture of sections) {
        const sectionTimes = sectionFixture.times.map((time) => ({
          day: time.day,
          startMinutes: time.startMinutes,
          endMinutes: time.endMinutes,
          virtual: time.virtual ?? false,
          instructor: time.instructor ?? null,
          meetingDates: time.meetingDates ?? null,
        }));
        const section: ComponentSection = {
          section: sectionFixture.section ?? sectionFixture.sectionCode ?? "",
          sectionCode: sectionFixture.sectionCode ?? sectionFixture.section ?? null,
          component: sectionFixture.component,
          session: null,
          times: sectionTimes,
          status: null,
          ...(sectionFixture.distribution ? { distribution: sectionFixture.distribution } : {}),
          ...(sectionFixture.predictedInstructors
            ? { predictedInstructors: sectionFixture.predictedInstructors }
            : {}),
        };
        sectionCombo[sectionFixture.component] = { section };
        times.push(...sectionTimes);
      }

      return {
        courseCode: courseCode(rawCode),
        sectionCombo,
        times,
      };
    }),
  };
}

export function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "CSI 2101-LEC-0",
    courseCode: "CSI 2101",
    enrollmentIndex: 0,
    day: "Mo",
    startMinutes: 540,
    endMinutes: 600,
    componentSection: "LEC - A",
    virtual: false,
    professor: professorName("Ada Lovelace"),
    professorRatingValue: null,
    professorRatingDetails: [],
    courseSentiment: null,
    professorSentiment: null,
    gradeViz: null,
    meetingDates: null,
    ...overrides,
  };
}
