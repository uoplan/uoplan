import { useMemo } from "react";
import {
  Button,
  MultiSelect,
  NumberInput,
  Stack,
  Box,
  Text,
  Switch,
  type OptionsFilter,
} from "@mantine/core";
import { IconFileUpload } from "@tabler/icons-react";
import { useAppStore } from "../../store/appStore";
import { useShallow } from "zustand/react/shallow";
import {
  createCourseOptions,
  renderCourseOption,
  createCourseOptionsFilter,
} from "../shared/CourseSelect";
import { BasicCourseFiltersCard } from "../requirements/CourseFiltersCard";
import { FrenchImmersionProgramOverview } from "../shared/FrenchImmersionProgramOverview";
import { tr } from "../../i18n";
import { navigateToWizardStep } from "../../lib/appNavigation";
import { WizardStep } from "../../lib/wizardSteps";

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

  const completedCourseOptions = useMemo(() => {
    if (!cache) return [];
    const unique = [...new Set(cache.getAllCourses().map((c) => c.code))];
    return createCourseOptions(unique, cache);
  }, [cache]);

  return (
    <>
      <Stack gap="md">
        <MultiSelect
          label={tr("basicCalendar.required.label")}
          placeholder={tr("basicCalendar.required.placeholder")}
          searchable
          data={requiredCourseOptions}
          value={basicPinnedCourses}
          onChange={(v) => {
            setBasicPinnedCourses(v);
            markBasicSettingsChanged();
          }}
          renderOption={renderCourseOption(cache)}
          filter={courseOptionsFilter}
          radius={0}
        />

        <NumberInput
          label={tr("basicCalendar.electives.label")}
          value={basicElectivesCount}
          onChange={(v) => {
            if (typeof v !== "number" || Number.isNaN(v)) return;
            const nextCount = Math.max(0, Math.min(8, Math.trunc(v)));
            if (nextCount === basicElectivesCount) return;
            setBasicElectivesCount(nextCount);
            markBasicSettingsChanged();
          }}
          min={0}
          max={8}
          radius={0}
        />

        <BasicCourseFiltersCard
          levelBuckets={levelBuckets}
          languageBuckets={languageBuckets}
          electiveLevelBuckets={electiveLevelBuckets}
          includeClosedComponents={includeClosedComponents}
          virtualSectionsOnly={virtualSectionsOnly}
          showGraduateElectiveLevels
          collapsible
          excludeElectiveSubjects={{
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
        />

        <Switch
          label={tr("frenchImmersion.toggle.label")}
          description={tr("frenchImmersion.toggle.description")}
          checked={frenchImmersionStream}
          onChange={(e) => {
            setFrenchImmersionStream(e.currentTarget.checked);
            markBasicSettingsChanged();
          }}
          radius={0}
          styles={{ description: { color: "var(--app-text-muted)" } }}
        />

        {frenchImmersionStream ? <FrenchImmersionProgramOverview variant="compact" /> : null}
      </Stack>

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
            radius={0}
          />

          <Button
            size="sm"
            color="gray"
            variant="light"
            radius={0}
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
