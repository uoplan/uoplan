import { useMemo } from "react";
import { normalizeCourseCode } from "@uoplan/core";
import { createCourseOptionsFilter, renderCourseOption } from "../../shared/CourseSelect";
import { useBasketSelection } from "../../../hooks/useBasket";
import { useCompletedCourses } from "../../../store/hooks/useCompletedCourses";
import { useDataCache } from "../../../store/hooks/useDataset";
import { useGenerationConstraints } from "../../../store/hooks/useGenerationConstraints";
import { useProgramSelection } from "../../../store/hooks/useProgramSelection";
import { useBasicElectives } from "../../../store/hooks/useScheduleGeneration";

/**
 * Rich generation-options projection for the calendar sidebars: the shared generation
 * constraints (via {@link useGenerationConstraints}) plus the basket selection, the
 * basic-mode elective count, the French-immersion toggle, and the cache-derived
 * course/category option lists. Built on the `store/hooks` projection layer rather than
 * raw store selectors.
 */
export function useSharedGenerationOptions() {
  const cache = useDataCache();
  const { completedCourses } = useCompletedCourses();
  const { basketCourses, setBasketCourses } = useBasketSelection();
  const { basicElectivesCount } = useBasicElectives();
  const { frenchImmersionStream, setFrenchImmersionStream } = useProgramSelection();
  const constraints = useGenerationConstraints();

  const allCategories = useMemo(() => {
    if (!cache) return [] as string[];
    const categories = [
      ...new Set(
        cache.getAllCourses().map((c) => {
          const match = c.code.match(/^([A-Z]{3,4})/i);
          return match ? match[1].toUpperCase() : null;
        }),
      ),
    ].filter((c): c is string => c !== null);
    categories.sort();
    return categories;
  }, [cache]);

  const courseOptions = useMemo(() => {
    if (!cache) return [];
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

  return {
    cache,
    completedCourses,
    basketCourses,
    basicElectivesCount,
    frenchImmersionStream,
    ...constraints,
    allCategories,
    courseOptions,
    courseOptionsFilter,
    courseRenderOption,
    desiredCourseOptions,
    setBasketCourses,
    setFrenchImmersionStream,
  };
}
