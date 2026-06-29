import type { DayOfWeek } from "@uoplan/core";

/** Default cart-cap "Courses this semester" — the basket cap that overflows into program requirements. */
export const DEFAULT_COURSES_THIS_SEMESTER = 5;
/** Default additional electives generated on top of the cart cap. 0 = none unless the user asks. */
export const DEFAULT_ADDITIONAL_ELECTIVES_COUNT = 0;
/** High safety cap on the number of courses in a generated schedule (shared by basic and advanced modes). */
export const SCHEDULE_COURSE_COUNT_MAX = 50;
export const DEFAULT_GENERATION_MIN_START_MINUTES = 8 * 60 + 30; // 8:30
export const DEFAULT_GENERATION_MAX_END_MINUTES = 22 * 60; // 22:00
/** A day is "avoided" when a blocked window covers this span. Avoiding a day adds it; un-avoiding subtracts it. */
export const AVOID_DAY_START_MINUTES = 8 * 60 + 30; // 8:30
export const AVOID_DAY_END_MINUTES = 22 * 60; // 22:00
export const DEFAULT_AVOIDED_DAYS: DayOfWeek[] = ["Sa", "Su"];
export const DEFAULT_GENERATION_LIMIT_FIRST_YEAR_CREDITS = true;
