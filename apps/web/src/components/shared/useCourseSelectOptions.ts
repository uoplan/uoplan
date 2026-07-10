import { useMemo } from "react";
import { normalizeCourseCode } from "@uoplan/core";
import { useCompletedCourses } from "@uoplan/store/hooks/useCompletedCourses";
import { useDataCache } from "@uoplan/store/hooks/useDataset";
import { createCourseOptionsFilter, renderCourseOption } from "./CourseSelect";

/**
 * Shared course-option lists for the "courses you want" pickers. Derives the schedulable
 * course set from the cache (one option per course with a schedule), a code+title search
 * filter, a dropdown renderer, and a `desiredCourseOptions` list that drops already-completed
 * courses. Used by both the calendar sidebars (via {@link useSharedGenerationOptions}) and the
 * basket card so they never diverge.
 */
export function useCourseSelectOptions() {
  const cache = useDataCache();
  const { completedCourses } = useCompletedCourses();

  const courseOptions = useMemo(() => {
    if (!cache) return [] as { value: string; label: string }[];
    const seen = new Set<string>();
    return cache
      .getAllSchedules()
      .flatMap((sched) => {
        const course = cache.getCourse(sched.courseCode);
        if (!course) return [];
        if (seen.has(course.code)) return [];
        seen.add(course.code);
        return [{ value: course.code, label: course.code }];
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [cache]);

  const courseOptionsFilter = useMemo(() => createCourseOptionsFilter(cache), [cache]);
  const courseRenderOption = useMemo(() => renderCourseOption(cache), [cache]);

  const desiredCourseOptions = useMemo(() => {
    if (completedCourses.length === 0) return courseOptions;
    const completed = new Set(completedCourses.map(normalizeCourseCode));
    return courseOptions.filter((o) => !completed.has(normalizeCourseCode(o.value)));
  }, [courseOptions, completedCourses]);

  return { courseOptions, courseOptionsFilter, courseRenderOption, desiredCourseOptions };
}
