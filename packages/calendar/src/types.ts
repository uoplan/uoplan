import type { DayOfWeek as DayOfWeekCode, GradeVizData } from "@uoplan/core";

export type { DayOfWeekCode };

export interface CalendarEvent {
  id: string;
  courseCode: string;
  enrollmentIndex: number;
  day: DayOfWeekCode;
  startMinutes: number;
  endMinutes: number;
  componentSection: string;
  virtual: boolean;
  professor: string;
  professorRatingValue?: number | null;
  professorRatingDetails?: Array<{
    id?: string;
    legacyId?: number;
    name: string;
    rating: number;
    numRatings: number;
  }>;
  /**
   * Build-time guess of instructors, present only when the section has no known
   * instructor. Informational only — never used for ratings or generation.
   */
  predictedInstructors?: Array<{ name: string; legacyId?: number | null }>;
  gradeViz?: GradeVizData | null;
  meetingDates?: [string, string] | null;
}
