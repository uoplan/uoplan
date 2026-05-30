import { useMemo } from "react";
import { useLingui } from "@lingui/react";
import { useAppStore } from "../../store/appStore";
import { tr } from "../../i18n";
import { formatGenerationMessage } from "../../lib/generationDiagnosticsText";
import {
  buildPoolCourseOptions,
  computeFirstYearCredits,
  countUniqueSelected,
} from "../../lib/generation/advancedGenerationDerivations";
import { AdvancedGenerationOptionsView } from "./AdvancedGenerationOptionsView";

export function AdvancedGenerationOptions() {
  useLingui();
  const cache = useAppStore((s) => s.cache);
  const remainingRequirements = useAppStore((s) => s.remainingRequirements);
  const requirementTreeWithStatus = useAppStore((s) => s.requirementTreeWithStatus);
  const completedRequirementsList = useAppStore((s) => s.completedRequirementsList);
  const completedCourses = useAppStore((s) => s.completedCourses);
  const selectedPerRequirement = useAppStore((s) => s.selectedPerRequirement);
  const constrainedPerRequirement = useAppStore((s) => s.constrainedPerRequirement);
  const selectedOptionsPerRequirement = useAppStore((s) => s.selectedOptionsPerRequirement);
  const filteredPrereqEligibleCourses = useAppStore((s) => s.filteredPrereqEligibleCourses);
  const coursesThisSemester = useAppStore((s) => s.coursesThisSemester);
  const generationMinStartMinutes = useAppStore((s) => s.generationMinStartMinutes);
  const generationMaxEndMinutes = useAppStore((s) => s.generationMaxEndMinutes);
  const generationAllowedDays = useAppStore((s) => s.generationAllowedDays);
  const generationMinProfessorRating = useAppStore((s) => s.generationMinProfessorRating);
  const generationError = useAppStore((s) => s.generationError);
  const levelBuckets = useAppStore((s) => s.levelBuckets);
  const languageBuckets = useAppStore((s) => s.languageBuckets);
  const electiveLevelBuckets = useAppStore((s) => s.electiveLevelBuckets);
  const includeClosedComponents = useAppStore((s) => s.includeClosedComponents);
  const virtualSectionsOnly = useAppStore((s) => s.virtualSectionsOnly);
  const generationLimitFirstYearCredits = useAppStore((s) => s.generationLimitFirstYearCredits);
  const generationCompressedSchedule = useAppStore((s) => s.generationCompressedSchedule);
  const generationPreferEasier = useAppStore((s) => s.generationPreferEasier);
  const blacklistedCourses = useAppStore((s) => s.blacklistedCourses);
  const unassignedCompletedCourses = useAppStore((s) => s.unassignedCompletedCourses);

  const setCoursesThisSemester = useAppStore((s) => s.setCoursesThisSemester);
  const setGenerationMinProfessorRating = useAppStore((s) => s.setGenerationMinProfessorRating);
  const setGenerationMinStartMinutes = useAppStore((s) => s.setGenerationMinStartMinutes);
  const setGenerationMaxEndMinutes = useAppStore((s) => s.setGenerationMaxEndMinutes);
  const setGenerationAllowedDays = useAppStore((s) => s.setGenerationAllowedDays);
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
  const setConstrainedForRequirement = useAppStore((s) => s.setConstrainedForRequirement);

  const allPoolCourses = useMemo(
    () => buildPoolCourseOptions(remainingRequirements, completedCourses),
    [remainingRequirements, completedCourses],
  );

  const uniqueSelected = countUniqueSelected(selectedPerRequirement);
  const { total: totalFirstYearCredits, warn: warnFirstYearLimit } = computeFirstYearCredits(
    cache,
    completedCourses,
    selectedPerRequirement,
  );

  return (
    <AdvancedGenerationOptionsView
      scheduleCount={{
        coursesThisSemester,
        onCoursesChange: setCoursesThisSemester,
        selectedCount: uniqueSelected,
        minStartMinutes: generationMinStartMinutes,
        onMinStartMinutesChange: setGenerationMinStartMinutes,
        maxEndMinutes: generationMaxEndMinutes,
        onMaxEndMinutesChange: setGenerationMaxEndMinutes,
        allowedDays: generationAllowedDays,
        onAllowedDaysChange: setGenerationAllowedDays,
        minProfessorRating: generationMinProfessorRating,
        onMinProfessorRatingChange: setGenerationMinProfessorRating,
        totalFirstYearCredits,
        warnFirstYearLimit,
        limitFirstYearCredits: generationLimitFirstYearCredits,
        onLimitFirstYearCreditsChange: setGenerationLimitFirstYearCredits,
        compressedSchedule: generationCompressedSchedule,
        onCompressedScheduleChange: setGenerationCompressedSchedule,
        preferEasierCourses: generationPreferEasier,
        onPreferEasierCoursesChange: setGenerationPreferEasier,
        blacklistedCourses,
        allPoolCourses,
        onBlacklistedCoursesChange: setBlacklistedCourses,
        onGenerate: () => {},
        generating: false,
        error: generationError ? formatGenerationMessage(generationError.message) : null,
        errorDetails: generationError?.details ?? null,
        disableGenerate: unassignedCompletedCourses.length > 0,
        disableGenerateReason: tr("app.generate.disableReason", {
          count: unassignedCompletedCourses.length,
          suffix: unassignedCompletedCourses.length === 1 ? "" : "s",
        }),
      }}
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
        onChangeLevelBuckets: setLevelBuckets,
        onChangeLanguageBuckets: setLanguageBuckets,
        electiveLevelBuckets,
        onChangeElectiveLevelBuckets: setElectiveLevelBuckets,
        includeClosedComponents,
        onIncludeClosedComponentsChange: setIncludeClosedComponents,
        virtualSectionsOnly,
        onVirtualSectionsOnlyChange: setVirtualSectionsOnly,
      }}
    />
  );
}
