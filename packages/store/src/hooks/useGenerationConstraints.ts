import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "../appStore";

/**
 * The schedule-generation constraint/preference values and their setters — the
 * cluster shared by both calendar sidebars (time window, avoided days via
 * `blockedTimes`, min professor rating, level/language/elective buckets, closed/
 * virtual section filters, first-year credit cap, compressed schedule, the prefer-
 * easier / prefer-higher-sentiment soft biases, the blacklist, and the basic-mode
 * excluded subject categories). Reads grouped behind {@link useShallow}; actions are
 * stable references.
 *
 * The richer calendar hook (`useSharedGenerationOptions`) builds on this and adds the
 * cache-derived course/category option lists and the basket wiring.
 */
export function useGenerationConstraints() {
  const reads = useAppStore(
    useShallow((s) => ({
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
      basicExcludedCategories: s.basicExcludedCategories,
    })),
  );

  const setGenerationMinStartMinutes = useAppStore((s) => s.setGenerationMinStartMinutes);
  const setGenerationMaxEndMinutes = useAppStore((s) => s.setGenerationMaxEndMinutes);
  const setAvoidedDays = useAppStore((s) => s.setAvoidedDays);
  const setGenerationMinProfessorRating = useAppStore((s) => s.setGenerationMinProfessorRating);
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
  const setBasicExcludedCategories = useAppStore((s) => s.setBasicExcludedCategories);

  return {
    ...reads,
    setGenerationMinStartMinutes,
    setGenerationMaxEndMinutes,
    setAvoidedDays,
    setGenerationMinProfessorRating,
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
    setBasicExcludedCategories,
  };
}
