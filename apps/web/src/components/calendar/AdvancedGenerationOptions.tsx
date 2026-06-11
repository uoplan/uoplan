import { useEffect, useMemo } from "react";
import { Alert } from "@mantine/core";
import { buildEffectiveRemainingRequirements } from "@uoplan/core";
import { useAppStore } from "../../store/appStore";
import { tr, useTr } from "../../i18n";
import { computeFirstYearCredits } from "../../lib/generation/advancedGenerationDerivations";
import { AdvancedGenerationOptionsView } from "./AdvancedGenerationOptionsView";
import { DesiredCourseWarnings } from "./generationOptions/DesiredCourseWarnings";
import { resolveDesiredCourses } from "../../lib/generation/resolveDesiredCourses";
import { avoidedDaysFromBlocks } from "../../lib/blockedTimes";
import { SCHEDULE_COURSE_COUNT_MAX } from "../../store/generationDefaults";
import { useSharedGenerationOptions } from "./generationOptions/useSharedGenerationOptions";
import { useRequirementAssignmentState } from "../requirements/useRequirementAssignmentState";

export function AdvancedGenerationOptions() {
  useTr();
  const {
    cache,
    completedCourses,
    basicPinnedCourses,
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
    setBasicPinnedCourses,
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
  const prereqEligibleCourses = useAppStore((s) => s.prereqEligibleCourses);
  const coursesThisSemester = useAppStore((s) => s.coursesThisSemester);

  const setCoursesThisSemester = useAppStore((s) => s.setCoursesThisSemester);
  const setConstrainedForRequirement = useAppStore((s) => s.setConstrainedForRequirement);
  const applyDesiredAutoAssignments = useAppStore((s) => s.applyDesiredAutoAssignments);

  const { total: totalFirstYearCredits, warn: warnFirstYearLimit } = computeFirstYearCredits(
    cache,
    completedCourses,
    selectedPerRequirement,
  );

  // Resolve the unified "courses you want" list against the same requirement universe the engine
  // schedules against, mirroring the generation adapter so warnings never diverge from results.
  const { resolution, assignments } = useMemo(() => {
    const effectiveRemainingRequirements = buildEffectiveRemainingRequirements(
      remainingRequirements,
      requirementTreeWithStatus,
      selectedOptionsPerRequirement,
    );
    const resolved = resolveDesiredCourses(
      effectiveRemainingRequirements,
      basicPinnedCourses,
      completedCourses,
      constrainedPerRequirement,
      selectedPerRequirement,
      prereqEligibleCourses,
      cache,
    );
    const titleByReqId = new Map(
      effectiveRemainingRequirements.map((req, index) => [
        req.requirementId,
        req.title ?? tr("generationOptions.warn.assigned.fallbackTitle", { index: index + 1 }),
      ]),
    );
    const assigned = Object.entries(resolved.assigned).map(([reqId, codes]) => ({
      requirementTitle: titleByReqId.get(reqId) ?? reqId,
      codes,
    }));
    return { resolution: resolved, assignments: assigned };
  }, [
    remainingRequirements,
    requirementTreeWithStatus,
    selectedOptionsPerRequirement,
    basicPinnedCourses,
    completedCourses,
    constrainedPerRequirement,
    selectedPerRequirement,
    prereqEligibleCourses,
    cache,
  ]);

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
        desiredCourses: basicPinnedCourses,
        onDesiredCoursesChange: setBasicPinnedCourses,
        renderCourseOption: courseRenderOption,
        courseFilter: courseOptionsFilter,
        belowCourses: <DesiredCourseWarnings resolution={resolution} assignments={assignments} />,
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
