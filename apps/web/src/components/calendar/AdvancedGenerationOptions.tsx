import { useEffect, useMemo } from "react";
import { Alert } from "@mantine/core";
import { buildEffectiveRemainingRequirements, normalizeCourseCode } from "@uoplan/core";
import { useAppStore } from "../../store/appStore";
import { useTr, tr } from "../../i18n";
import { computeFirstYearCredits } from "../../lib/generation/advancedGenerationDerivations";
import { AdvancedGenerationOptionsView } from "./AdvancedGenerationOptionsView";
import { DesiredCourseWarnings } from "./generationOptions/DesiredCourseWarnings";
import { resolveDesiredCourses } from "../../lib/generation/resolveDesiredCourses";
import { avoidedDaysFromBlocks } from "../../lib/blockedTimes";
import { createCourseOptionsFilter, renderCourseOption } from "../shared/CourseSelect";

export function AdvancedGenerationOptions() {
  useTr();
  const cache = useAppStore((s) => s.cache);
  const remainingRequirements = useAppStore((s) => s.remainingRequirements);
  const requirementTreeWithStatus = useAppStore((s) => s.requirementTreeWithStatus);
  const completedRequirementsList = useAppStore((s) => s.completedRequirementsList);
  const completedCourses = useAppStore((s) => s.completedCourses);
  const selectedPerRequirement = useAppStore((s) => s.selectedPerRequirement);
  const constrainedPerRequirement = useAppStore((s) => s.constrainedPerRequirement);
  const selectedOptionsPerRequirement = useAppStore((s) => s.selectedOptionsPerRequirement);
  const filteredPrereqEligibleCourses = useAppStore((s) => s.filteredPrereqEligibleCourses);
  const prereqEligibleCourses = useAppStore((s) => s.prereqEligibleCourses);
  const coursesThisSemester = useAppStore((s) => s.coursesThisSemester);
  const basicPinnedCourses = useAppStore((s) => s.basicPinnedCourses);
  const basicExcludedCategories = useAppStore((s) => s.basicExcludedCategories);
  const generationMinStartMinutes = useAppStore((s) => s.generationMinStartMinutes);
  const generationMaxEndMinutes = useAppStore((s) => s.generationMaxEndMinutes);
  const blockedTimes = useAppStore((s) => s.blockedTimes);
  const generationMinProfessorRating = useAppStore((s) => s.generationMinProfessorRating);
  const levelBuckets = useAppStore((s) => s.levelBuckets);
  const languageBuckets = useAppStore((s) => s.languageBuckets);
  const electiveLevelBuckets = useAppStore((s) => s.electiveLevelBuckets);
  const includeClosedComponents = useAppStore((s) => s.includeClosedComponents);
  const virtualSectionsOnly = useAppStore((s) => s.virtualSectionsOnly);
  const generationLimitFirstYearCredits = useAppStore((s) => s.generationLimitFirstYearCredits);
  const generationCompressedSchedule = useAppStore((s) => s.generationCompressedSchedule);
  const generationPreferEasier = useAppStore((s) => s.generationPreferEasier);
  const blacklistedCourses = useAppStore((s) => s.blacklistedCourses);
  const frenchImmersionStream = useAppStore((s) => s.frenchImmersionStream);
  const unassignedCompletedCourses = useAppStore((s) => s.unassignedCompletedCourses);

  const setCoursesThisSemester = useAppStore((s) => s.setCoursesThisSemester);
  const setBasicPinnedCourses = useAppStore((s) => s.setBasicPinnedCourses);
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
  const setBlacklistedCourses = useAppStore((s) => s.setBlacklistedCourses);
  const setFrenchImmersionStream = useAppStore((s) => s.setFrenchImmersionStream);
  const setConstrainedForRequirement = useAppStore((s) => s.setConstrainedForRequirement);
  const applyDesiredAutoAssignments = useAppStore((s) => s.applyDesiredAutoAssignments);

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

  // The "courses you want" dropdown should not offer courses the student has already completed.
  const desiredCourseOptions = useMemo(() => {
    if (completedCourses.length === 0) return courseOptions;
    const completed = new Set(completedCourses.map(normalizeCourseCode));
    return courseOptions.filter((o) => !completed.has(normalizeCourseCode(o.value)));
  }, [courseOptions, completedCourses]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        onCountChange: (n) => setCoursesThisSemester(Math.max(1, Math.min(10, n))),
        countMin: 1,
        countMax: 10,
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
