import {
  applyLatestAliasesToMergedCourses,
  applyYearPrerequisites,
  normalizeCourseCode,
  removeMergedCoursesSupersededByAliases,
} from "@uoplan/core";
import type { Catalogue, Course } from "@uoplan/core";

/**
 * Merges the latest catalogue with the start-year catalogue when the user selects
 * their first year of study. Latest provides course metadata and new courses;
 * start-year prerequisites override for every overlapping code (empty year prereqs
 * strip latest prereqs). Completed courses that exist in the year catalogue keep
 * the full year row (credits/level). Alias→canonical mapping is applied and
 * superseded alias rows are removed.
 */
export function getMergedCatalogue(
  catalogue: Catalogue | null,
  yearCatalogueCourses: Course[] | null,
  completedCourses: string[],
): Catalogue | null {
  if (!catalogue) return null;
  if (!yearCatalogueCourses) return catalogue;

  const completedSet = new Set(completedCourses.map(normalizeCourseCode));
  const yearMap = new Map(yearCatalogueCourses.map((c) => [normalizeCourseCode(c.code), c]));
  const latestMap = new Map(catalogue.courses.map((c) => [normalizeCourseCode(c.code), c]));

  const merged = new Map<string, Course>();

  for (const course of catalogue.courses) {
    const key = normalizeCourseCode(course.code);
    const yearCourse = yearMap.get(key);
    if (!yearCourse) {
      merged.set(key, course);
      continue;
    }
    if (completedSet.has(key)) {
      merged.set(key, yearCourse);
    } else {
      merged.set(key, applyYearPrerequisites(course, yearCourse));
    }
  }

  for (const course of yearCatalogueCourses) {
    const key = normalizeCourseCode(course.code);
    if (!latestMap.has(key)) {
      merged.set(key, course);
    }
  }

  const mergedList = Array.from(merged.values());
  const withAliases = applyLatestAliasesToMergedCourses(catalogue.courses, mergedList);
  const courses = removeMergedCoursesSupersededByAliases(catalogue.courses, withAliases);
  return { ...catalogue, courses };
}
