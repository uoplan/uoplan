import { useState } from "react";
import type { ReactNode } from "react";
import {
  Alert,
  Badge,
  Box,
  Checkbox,
  Collapse,
  Group,
  NumberInput,
  Paper,
  Stack,
  Switch,
  Text,
  UnstyledButton,
} from "@mantine/core";
import type { MultiSelectProps } from "@mantine/core";
import { IconAdjustmentsHorizontal, IconChevronDown } from "@tabler/icons-react";
import type { DayOfWeek, OptimizationKind, OptimizationPriority } from "@uoplan/core";
import { BasicCourseFiltersCard } from "../../requirements/CourseFiltersCard";
import { FrenchImmersionProgramOverview } from "../../shared/FrenchImmersionProgramOverview";
import { tr } from "../../../i18n";
import { useAnalytics } from "../../../lib/analytics";
import { DayAvoidToggles } from "./DayAvoidToggles";
import { OptimizationPrioritiesCard } from "./OptimizationPrioritiesCard";
import { TimeRangeSelect } from "./TimeRangeSelect";

interface SimpleMultiSelectProps {
  data: { value: string; label: string }[];
  value: string[];
  onChange: (value: string[]) => void;
}

interface ExcludeCoursesProps extends SimpleMultiSelectProps {
  renderOption?: MultiSelectProps["renderOption"];
  filter?: MultiSelectProps["filter"];
}

interface AdvancedOptionsDisclosure {
  collapseId: string;
  defaultOpen?: boolean;
  /** Right-aligned badge shown in the disclosure header. */
  badge?: { label: string; color: string };
  /** Extra content appended inside the panel (e.g. the transcript "pick specific courses" step). */
  extraContent?: ReactNode;
  /** Extra bullet appended to the collapsed summary (e.g. "Pick specific courses"). */
  extraSummaryItem?: string;
}

export interface GenerationOptionsFieldsProps {
  /**
   * Supplementary content rendered above the count inputs — the sidebars pass the embedded basket
   * here, which now hosts the "courses you want" add-search field.
   */
  coursesSlot?: ReactNode;

  /** "Courses this semester" (N) — the cart cap that overflows into program requirements. */
  coursesThisSemesterValue: number;
  onCoursesThisSemesterChange: (n: number) => void;
  coursesThisSemesterMin: number;
  coursesThisSemesterMax: number;

  /** "Electives this semester (additional)" (M) — electives generated on top of N. */
  countValue: number;
  onCountChange: (n: number) => void;
  countMin: number;
  countMax: number;

  /** Slot rendered directly under the count input (e.g. advanced desired-course warnings). */
  belowCount?: ReactNode;

  /** First-year (1xxx) credit cap. */
  totalFirstYearCredits: number;
  warnFirstYearLimit: boolean;
  limitFirstYearCredits: boolean;
  onLimitFirstYearCreditsChange: (v: boolean) => void;

  /** Schedule optimization priorities (ordered, individually toggleable). */
  optimizationPriorities: OptimizationPriority[];
  onReorderPriorities: (fromIndex: number, toIndex: number) => void;
  onSetPriorities: (next: OptimizationPriority[]) => void;
  onTogglePriority: (kind: OptimizationKind, enabled: boolean) => void;
  onGoodBreaksParamsChange: (params: { breakCount?: number; breakTargetMinutes?: number }) => void;
  minStartMinutes: number;
  onMinStartMinutesChange: (minutes: number) => void;
  maxEndMinutes: number;
  onMaxEndMinutesChange: (minutes: number) => void;
  avoidedDays: DayOfWeek[];
  onAvoidedDaysChange: (days: DayOfWeek[]) => void;

  /** Course filters (shared card with exclude-subjects + exclude-courses). */
  levelBuckets: ("undergrad" | "grad")[];
  languageBuckets: ("en" | "fr" | "other")[];
  electiveLevelBuckets: number[];
  includeClosedComponents: boolean;
  virtualSectionsOnly: boolean;
  onChangeLevelBuckets: (buckets: ("undergrad" | "grad")[]) => void;
  onChangeLanguageBuckets: (buckets: ("en" | "fr" | "other")[]) => void;
  onChangeElectiveLevelBuckets: (buckets: number[]) => void;
  onIncludeClosedComponentsChange: (value: boolean) => void;
  onVirtualSectionsOnlyChange: (value: boolean) => void;
  excludeSubjects: SimpleMultiSelectProps;
  excludeCourses: ExcludeCoursesProps;

  /** French immersion stream. */
  frenchImmersionStream: boolean;
  onFrenchImmersionStreamChange: (v: boolean) => void;

  /** The single "Advanced options" disclosure that houses every lower-priority control. */
  advancedOptions: AdvancedOptionsDisclosure;
}

/**
 * The unified generation-option field set shared by both calendar sidebars. Always-visible controls
 * (the basket-hosted "courses you want" field and the course count) sit on top; every lower-priority
 * control — class times, days to avoid, smart options, course filters, French immersion, and the
 * optional transcript-only "pick specific courses" step — lives inside one collapsible "Advanced
 * options" disclosure whose collapsed state lists what it contains.
 */
export function GenerationOptionsFields(props: GenerationOptionsFieldsProps) {
  const analytics = useAnalytics();
  const [advancedOpen, setAdvancedOpen] = useState(props.advancedOptions.defaultOpen ?? false);
  const capturePreference = (field: string) => {
    analytics.capture("preferences_updated", { field });
  };

  const timeWindowControl = (
    <TimeRangeSelect
      minStartMinutes={props.minStartMinutes}
      maxEndMinutes={props.maxEndMinutes}
      onMinStartMinutesChange={(minutes) => {
        capturePreference("min_start_time");
        props.onMinStartMinutesChange(minutes);
      }}
      onMaxEndMinutesChange={(minutes) => {
        capturePreference("max_end_time");
        props.onMaxEndMinutesChange(minutes);
      }}
    />
  );

  const avoidedDaysControl = (
    <DayAvoidToggles
      avoidedDays={props.avoidedDays}
      onAvoidedDaysChange={(days) => {
        capturePreference("avoided_days");
        props.onAvoidedDaysChange(days);
      }}
    />
  );

  const optimizationPrioritiesControl = (
    <OptimizationPrioritiesCard
      priorities={props.optimizationPriorities}
      onReorder={(from, to) => {
        capturePreference("optimization_priorities_reorder");
        props.onReorderPriorities(from, to);
      }}
      onSetPriorities={(next) => {
        capturePreference("optimization_priorities_reorder");
        props.onSetPriorities(next);
      }}
      onToggle={(kind, enabled) => {
        analytics.capture("optimization_priority_changed", { kind, enabled });
        props.onTogglePriority(kind, enabled);
      }}
      onGoodBreaksParamsChange={(params) => {
        capturePreference("good_breaks_params");
        props.onGoodBreaksParamsChange(params);
      }}
    />
  );

  const firstYearLimitControl =
    props.totalFirstYearCredits > 0 ? (
      <Checkbox
        label={tr("scheduleCount.firstYear.limitLabel")}
        description={tr("scheduleCount.firstYear.limitDescription", {
          credits: props.totalFirstYearCredits,
          suffix: props.totalFirstYearCredits === 1 ? "" : "s",
        })}
        checked={props.limitFirstYearCredits}
        onChange={(e) => {
          capturePreference("limit_first_year_credits");
          props.onLimitFirstYearCreditsChange(e.currentTarget.checked);
        }}
      />
    ) : null;

  const courseFiltersControl = (
    <BasicCourseFiltersCard
      levelBuckets={props.levelBuckets}
      languageBuckets={props.languageBuckets}
      electiveLevelBuckets={props.electiveLevelBuckets}
      includeClosedComponents={props.includeClosedComponents}
      virtualSectionsOnly={props.virtualSectionsOnly}
      showGraduateElectiveLevels
      collapsible
      excludeElectiveSubjects={{
        ...props.excludeSubjects,
        onChange: (value) => {
          capturePreference("exclude_subjects");
          props.excludeSubjects.onChange(value);
        },
      }}
      excludeCourses={{
        ...props.excludeCourses,
        onChange: (value) => {
          capturePreference("exclude_courses");
          props.excludeCourses.onChange(value);
        },
      }}
      onChangeLevelBuckets={(buckets) => {
        capturePreference("level_buckets");
        props.onChangeLevelBuckets(buckets);
      }}
      onChangeLanguageBuckets={(buckets) => {
        capturePreference("language_buckets");
        props.onChangeLanguageBuckets(buckets);
      }}
      onChangeElectiveLevelBuckets={(buckets) => {
        capturePreference("elective_level_buckets");
        props.onChangeElectiveLevelBuckets(buckets);
      }}
      onIncludeClosedComponentsChange={(value) => {
        capturePreference("include_closed_components");
        props.onIncludeClosedComponentsChange(value);
      }}
      onVirtualSectionsOnlyChange={(value) => {
        capturePreference("virtual_sections_only");
        props.onVirtualSectionsOnlyChange(value);
      }}
    />
  );

  const frenchImmersionControl = (
    <>
      <Switch
        label={tr("frenchImmersion.toggle.label")}
        description={tr("frenchImmersion.toggle.description")}
        checked={props.frenchImmersionStream}
        onChange={(e) => {
          capturePreference("french_immersion");
          props.onFrenchImmersionStreamChange(e.currentTarget.checked);
        }}
        radius="md"
        styles={{ description: { color: "var(--app-text-muted)" } }}
      />
      {props.frenchImmersionStream ? <FrenchImmersionProgramOverview variant="compact" /> : null}
    </>
  );

  const summaryItems = [
    tr("advancedOptions.summary.times"),
    tr("advancedOptions.summary.days"),
    tr("advancedOptions.summary.filters"),
    tr("advancedOptions.summary.frenchImmersion"),
    ...(props.advancedOptions.extraSummaryItem ? [props.advancedOptions.extraSummaryItem] : []),
  ];

  return (
    <Stack gap="md" data-testid="generation-options-fields">
      {props.coursesSlot}

      <NumberInput
        label={tr("generationOptions.coursesThisSemester.label")}
        value={props.coursesThisSemesterValue}
        onChange={(v) => {
          if (typeof v !== "number" || Number.isNaN(v)) return;
          capturePreference("courses_this_semester");
          props.onCoursesThisSemesterChange(Math.trunc(v));
        }}
        min={props.coursesThisSemesterMin}
        max={props.coursesThisSemesterMax}
        radius="md"
        data-testid="courses-this-semester-input"
      />

      <NumberInput
        label={tr("generationOptions.count.label")}
        value={props.countValue}
        onChange={(v) => {
          if (typeof v !== "number" || Number.isNaN(v)) return;
          capturePreference("course_count");
          props.onCountChange(Math.trunc(v));
        }}
        min={props.countMin}
        max={props.countMax}
        radius="md"
        data-testid="additional-electives-input"
      />

      {props.belowCount}

      {props.warnFirstYearLimit && (
        <Alert color="yellow" variant="light" radius="md">
          {tr("scheduleCount.firstYear.warning", { credits: props.totalFirstYearCredits })}
        </Alert>
      )}

      {optimizationPrioritiesControl}

      <Paper
        withBorder
        radius="md"
        data-testid="generation-options-secondary-panel"
        style={{
          backgroundColor: advancedOpen ? "var(--app-surface)" : "var(--app-surface-sunken)",
        }}
      >
        <UnstyledButton
          w="100%"
          p="sm"
          onClick={() => setAdvancedOpen((o) => !o)}
          aria-expanded={advancedOpen}
          aria-controls={props.advancedOptions.collapseId}
          style={{ cursor: "pointer" }}
        >
          <Stack gap={0}>
            <Group justify="space-between" align="center" wrap="nowrap">
              <Group gap="xs" align="center" wrap="nowrap" style={{ minWidth: 0 }}>
                <IconAdjustmentsHorizontal
                  size={18}
                  aria-hidden="true"
                  style={{ flexShrink: 0, color: "var(--app-text-muted)" }}
                />
                <Text fw={600} size="sm" truncate>
                  {tr("advancedOptions.heading")}
                </Text>
                {props.advancedOptions.badge ? (
                  <Badge
                    size="sm"
                    variant="light"
                    color={props.advancedOptions.badge.color}
                    style={{ flexShrink: 0 }}
                  >
                    {props.advancedOptions.badge.label}
                  </Badge>
                ) : null}
              </Group>
              <IconChevronDown
                size={16}
                aria-hidden="true"
                style={{
                  flexShrink: 0,
                  transform: advancedOpen ? "rotate(0deg)" : "rotate(-90deg)",
                  transition: "transform 150ms ease",
                }}
              />
            </Group>
            <Collapse expanded={!advancedOpen} keepMounted={false}>
              <Group gap="xs" wrap="wrap" pl={28} pt={8}>
                {summaryItems.map((item) => (
                  <Text key={item} size="xs" c="dimmed" component="span">
                    • {item}
                  </Text>
                ))}
              </Group>
            </Collapse>
          </Stack>
        </UnstyledButton>
        <Collapse id={props.advancedOptions.collapseId} expanded={advancedOpen}>
          <Box p="sm" pt={0}>
            <Stack gap="md">
              {timeWindowControl}
              {avoidedDaysControl}
              {firstYearLimitControl}
              {courseFiltersControl}
              {frenchImmersionControl}
              {props.advancedOptions.extraContent}
            </Stack>
          </Box>
        </Collapse>
      </Paper>
    </Stack>
  );
}
