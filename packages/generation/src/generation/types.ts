import type { ComponentSection, DayOfWeek } from "@uoplan/domain/dataTypes";
import type { NormalizedCourseCode } from "@uoplan/domain/brand";
import type { ProfessorRatingsMap } from "@uoplan/professors/professorRatings";

export interface TimeSlot {
  day: DayOfWeek;
  startMinutes: number;
  endMinutes: number;
  meetingDates?: [string, string] | null;
}

export interface CourseEnrollment {
  courseCode: NormalizedCourseCode;
  sectionCombo: SectionCombo;
  times: TimeSlot[];
}

export interface SectionCombo {
  [component: string]: { section: ComponentSection };
}

export interface GeneratedSchedule {
  enrollments: CourseEnrollment[];
}

/** A recurring per-weekday window the user has blocked off. No course may meet inside it. */
export interface BlockedTimeWindow {
  day: DayOfWeek;
  startMinutes: number;
  endMinutes: number;
}

export interface GenerationConstraints {
  minStartMinutes: number;
  maxEndMinutes: number;
  /**
   * Normalized professor-name -> rating map (data only). The `prefer_professor_rating`
   * optimization objective decides whether it's applied; see the engine
   * (`weights.rs::professor_rating_weight`).
   */
  professorRatings?: ProfessorRatingsMap;
  /** Max credits from 1000-level courses allowed in the schedule. */
  maxFirstYearCredits?: number;
  /** Recurring per-weekday windows that no course meeting time may overlap. */
  blockedTimes?: BlockedTimeWindow[];
}

export interface PrecomputedCombo {
  combo: SectionCombo;
  enrollment: CourseEnrollment;
}
