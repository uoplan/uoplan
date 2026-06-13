import { useEffect, useMemo } from "react";
import { Alert } from "@mantine/core";
import { useCoursesThisSemester, useRequirementActions } from "../../store/hooks";
import { tr, useTr } from "../../i18n";
import { computeFirstYearCredits } from "../../lib/generation/advancedGenerationDerivations";
import { AdvancedGenerationOptionsView } from "./AdvancedGenerationOptionsView";
import { BasketContents } from "../basket/BasketContents";
import { useBasketResolution } from "../../lib/generation/useBasketResolution";
import { avoidedDaysFromBlocks } from "../../lib/blockedTimes";
import { SCHEDULE_COURSE_COUNT_MAX } from "../../store/generationDefaults";
import { useSharedGenerationOptions } from "./generationOptions/useSharedGenerationOptions";
import { useRequirementAssignmentState } from "../requirements/useRequirementAssignmentState";

export function AdvancedGenerationOptions() {
  useTr();
  const {
    cache,
    completedCourses,
    basketCourses,
    basicExcludedCategories,
    generationMinStartMinutes,
    generationMaxEndMinutes,
    blockedTimes,
    generationMinProfessorRating,
    levelBuckets,
    languageBuckets,
    electiveLevelBuckets,
    includeClosedComponents,
    virtualSectionsOnly,
    generationLimitFirstYearCredits,
    generationCompressedSchedule,
    generationPreferEasier,
    generationPreferHigherSentiment,
    blacklistedCourses,
    frenchImmersionStream,
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
  } = useSharedGenerationOptions();
  const {
    remainingRequirements,
    requirementTreeWithStatus,
    completedRequirementsList,
    unassignedCompletedCourses,
    constrainedPerRequirement,
    selectedPerRequirement,
    selectedOptionsPerRequirement,
    filteredPrereqEligibleCourses,
  } = useRequirementAssignmentState();
  const { coursesThisSemester, setCoursesThisSemester } = useCoursesThisSemester();
  const { setConstrainedForRequirement, applyDesiredAutoAssignments } = useRequirementActions();

  const { total: totalFirstYearCredits, warn: warnFirstYearLimit } = computeFirstYearCredits(
    cache,
    completedCourses,
    selectedPerRequirement,
  );

  // Resolve the unified "courses you want" list against the same requirement universe the engine
  // schedules against, via the shared hook so the embedded cart and generation never diverge.
  const { resolution } = useBasketResolution();

  // Reflect the resolved assignments into the constrained-picks map so each desired course shows up
  // as a locked course inside its requirement (just like a manual pick). The action preserves manual
  // picks and is idempotent at the fixed point, so this converges without looping.
  const assignedKey = JSON.stringify(resolution.assigned);
  useEffect(() => {
    applyDesiredAutoAssignments(resolution.assigned);
    // oxlint-disable-next-line react/exhaustive-deps
  }, [assignedKey, applyDesiredAutoAssignments]);

  const advancedPicksCount = useMemo(
    () => Object.values(constrainedPerRequirement).filter((codes) => codes.length > 0).length,
    [constrainedPerRequirement],
  );

  return (
    <AdvancedGenerationOptionsView
      fields={{
        courseOptions: desiredCourseOptions,
        desiredCourses: basketCourses,
        onDesiredCoursesChange: setBasketCourses,
        renderCourseOption: courseRenderOption,
        courseFilter: courseOptionsFilter,
        coursesSlot: <BasketContents variant="embedded" />,
        countValue: coursesThisSemester,
        onCountChange: (n) =>
          setCoursesThisSemester(Math.max(1, Math.min(SCHEDULE_COURSE_COUNT_MAX, n))),
        countMin: 1,
        countMax: SCHEDULE_COURSE_COUNT_MAX,
        belowCount: (
          <>
            {unassignedCompletedCourses.length > 0 && (
              <Alert color="yellow" variant="light" radius="md">
                {tr("app.generate.disableReason", {
                  count: unassignedCompletedCourses.length,
                  suffix: unassignedCompletedCourses.length === 1 ? "" : "s",
                })}
              </Alert>
            )}
          </>
        ),
        totalFirstYearCredits,
        warnFirstYearLimit,
        limitFirstYearCredits: generationLimitFirstYearCredits,
        onLimitFirstYearCreditsChange: setGenerationLimitFirstYearCredits,
        compressedSchedule: generationCompressedSchedule,
        onCompressedScheduleChange: setGenerationCompressedSchedule,
        preferEasierCourses: generationPreferEasier,
        onPreferEasierCoursesChange: setGenerationPreferEasier,
        preferHigherSentiment: generationPreferHigherSentiment,
        onPreferHigherSentimentChange: setGenerationPreferHigherSentiment,
        minStartMinutes: generationMinStartMinutes,
        onMinStartMinutesChange: setGenerationMinStartMinutes,
        maxEndMinutes: generationMaxEndMinutes,
        onMaxEndMinutesChange: setGenerationMaxEndMinutes,
        avoidedDays: avoidedDaysFromBlocks(blockedTimes),
        onAvoidedDaysChange: setAvoidedDays,
        minProfessorRating: generationMinProfessorRating,
        onMinProfessorRatingChange: setGenerationMinProfessorRating,
        levelBuckets,
        languageBuckets,
        electiveLevelBuckets,
        includeClosedComponents,
        virtualSectionsOnly,
        onChangeLevelBuckets: setLevelBuckets,
        onChangeLanguageBuckets: setLanguageBuckets,
        onChangeElectiveLevelBuckets: setElectiveLevelBuckets,
        onIncludeClosedComponentsChange: setIncludeClosedComponents,
        onVirtualSectionsOnlyChange: setVirtualSectionsOnly,
        excludeSubjects: {
          data: allCategories.map((c) => ({ value: c, label: c })),
          value: basicExcludedCategories,
          onChange: setBasicExcludedCategories,
        },
        excludeCourses: {
          data: courseOptions,
          value: blacklistedCourses,
          onChange: setBlacklistedCourses,
          renderOption: courseRenderOption,
          filter: courseOptionsFilter,
        },
        frenchImmersionStream,
        onFrenchImmersionStreamChange: setFrenchImmersionStream,
      }}
      advancedPicksCount={advancedPicksCount}
      constrain={{
        cache,
        remainingRequirements,
        requirementTreeWithStatus,
        completedRequirementsList,
        completedCourses,
        selectedPerRequirement,
        constrainedPerRequirement,
        onConstrain: setConstrainedForRequirement,
        selectedOptionsPerRequirement,
        prereqEligibleCourses: filteredPrereqEligibleCourses,
        levelBuckets,
        languageBuckets,
        electiveLevelBuckets,
        includeClosedComponents,
        virtualSectionsOnly,
      }}
    />
  );
}
