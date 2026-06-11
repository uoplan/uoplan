import { useMemo } from "react";
import { Box, Button, MultiSelect, Stack, Text } from "@mantine/core";
import { IconFileUpload } from "@tabler/icons-react";
import { getCourseCredits, normalizeCourseCode } from "@uoplan/core";
import { useAppStore } from "../../store/appStore";
import { createCourseOptions } from "../shared/CourseSelect";
import { GenerationOptionsFields } from "./generationOptions/GenerationOptionsFields";
import { avoidedDaysFromBlocks } from "../../lib/blockedTimes";
import { tr } from "../../i18n";
import { navigateToWizardStep } from "../../lib/appNavigation";
import { WizardStep } from "../../lib/wizardSteps";
import { SCHEDULE_COURSE_COUNT_MAX } from "../../store/generationDefaults";
import { useSharedGenerationOptions } from "./generationOptions/useSharedGenerationOptions";

const FIRST_YEAR_CREDIT_CAP = 48;

export function BasicCalendarSidebarControls() {
  const {
    cache,
    basicPinnedCourses,
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
    generationMinProfessorRating,
    generationLimitFirstYearCredits,
    generationCompressedSchedule,
    generationPreferEasier,
    generationPreferHigherSentiment,
    blacklistedCourses,
    allCategories,
    courseOptions,
    courseOptionsFilter,
    courseRenderOption,
    desiredCourseOptions,
    setFrenchImmersionStream,
    setBlacklistedCourses,
    setBasicPinnedCourses,
    setBasicExcludedCategories,
    setLevelBuckets,
    setLanguageBuckets,
    setElectiveLevelBuckets,
    setIncludeClosedComponents,
    setVirtualSectionsOnly,
    setGenerationMinStartMinutes,
    setGenerationMaxEndMinutes,
    setAvoidedDays,
    setGenerationMinProfessorRating,
    setGenerationLimitFirstYearCredits,
    setGenerationCompressedSchedule,
    setGenerationPreferEasier,
    setGenerationPreferHigherSentiment,
  } = useSharedGenerationOptions();

  const setBasicElectivesCount = useAppStore((s) => s.setBasicElectivesCount);
  const markBasicSettingsChanged = useAppStore((s) => s.markBasicSettingsChanged);
  const setCompletedCourses = useAppStore((s) => s.setCompletedCourses);

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
    for (const code of [...completedCourses, ...basicPinnedCourses]) {
      const norm = normalizeCourseCode(code);
      if (seen.has(norm)) continue;
      seen.add(norm);
      const m = norm.match(/\d{4}/);
      if (!m || Number(m[0]) >= 2000) continue;
      total += getCourseCredits(norm, cache);
    }
    return total;
  }, [cache, completedCourses, basicPinnedCourses]);

  const totalCount = basicPinnedCourses.length + basicElectivesCount;

  return (
    <>
      <GenerationOptionsFields
        courseOptions={desiredCourseOptions}
        desiredCourses={basicPinnedCourses}
        onDesiredCoursesChange={(v) => {
          setBasicPinnedCourses(v);
          markBasicSettingsChanged();
        }}
        renderCourseOption={courseRenderOption}
        courseFilter={courseOptionsFilter}
        countValue={totalCount}
        onCountChange={(total) => {
          const next = Math.max(
            0,
            Math.min(SCHEDULE_COURSE_COUNT_MAX, total - basicPinnedCourses.length),
          );
          if (next === basicElectivesCount) return;
          setBasicElectivesCount(next);
          markBasicSettingsChanged();
        }}
        countMin={Math.max(1, basicPinnedCourses.length)}
        countMax={basicPinnedCourses.length + SCHEDULE_COURSE_COUNT_MAX}
        totalFirstYearCredits={totalFirstYearCredits}
        warnFirstYearLimit={totalFirstYearCredits > FIRST_YEAR_CREDIT_CAP}
        limitFirstYearCredits={generationLimitFirstYearCredits}
        onLimitFirstYearCreditsChange={(v) => {
          setGenerationLimitFirstYearCredits(v);
          markBasicSettingsChanged();
        }}
        compressedSchedule={generationCompressedSchedule}
        onCompressedScheduleChange={(v) => {
          setGenerationCompressedSchedule(v);
          markBasicSettingsChanged();
        }}
        preferEasierCourses={generationPreferEasier}
        onPreferEasierCoursesChange={(v) => {
          setGenerationPreferEasier(v);
          markBasicSettingsChanged();
        }}
        preferHigherSentiment={generationPreferHigherSentiment}
        onPreferHigherSentimentChange={(v) => {
          setGenerationPreferHigherSentiment(v);
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
        minProfessorRating={generationMinProfessorRating}
        onMinProfessorRatingChange={(r) => {
          setGenerationMinProfessorRating(r);
          markBasicSettingsChanged();
        }}
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
        secondaryOptionsDisclosure={{
          heading: tr("generationOptions.moreOptions.heading"),
          badgeLabel: tr("app.constraints.optional"),
          collapseId: "basic-more-options-collapse",
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
