import { useMemo } from "react";
import { useCourseSelectOptions } from "../../shared/useCourseSelectOptions";
import { useBasketSelection } from "../../../hooks/useBasket";
import { useCompletedCourses } from "../../../store/hooks/useCompletedCourses";
import { useDataCache } from "../../../store/hooks/useDataset";
import { useGenerationConstraints } from "../../../store/hooks/useGenerationConstraints";
import { useProgramSelection } from "../../../store/hooks/useProgramSelection";
import { useAdditionalElectives } from "../../../store/hooks/useScheduleGeneration";

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
  const { additionalElectivesCount } = useAdditionalElectives();
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

  const { courseOptions, courseOptionsFilter, courseRenderOption, desiredCourseOptions } =
    useCourseSelectOptions();

  return {
    cache,
    completedCourses,
    basketCourses,
    additionalElectivesCount,
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
