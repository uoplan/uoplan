import { useEffect, useMemo } from "react";
import { Box, Button, MultiSelect, Stack, Text } from "@mantine/core";
import { IconFileUpload } from "@tabler/icons-react";
import { getCourseCredits, normalizeCourseCode } from "@uoplan/core";
import { useBasicElectives, useCompletedCourses, useScheduleGeneration } from "../../store/hooks";
import { BasketContents } from "../basket/BasketContents";
import { createCourseOptions } from "../shared/CourseSelect";
import { GenerationOptionsFields } from "./generationOptions/GenerationOptionsFields";
import { avoidedDaysFromBlocks } from "../../lib/blockedTimes";
import { tr } from "../../i18n";
import { useAnalytics } from "../../lib/analytics";
import { navigateToWizardStep } from "../../lib/appNavigation";
import { WizardStep } from "../../lib/wizardSteps";
import { SCHEDULE_COURSE_COUNT_MAX } from "../../store/generationDefaults";
import { useSharedGenerationOptions } from "./generationOptions/useSharedGenerationOptions";

const FIRST_YEAR_CREDIT_CAP = 48;

export function BasicCalendarSidebarControls() {
  const {
    cache,
    basketCourses,
    basicElectivesCount,
    basicExcludedCategories,
    levelBuckets,
    languageBuckets,
    electiveLevelBuckets,
    includeClosedComponents,
    virtualSectionsOnly,
    completedCourses,
    frenchImmersionStream,
    blockedTimes,
    generationMinStartMinutes,
    generationMaxEndMinutes,
    generationLimitFirstYearCredits,
    optimizationPriorities,
    blacklistedCourses,
    allCategories,
    courseOptions,
    courseOptionsFilter,
    courseRenderOption,
    setFrenchImmersionStream,
    setBlacklistedCourses,
    setBasicExcludedCategories,
    setLevelBuckets,
    setLanguageBuckets,
    setElectiveLevelBuckets,
    setIncludeClosedComponents,
    setVirtualSectionsOnly,
    setGenerationMinStartMinutes,
    setGenerationMaxEndMinutes,
    setAvoidedDays,
    setGenerationLimitFirstYearCredits,
    setOptimizationPriorities,
    reorderOptimizationPriorities,
    setOptimizationPriorityEnabled,
    setGoodBreaksParams,
  } = useSharedGenerationOptions();

  const { setBasicElectivesCount } = useBasicElectives();
  const { markBasicSettingsChanged } = useScheduleGeneration();
  const { setCompletedCourses } = useCompletedCourses();
  const analytics = useAnalytics();

  const completedCourseOptions = useMemo(() => {
    if (!cache) return [];
    const unique = [...new Set(cache.getAllCourses().map((c) => c.code))];
    return createCourseOptions(unique, cache);
  }, [cache]);

  // First-year (1xxx) credits the user has committed (completed + courses they want this term).
  const totalFirstYearCredits = useMemo(() => {
    if (!cache) return 0;
    const seen = new Set<string>();
    let total = 0;
    for (const code of [...completedCourses, ...basketCourses]) {
      const norm = normalizeCourseCode(code);
      if (seen.has(norm)) continue;
      seen.add(norm);
      const m = norm.match(/\d{4}/);
      if (!m || Number(m[0]) >= 2000) continue;
      total += getCourseCredits(norm, cache);
    }
    return total;
  }, [cache, completedCourses, basketCourses]);
  const additionalElectivesMax = Math.max(0, SCHEDULE_COURSE_COUNT_MAX - basketCourses.length);
  const additionalElectivesMin = basketCourses.length > 0 ? 0 : 1;

  useEffect(() => {
    const next = Math.max(
      additionalElectivesMin,
      Math.min(additionalElectivesMax, basicElectivesCount),
    );
    if (next === basicElectivesCount) return;
    setBasicElectivesCount(next);
    markBasicSettingsChanged();
  }, [
    additionalElectivesMax,
    additionalElectivesMin,
    basicElectivesCount,
    markBasicSettingsChanged,
    setBasicElectivesCount,
  ]);

  return (
    <>
      <GenerationOptionsFields
        coursesSlot={<BasketContents variant="embedded" />}
        countValue={basicElectivesCount}
        onCountChange={(count) => {
          const next = Math.max(additionalElectivesMin, Math.min(additionalElectivesMax, count));
          if (next === basicElectivesCount) return;
          setBasicElectivesCount(next);
          markBasicSettingsChanged();
        }}
        countMin={additionalElectivesMin}
        countMax={additionalElectivesMax}
        totalFirstYearCredits={totalFirstYearCredits}
        warnFirstYearLimit={totalFirstYearCredits > FIRST_YEAR_CREDIT_CAP}
        limitFirstYearCredits={generationLimitFirstYearCredits}
        onLimitFirstYearCreditsChange={(v) => {
          setGenerationLimitFirstYearCredits(v);
          markBasicSettingsChanged();
        }}
        optimizationPriorities={optimizationPriorities}
        onReorderPriorities={(from, to) => {
          reorderOptimizationPriorities(from, to);
          markBasicSettingsChanged();
        }}
        onSetPriorities={(next) => {
          setOptimizationPriorities(next);
          markBasicSettingsChanged();
        }}
        onTogglePriority={(kind, enabled) => {
          setOptimizationPriorityEnabled(kind, enabled);
          markBasicSettingsChanged();
        }}
        onGoodBreaksParamsChange={(params) => {
          setGoodBreaksParams(params);
          markBasicSettingsChanged();
        }}
        minStartMinutes={generationMinStartMinutes}
        onMinStartMinutesChange={(m) => {
          setGenerationMinStartMinutes(m);
          markBasicSettingsChanged();
        }}
        maxEndMinutes={generationMaxEndMinutes}
        onMaxEndMinutesChange={(m) => {
          setGenerationMaxEndMinutes(m);
          markBasicSettingsChanged();
        }}
        avoidedDays={avoidedDaysFromBlocks(blockedTimes)}
        onAvoidedDaysChange={(days) => setAvoidedDays(days)}
        levelBuckets={levelBuckets}
        languageBuckets={languageBuckets}
        electiveLevelBuckets={electiveLevelBuckets}
        includeClosedComponents={includeClosedComponents}
        virtualSectionsOnly={virtualSectionsOnly}
        onChangeLevelBuckets={(buckets) => {
          setLevelBuckets(buckets);
          markBasicSettingsChanged();
        }}
        onChangeLanguageBuckets={(buckets) => {
          setLanguageBuckets(buckets);
          markBasicSettingsChanged();
        }}
        onChangeElectiveLevelBuckets={(buckets) => {
          setElectiveLevelBuckets(buckets);
          markBasicSettingsChanged();
        }}
        onIncludeClosedComponentsChange={(checked) => {
          setIncludeClosedComponents(checked);
          markBasicSettingsChanged();
        }}
        onVirtualSectionsOnlyChange={(checked) => {
          setVirtualSectionsOnly(checked);
          markBasicSettingsChanged();
        }}
        excludeSubjects={{
          data: allCategories.map((c) => ({ value: c, label: c })),
          value: basicExcludedCategories,
          onChange: (v) => {
            setBasicExcludedCategories(v);
            markBasicSettingsChanged();
          },
        }}
        excludeCourses={{
          data: courseOptions,
          value: blacklistedCourses,
          onChange: (v) => {
            setBlacklistedCourses(v);
            markBasicSettingsChanged();
          },
          renderOption: courseRenderOption,
          filter: courseOptionsFilter,
        }}
        frenchImmersionStream={frenchImmersionStream}
        onFrenchImmersionStreamChange={(checked) => {
          setFrenchImmersionStream(checked);
          markBasicSettingsChanged();
        }}
        advancedOptions={{
          collapseId: "basic-advanced-options-collapse",
        }}
      />

      <Box style={{ borderTop: "1px solid var(--app-border)", paddingTop: 16, marginTop: 8 }}>
        <Text size="sm" fw={600} mb={8} style={{ color: "var(--app-text)" }}>
          {tr("basicCalendar.prereq.heading")}
        </Text>
        <Text size="xs" style={{ color: "var(--app-text-muted)", marginBottom: 12 }}>
          {tr("basicCalendar.prereq.description")}
        </Text>
        <Stack gap="sm">
          <MultiSelect
            placeholder={tr("basicCalendar.completed.placeholder")}
            data={completedCourseOptions}
            value={completedCourses}
            onChange={(v) => {
              setCompletedCourses(v);
              analytics.capture("completed_courses_updated", { count: v.length, source: "manual" });
              markBasicSettingsChanged();
            }}
            searchable
            clearable
            renderOption={courseRenderOption}
            filter={courseOptionsFilter}
            nothingFoundMessage={tr("basicCalendar.completed.notFound")}
            radius="md"
          />

          <Button
            size="sm"
            color="gray"
            variant="light"
            radius="md"
            leftSection={<IconFileUpload size={14} />}
            fullWidth
            onClick={() => navigateToWizardStep(WizardStep.Program)}
          >
            {tr("basicCalendar.transcript.upload")}
          </Button>
        </Stack>
      </Box>
    </>
  );
}
