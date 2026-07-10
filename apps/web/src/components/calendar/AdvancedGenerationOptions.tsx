import { useEffect, useMemo } from "react";
import { Alert } from "@mantine/core";
import {
  useAdditionalElectives,
  useCoursesThisSemester,
  useRequirementActions,
} from "@uoplan/store/hooks";
import { tr, useTr } from "../../i18n";
import { computeFirstYearCredits } from "../../lib/generation/advancedGenerationDerivations";
import { AdvancedGenerationOptionsView } from "./AdvancedGenerationOptionsView";
import { BasketContents } from "../basket/BasketContents";
import { useBasketResolution } from "../../lib/generation/useBasketResolution";
import { avoidedDaysFromBlocks } from "@uoplan/store/blockedTimes";
import { SCHEDULE_COURSE_COUNT_MAX } from "@uoplan/store/generationDefaults";
import { useSharedGenerationOptions } from "./generationOptions/useSharedGenerationOptions";
import { useRequirementAssignmentState } from "../requirements/useRequirementAssignmentState";

export function AdvancedGenerationOptions() {
  useTr();
  const {
    cache,
    completedCourses,
    basicExcludedCategories,
    generationMinStartMinutes,
    generationMaxEndMinutes,
    blockedTimes,
    levelBuckets,
    languageBuckets,
    electiveLevelBuckets,
    includeClosedComponents,
    virtualSectionsOnly,
    generationLimitFirstYearCredits,
    optimizationPriorities,
    blacklistedCourses,
    frenchImmersionStream,
    allCategories,
    courseOptions,
    courseOptionsFilter,
    courseRenderOption,
    setBasicExcludedCategories,
    setGenerationMinStartMinutes,
    setGenerationMaxEndMinutes,
    setAvoidedDays,
    setLevelBuckets,
    setLanguageBuckets,
    setElectiveLevelBuckets,
    setIncludeClosedComponents,
    setVirtualSectionsOnly,
    setGenerationLimitFirstYearCredits,
    setOptimizationPriorities,
    reorderOptimizationPriorities,
    setOptimizationPriorityEnabled,
    setGoodBreaksParams,
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
  const { additionalElectivesCount, setAdditionalElectivesCount } = useAdditionalElectives();
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

  const coursesThisSemesterMin = 0;
  const coursesThisSemesterMax = SCHEDULE_COURSE_COUNT_MAX;
  const additionalElectivesMin = 0;
  const additionalElectivesMax = SCHEDULE_COURSE_COUNT_MAX;

  const advancedPicksCount = useMemo(
    () => Object.values(constrainedPerRequirement).filter((codes) => codes.length > 0).length,
    [constrainedPerRequirement],
  );

  return (
    <AdvancedGenerationOptionsView
      fields={{
        coursesSlot: <BasketContents variant="embedded" />,
        coursesThisSemesterValue: coursesThisSemester,
        onCoursesThisSemesterChange: (n) => {
          const next = Math.max(coursesThisSemesterMin, Math.min(coursesThisSemesterMax, n));
          if (next === coursesThisSemester) return;
          setCoursesThisSemester(next);
        },
        coursesThisSemesterMin,
        coursesThisSemesterMax,
        countValue: additionalElectivesCount,
        onCountChange: (n) => {
          const next = Math.max(additionalElectivesMin, Math.min(additionalElectivesMax, n));
          if (next === additionalElectivesCount) return;
          setAdditionalElectivesCount(next);
        },
        countMin: additionalElectivesMin,
        countMax: additionalElectivesMax,
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
        optimizationPriorities,
        onReorderPriorities: reorderOptimizationPriorities,
        onSetPriorities: setOptimizationPriorities,
        onTogglePriority: setOptimizationPriorityEnabled,
        onGoodBreaksParamsChange: setGoodBreaksParams,
        minStartMinutes: generationMinStartMinutes,
        onMinStartMinutesChange: setGenerationMinStartMinutes,
        maxEndMinutes: generationMaxEndMinutes,
        onMaxEndMinutesChange: setGenerationMaxEndMinutes,
        avoidedDays: avoidedDaysFromBlocks(blockedTimes),
        onAvoidedDaysChange: setAvoidedDays,
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
