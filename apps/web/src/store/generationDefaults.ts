import type { DayOfWeek } from "@uoplan/core";

/** Default generation options shared by the initial store state and the "clear" action. */
export const DEFAULT_COURSES_THIS_SEMESTER = 5;
export const DEFAULT_GENERATION_MIN_START_MINUTES = 8 * 60 + 30; // 8:30
export const DEFAULT_GENERATION_MAX_END_MINUTES = 22 * 60; // 22:00
export const DEFAULT_GENERATION_ALLOWED_DAYS: DayOfWeek[] = ["Mo", "Tu", "We", "Th", "Fr"];
export const DEFAULT_GENERATION_MIN_PROFESSOR_RATING: number | null = null;
export const DEFAULT_GENERATION_LIMIT_FIRST_YEAR_CREDITS = true;
export const DEFAULT_GENERATION_COMPRESSED_SCHEDULE = false;
export const DEFAULT_GENERATION_PREFER_EASIER = false;
