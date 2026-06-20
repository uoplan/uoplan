import { useEffect, useMemo } from "react";
import { Alert } from "@mantine/core";
import {
  buildRequirementPools,
  isGroupToken,
  normalizeCourseCode,
  poolCourseCap,
} from "@uoplan/core";
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

function countSelectedElectiveCourses(
  constrainedPerRequirement: Record<string, string[]>,
  autoConstrainedPerRequirement: Record<string, string[]>,
  assignedBasketCourses: Record<string, string[]>,
  standaloneBasketCourses: string[],
): number {
  const selected = new Set<string>();
  let groupTokenSlots = 0;
  const add = (code: string) => {
    if (isGroupToken(code)) {
      groupTokenSlots += 1;
      return;
    }
    selected.add(normalizeCourseCode(code));
  };
  for (const [reqId, codes] of Object.entries(constrainedPerRequirement)) {
    const autoNorms = new Set(
      (autoConstrainedPerRequirement[reqId] ?? []).map((code) => normalizeCourseCode(code)),
    );
    for (const code of codes) {
      if (!autoNorms.has(normalizeCourseCode(code))) add(code);
    }
  }
  for (const codes of Object.values(assignedBasketCourses)) {
    for (const code of codes) add(code);
  }
  for (const code of standaloneBasketCourses) add(code);
  return selected.size + groupTokenSlots;
}

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
    autoConstrainedPerRequirement,
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
  const { resolution, effectiveRemainingRequirements } = useBasketResolution();

  // Reflect the resolved assignments into the constrained-picks map so each desired course shows up
  // as a locked course inside its requirement (just like a manual pick). The action preserves manual
  // picks and is idempotent at the fixed point, so this converges without looping.
  const assignedKey = JSON.stringify(resolution.assigned);
  useEffect(() => {
    applyDesiredAutoAssignments(resolution.assigned);
    // oxlint-disable-next-line react/exhaustive-deps
  }, [assignedKey, applyDesiredAutoAssignments]);

  const selectedElectivesCount = useMemo(
    () =>
      countSelectedElectiveCourses(
        constrainedPerRequirement,
        autoConstrainedPerRequirement,
        resolution.assigned,
        resolution.standalone,
      ),
    [
      constrainedPerRequirement,
      autoConstrainedPerRequirement,
      resolution.assigned,
      resolution.standalone,
    ],
  );

  const totalElectivesNeeded = useMemo(() => {
    const pools = buildRequirementPools(effectiveRemainingRequirements);
    return pools.reduce((sum, pool) => sum + poolCourseCap(pool), 0);
  }, [effectiveRemainingRequirements]);

  const additionalElectivesMax = Math.min(
    Math.max(0, totalElectivesNeeded - selectedElectivesCount),
    Math.max(0, SCHEDULE_COURSE_COUNT_MAX - selectedElectivesCount),
  );

  const additionalElectivesMin = additionalElectivesMax === 0 || selectedElectivesCount > 0 ? 0 : 1;

  useEffect(() => {
    const next = Math.max(
      additionalElectivesMin,
      Math.min(additionalElectivesMax, coursesThisSemester),
    );
    if (coursesThisSemester === next) return;
    setCoursesThisSemester(next);
  }, [additionalElectivesMax, additionalElectivesMin, coursesThisSemester, setCoursesThisSemester]);

  const additionalElectivesCount = Math.max(
    additionalElectivesMin,
    Math.min(coursesThisSemester, additionalElectivesMax),
  );

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
        countValue: additionalElectivesCount,
        onCountChange: (n) => {
          const nextAdditional = Math.max(
            additionalElectivesMin,
            Math.min(additionalElectivesMax, n),
          );
          if (nextAdditional === coursesThisSemester) return;
          setCoursesThisSemester(nextAdditional);
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
