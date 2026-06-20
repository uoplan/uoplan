import type { DayOfWeek } from "@uoplan/core";

/** Default generation options shared by the initial store state and the "clear" action. */
export const DEFAULT_COURSES_THIS_SEMESTER = 5;
/** Default elective slots in basic mode, so "Courses this semester" starts at a full load. */
export const DEFAULT_BASIC_ELECTIVES_COUNT = 5;
/** High safety cap on the number of courses in a generated schedule (shared by basic and advanced modes). */
export const SCHEDULE_COURSE_COUNT_MAX = 50;
export const DEFAULT_GENERATION_MIN_START_MINUTES = 8 * 60 + 30; // 8:30
export const DEFAULT_GENERATION_MAX_END_MINUTES = 22 * 60; // 22:00
/** A day is "avoided" when a blocked window covers this span. Avoiding a day adds it; un-avoiding subtracts it. */
export const AVOID_DAY_START_MINUTES = 8 * 60 + 30; // 8:30
export const AVOID_DAY_END_MINUTES = 22 * 60; // 22:00
export const DEFAULT_AVOIDED_DAYS: DayOfWeek[] = ["Sa", "Su"];
/** Lenient default minimum professor rating — "prefer profs with a better rating" is on by default (profs without a rating are always allowed). */
export const DEFAULT_GENERATION_MIN_PROFESSOR_RATING: number | null = 2;
export const DEFAULT_GENERATION_LIMIT_FIRST_YEAR_CREDITS = true;
export const DEFAULT_GENERATION_COMPRESSED_SCHEDULE = false;
export const DEFAULT_GENERATION_PREFER_EASIER = true;
export const DEFAULT_GENERATION_PREFER_HIGHER_SENTIMENT = true;
