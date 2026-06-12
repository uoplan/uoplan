import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { normalizeCourseCode } from "@uoplan/core";
import { useAppStore } from "../../../store/appStore";
import { createCourseOptionsFilter, renderCourseOption } from "../../shared/CourseSelect";

export function useSharedGenerationOptions() {
  const values = useAppStore(
    useShallow((s) => ({
      cache: s.cache,
      completedCourses: s.completedCourses,
      basketCourses: s.basketCourses,
      basicElectivesCount: s.basicElectivesCount,
      basicExcludedCategories: s.basicExcludedCategories,
      generationMinStartMinutes: s.generationMinStartMinutes,
      generationMaxEndMinutes: s.generationMaxEndMinutes,
      blockedTimes: s.blockedTimes,
      generationMinProfessorRating: s.generationMinProfessorRating,
      levelBuckets: s.levelBuckets,
      languageBuckets: s.languageBuckets,
      electiveLevelBuckets: s.electiveLevelBuckets,
      includeClosedComponents: s.includeClosedComponents,
      virtualSectionsOnly: s.virtualSectionsOnly,
      generationLimitFirstYearCredits: s.generationLimitFirstYearCredits,
      generationCompressedSchedule: s.generationCompressedSchedule,
      generationPreferEasier: s.generationPreferEasier,
      generationPreferHigherSentiment: s.generationPreferHigherSentiment,
      blacklistedCourses: s.blacklistedCourses,
      frenchImmersionStream: s.frenchImmersionStream,
    })),
  );

  const setBasketCourses = useAppStore((s) => s.setBasketCourses);
  const setBasicExcludedCategories = useAppStore((s) => s.setBasicExcludedCategories);
  const setGenerationMinProfessorRating = useAppStore((s) => s.setGenerationMinProfessorRating);
  const setGenerationMinStartMinutes = useAppStore((s) => s.setGenerationMinStartMinutes);
  const setGenerationMaxEndMinutes = useAppStore((s) => s.setGenerationMaxEndMinutes);
  const setAvoidedDays = useAppStore((s) => s.setAvoidedDays);
  const setLevelBuckets = useAppStore((s) => s.setLevelBuckets);
  const setLanguageBuckets = useAppStore((s) => s.setLanguageBuckets);
  const setElectiveLevelBuckets = useAppStore((s) => s.setElectiveLevelBuckets);
  const setIncludeClosedComponents = useAppStore((s) => s.setIncludeClosedComponents);
  const setVirtualSectionsOnly = useAppStore((s) => s.setVirtualSectionsOnly);
  const setGenerationLimitFirstYearCredits = useAppStore(
    (s) => s.setGenerationLimitFirstYearCredits,
  );
  const setGenerationCompressedSchedule = useAppStore((s) => s.setGenerationCompressedSchedule);
  const setGenerationPreferEasier = useAppStore((s) => s.setGenerationPreferEasier);
  const setGenerationPreferHigherSentiment = useAppStore(
    (s) => s.setGenerationPreferHigherSentiment,
  );
  const setBlacklistedCourses = useAppStore((s) => s.setBlacklistedCourses);
  const setFrenchImmersionStream = useAppStore((s) => s.setFrenchImmersionStream);

  const allCategories = useMemo(() => {
    if (!values.cache) return [] as string[];
    const categories = [
      ...new Set(
        values.cache.getAllCourses().map((c) => {
          const match = c.code.match(/^([A-Z]{3,4})/i);
          return match ? match[1].toUpperCase() : null;
        }),
      ),
    ].filter((c): c is string => c !== null);
    categories.sort();
    return categories;
  }, [values.cache]);

  const courseOptions = useMemo(() => {
    if (!values.cache) return [];
    const seen = new Set<string>();
    return values.cache
      .getAllSchedules()
      .flatMap((sched) => {
        const course = values.cache?.getCourse(sched.courseCode);
        if (!course) return [];
        if (seen.has(course.code)) return [];
        seen.add(course.code);
        return [{ value: course.code, label: course.code }];
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [values.cache]);

  const courseOptionsFilter = useMemo(
    () => createCourseOptionsFilter(values.cache),
    [values.cache],
  );
  const courseRenderOption = useMemo(() => renderCourseOption(values.cache), [values.cache]);

  const desiredCourseOptions = useMemo(() => {
    if (values.completedCourses.length === 0) return courseOptions;
    const completed = new Set(values.completedCourses.map(normalizeCourseCode));
    return courseOptions.filter((o) => !completed.has(normalizeCourseCode(o.value)));
  }, [courseOptions, values.completedCourses]);

  return {
    ...values,
    allCategories,
    courseOptions,
    courseOptionsFilter,
    courseRenderOption,
    desiredCourseOptions,
    setBasketCourses,
    setBasicExcludedCategories,
    setGenerationMinProfessorRating,
    setGenerationMinStartMinutes,
    setGenerationMaxEndMinutes,
    setAvoidedDays,
    setLevelBuckets,
    setLanguageBuckets,
    setElectiveLevelBuckets,
    setIncludeClosedComponents,
    setVirtualSectionsOnly,
    setGenerationLimitFirstYearCredits,
    setGenerationCompressedSchedule,
    setGenerationPreferEasier,
    setGenerationPreferHigherSentiment,
    setBlacklistedCourses,
    setFrenchImmersionStream,
  };
}
