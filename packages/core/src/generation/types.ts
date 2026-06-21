import type { ComponentSection, DayOfWeek } from "../dataTypes";
import type { NormalizedCourseCode } from "../brand";
import type { ProfessorRatingsMap } from "../professorRatings";

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
   * Soft preference: when true, section selection is biased toward higher-rated
   * professors (unrated treated as ~4.0). Not a hard filter — every section is
   * still eligible. See the engine (`weights.rs::professor_rating_weight`).
   */
  generationPreferHigherProfessorRating?: boolean;
  professorRatings?: ProfessorRatingsMap;
  /** Max credits from 1000-level courses allowed in the schedule (48 - already completed). */
  maxFirstYearCredits?: number;
  /** If true, each day may have at most one gap between classes, and that gap must be ≤ 90 minutes. */
  compressedSchedule?: boolean;
  /** Recurring per-weekday windows that no course meeting time may overlap. */
  blockedTimes?: BlockedTimeWindow[];
}

export interface PrecomputedCombo {
  combo: SectionCombo;
  enrollment: CourseEnrollment;
}
