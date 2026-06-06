import { useMemo } from "react";
import { Box, Button, MultiSelect, Stack, Text, type OptionsFilter } from "@mantine/core";
import { IconFileUpload } from "@tabler/icons-react";
import { useShallow } from "zustand/react/shallow";
import { getCourseCredits, normalizeCourseCode } from "@uoplan/core";
import { useAppStore } from "../../store/appStore";
import {
  createCourseOptions,
  renderCourseOption,
  createCourseOptionsFilter,
} from "../shared/CourseSelect";
import { GenerationOptionsFields } from "./generationOptions/GenerationOptionsFields";
import { avoidedDaysFromBlocks } from "../../lib/blockedTimes";
import { tr } from "../../i18n";
import { navigateToWizardStep } from "../../lib/appNavigation";
import { WizardStep } from "../../lib/wizardSteps";
import { SCHEDULE_COURSE_COUNT_MAX } from "../../store/generationDefaults";

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
  } = useAppStore(
    useShallow((s) => ({
      cache: s.cache,
      basicPinnedCourses: s.basicPinnedCourses,
      basicElectivesCount: s.basicElectivesCount,
      basicExcludedCategories: s.basicExcludedCategories,
      levelBuckets: s.levelBuckets,
      languageBuckets: s.languageBuckets,
      electiveLevelBuckets: s.electiveLevelBuckets,
      includeClosedComponents: s.includeClosedComponents,
      virtualSectionsOnly: s.virtualSectionsOnly,
      completedCourses: s.completedCourses,
      frenchImmersionStream: s.frenchImmersionStream,
      blockedTimes: s.blockedTimes,
      generationMinStartMinutes: s.generationMinStartMinutes,
      generationMaxEndMinutes: s.generationMaxEndMinutes,
      generationMinProfessorRating: s.generationMinProfessorRating,
      generationLimitFirstYearCredits: s.generationLimitFirstYearCredits,
      generationCompressedSchedule: s.generationCompressedSchedule,
      generationPreferEasier: s.generationPreferEasier,
    })),
  );

  const setFrenchImmersionStream = useAppStore((s) => s.setFrenchImmersionStream);
  const blacklistedCourses = useAppStore((s) => s.blacklistedCourses);
  const setBlacklistedCourses = useAppStore((s) => s.setBlacklistedCourses);
  const setBasicPinnedCourses = useAppStore((s) => s.setBasicPinnedCourses);
  const setBasicElectivesCount = useAppStore((s) => s.setBasicElectivesCount);
  const setBasicExcludedCategories = useAppStore((s) => s.setBasicExcludedCategories);
  const markBasicSettingsChanged = useAppStore((s) => s.markBasicSettingsChanged);
  const setLevelBuckets = useAppStore((s) => s.setLevelBuckets);
  const setLanguageBuckets = useAppStore((s) => s.setLanguageBuckets);
  const setElectiveLevelBuckets = useAppStore((s) => s.setElectiveLevelBuckets);
  const setIncludeClosedComponents = useAppStore((s) => s.setIncludeClosedComponents);
  const setVirtualSectionsOnly = useAppStore((s) => s.setVirtualSectionsOnly);
  const setCompletedCourses = useAppStore((s) => s.setCompletedCourses);
  const setGenerationMinStartMinutes = useAppStore((s) => s.setGenerationMinStartMinutes);
  const setGenerationMaxEndMinutes = useAppStore((s) => s.setGenerationMaxEndMinutes);
  const setAvoidedDays = useAppStore((s) => s.setAvoidedDays);
  const setGenerationMinProfessorRating = useAppStore((s) => s.setGenerationMinProfessorRating);
  const setGenerationLimitFirstYearCredits = useAppStore(
    (s) => s.setGenerationLimitFirstYearCredits,
  );
  const setGenerationCompressedSchedule = useAppStore((s) => s.setGenerationCompressedSchedule);
  const setGenerationPreferEasier = useAppStore((s) => s.setGenerationPreferEasier);

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

  const requiredCourseOptions = useMemo(() => {
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

  const courseOptionsFilter = useMemo<OptionsFilter>(
    () => createCourseOptionsFilter(cache),
    [cache],
  );

  // The "courses you want" dropdown should not offer courses the student has already completed.
  const desiredCourseOptions = useMemo(() => {
    if (completedCourses.length === 0) return requiredCourseOptions;
    const completed = new Set(completedCourses.map(normalizeCourseCode));
    return requiredCourseOptions.filter((o) => !completed.has(normalizeCourseCode(o.value)));
  }, [requiredCourseOptions, completedCourses]);

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
        renderCourseOption={renderCourseOption(cache)}
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
          data: requiredCourseOptions,
          value: blacklistedCourses,
          onChange: (v) => {
            setBlacklistedCourses(v);
            markBasicSettingsChanged();
          },
          renderOption: renderCourseOption(cache),
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
            renderOption={renderCourseOption(cache)}
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
