import { useState } from "react";
import type { ReactNode } from "react";
import {
  Alert,
  Badge,
  Box,
  Checkbox,
  Collapse,
  Group,
  MultiSelect,
  NumberInput,
  Paper,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
  UnstyledButton,
} from "@mantine/core";
import type { MultiSelectProps, OptionsFilter } from "@mantine/core";
import { IconChevronDown } from "@tabler/icons-react";
import type { DayOfWeek } from "@uoplan/core";
import { minutesToTime24 } from "@uoplan/core";
import { BasicCourseFiltersCard } from "../../requirements/CourseFiltersCard";
import { FrenchImmersionProgramOverview } from "../../shared/FrenchImmersionProgramOverview";
import { tr } from "../../../i18n";

/** Parse HH:mm from input type="time" to minutes since midnight. */
function timeStringToMinutes(value: string): number {
  const [h, m] = value.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return Math.max(0, Math.min(24 * 60 - 1, h * 60 + m));
}

interface SimpleMultiSelectProps {
  data: { value: string; label: string }[];
  value: string[];
  onChange: (value: string[]) => void;
}

interface ExcludeCoursesProps extends SimpleMultiSelectProps {
  renderOption?: MultiSelectProps["renderOption"];
  filter?: MultiSelectProps["filter"];
}

interface SecondaryOptionsDisclosure {
  heading: string;
  badgeLabel?: string;
  collapseId: string;
  defaultOpen?: boolean;
}

export interface GenerationOptionsFieldsProps {
  /** "Courses you want" multiselect. */
  courseOptions: { value: string; label: string }[];
  desiredCourses: string[];
  onDesiredCoursesChange: (value: string[]) => void;
  renderCourseOption?: MultiSelectProps["renderOption"];
  courseFilter?: OptionsFilter;

  /**
   * Optional replacement for the "courses you want" multiselect (and its `belowCourses` slot). When
   * provided, this is rendered instead — the sidebars pass the embedded basket here so the cart is the
   * single source of truth for desired courses (no duplicated state). The multiselect remains the
   * fallback for the presentational component in isolation/tests.
   */
  coursesSlot?: ReactNode;

  /** Slot rendered directly under the "courses you want" multiselect (e.g. requirement warnings). */
  belowCourses?: ReactNode;

  /** "How many courses this semester" number input. */
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

  /** Schedule preferences. */
  compressedSchedule: boolean;
  onCompressedScheduleChange: (v: boolean) => void;
  preferEasierCourses: boolean;
  onPreferEasierCoursesChange: (v: boolean) => void;
  preferHigherSentiment: boolean;
  onPreferHigherSentimentChange: (v: boolean) => void;
  minStartMinutes: number;
  onMinStartMinutesChange: (minutes: number) => void;
  maxEndMinutes: number;
  onMaxEndMinutesChange: (minutes: number) => void;
  avoidedDays: DayOfWeek[];
  onAvoidedDaysChange: (days: DayOfWeek[]) => void;
  minProfessorRating: number | null;
  onMinProfessorRatingChange: (rating: number | null) => void;

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

  /** Optional disclosure wrapper for the lower-priority fine-tuning controls. */
  secondaryOptionsDisclosure?: SecondaryOptionsDisclosure;
}

/**
 * The unified generation-option field set shared by both calendar sidebars. Purely presentational and
 * prop-driven — each mode supplies its own change handlers, count semantics, and optional grouping for
 * lower-priority controls. Mode-specific extras (desired-course warnings, the per-requirement "pick
 * specific courses" panel, the basic completed-courses editor) are composed around this by the wrappers.
 */
export function GenerationOptionsFields(props: GenerationOptionsFieldsProps) {
  const [secondaryOptionsOpen, setSecondaryOptionsOpen] = useState(
    props.secondaryOptionsDisclosure?.defaultOpen ?? false,
  );
  const ratingOptions = [
    { value: "2", label: "2.0+" },
    { value: "2.5", label: "2.5+" },
    { value: "3", label: "3.0+" },
    { value: "3.5", label: "3.5+" },
    { value: "4", label: "4.0+" },
    { value: "4.5", label: "4.5+" },
  ];
  const dayOptions: { value: DayOfWeek; label: string }[] = [
    { value: "Mo", label: tr("scheduleCount.day.monday") },
    { value: "Tu", label: tr("scheduleCount.day.tuesday") },
    { value: "We", label: tr("scheduleCount.day.wednesday") },
    { value: "Th", label: tr("scheduleCount.day.thursday") },
    { value: "Fr", label: tr("scheduleCount.day.friday") },
    { value: "Sa", label: tr("scheduleCount.day.saturday") },
    { value: "Su", label: tr("scheduleCount.day.sunday") },
  ];

  const timeWindowControl = (
    <Group align="flex-end" gap="md">
      <TextInput
        label={tr("scheduleCount.time.earliest")}
        type="time"
        value={minutesToTime24(props.minStartMinutes)}
        onChange={(e) => props.onMinStartMinutesChange(timeStringToMinutes(e.currentTarget.value))}
      />
      <TextInput
        label={tr("scheduleCount.time.latest")}
        type="time"
        value={minutesToTime24(props.maxEndMinutes)}
        onChange={(e) => props.onMaxEndMinutesChange(timeStringToMinutes(e.currentTarget.value))}
      />
    </Group>
  );

  const professorRatingControl = (
    <Select
      label={tr("scheduleCount.rating.label")}
      description={tr("scheduleCount.rating.description")}
      placeholder={tr("scheduleCount.rating.placeholder")}
      data={ratingOptions}
      value={props.minProfessorRating == null ? null : String(props.minProfessorRating)}
      onChange={(v) => props.onMinProfessorRatingChange(v == null ? null : Number(v))}
      clearable
    />
  );

  const avoidedDaysControl = (
    <MultiSelect
      label={tr("scheduleCount.avoidDays.label")}
      description={tr("scheduleCount.avoidDays.description")}
      placeholder={tr("scheduleCount.avoidDays.placeholder")}
      data={dayOptions}
      value={props.avoidedDays}
      onChange={(values) => props.onAvoidedDaysChange(values as DayOfWeek[])}
      clearable
    />
  );

  const compressedControl = (
    <Checkbox
      label={tr("scheduleCount.compressed.label")}
      description={tr("scheduleCount.compressed.description")}
      checked={props.compressedSchedule}
      onChange={(e) => props.onCompressedScheduleChange(e.currentTarget.checked)}
    />
  );

  const preferEasierControl = (
    <Checkbox
      label={tr("scheduleCount.preferEasier.label")}
      description={tr("scheduleCount.preferEasier.description")}
      checked={props.preferEasierCourses}
      onChange={(e) => props.onPreferEasierCoursesChange(e.currentTarget.checked)}
    />
  );

  const preferHigherSentimentControl = (
    <Checkbox
      label={tr("scheduleCount.preferSentiment.label")}
      description={tr("scheduleCount.preferSentiment.description")}
      checked={props.preferHigherSentiment}
      onChange={(e) => props.onPreferHigherSentimentChange(e.currentTarget.checked)}
    />
  );

  const courseFiltersControl = (
    <BasicCourseFiltersCard
      levelBuckets={props.levelBuckets}
      languageBuckets={props.languageBuckets}
      electiveLevelBuckets={props.electiveLevelBuckets}
      includeClosedComponents={props.includeClosedComponents}
      virtualSectionsOnly={props.virtualSectionsOnly}
      showGraduateElectiveLevels
      collapsible
      excludeElectiveSubjects={props.excludeSubjects}
      excludeCourses={props.excludeCourses}
      onChangeLevelBuckets={props.onChangeLevelBuckets}
      onChangeLanguageBuckets={props.onChangeLanguageBuckets}
      onChangeElectiveLevelBuckets={props.onChangeElectiveLevelBuckets}
      onIncludeClosedComponentsChange={props.onIncludeClosedComponentsChange}
      onVirtualSectionsOnlyChange={props.onVirtualSectionsOnlyChange}
    />
  );

  const frenchImmersionControl = (
    <>
      <Switch
        label={tr("frenchImmersion.toggle.label")}
        description={tr("frenchImmersion.toggle.description")}
        checked={props.frenchImmersionStream}
        onChange={(e) => props.onFrenchImmersionStreamChange(e.currentTarget.checked)}
        radius="md"
        styles={{ description: { color: "var(--app-text-muted)" } }}
      />
      {props.frenchImmersionStream ? <FrenchImmersionProgramOverview variant="compact" /> : null}
    </>
  );

  // Common scheduling preferences worth surfacing directly in the basic sidebar.
  const fineTuningControls = (
    <>
      {timeWindowControl}
      {compressedControl}
      {preferEasierControl}
      {preferHigherSentimentControl}
      {avoidedDaysControl}
    </>
  );

  // Bulkier / nicher controls kept behind the disclosure in basic mode.
  const disclosureControls = (
    <>
      {professorRatingControl}
      {courseFiltersControl}
      {frenchImmersionControl}
    </>
  );

  // Advanced mode renders every secondary control inline in its original order.
  const secondaryOptionsInline = (
    <>
      {timeWindowControl}
      {professorRatingControl}
      {avoidedDaysControl}
      {courseFiltersControl}
      {compressedControl}
      {preferEasierControl}
      {preferHigherSentimentControl}
      {frenchImmersionControl}
    </>
  );

  return (
    <Stack gap="md" data-testid="generation-options-fields">
      {props.coursesSlot ?? (
        <>
          <MultiSelect
            label={tr("generationOptions.courses.label")}
            placeholder={tr("generationOptions.courses.placeholder")}
            searchable
            data={props.courseOptions}
            value={props.desiredCourses}
            onChange={props.onDesiredCoursesChange}
            renderOption={props.renderCourseOption}
            filter={props.courseFilter}
            radius="md"
          />

          {props.belowCourses}
        </>
      )}

      <NumberInput
        label={tr("generationOptions.count.label")}
        value={props.countValue}
        onChange={(v) => {
          if (typeof v !== "number" || Number.isNaN(v)) return;
          props.onCountChange(Math.trunc(v));
        }}
        min={props.countMin}
        max={props.countMax}
        radius="md"
      />

      {props.belowCount}

      {props.warnFirstYearLimit && (
        <Alert color="yellow" variant="light" radius="md">
          {tr("scheduleCount.firstYear.warning", { credits: props.totalFirstYearCredits })}
        </Alert>
      )}
      {props.totalFirstYearCredits > 0 && (
        <Checkbox
          label={tr("scheduleCount.firstYear.limitLabel")}
          description={tr("scheduleCount.firstYear.limitDescription", {
            credits: props.totalFirstYearCredits,
            suffix: props.totalFirstYearCredits === 1 ? "" : "s",
          })}
          checked={props.limitFirstYearCredits}
          onChange={(e) => props.onLimitFirstYearCreditsChange(e.currentTarget.checked)}
        />
      )}

      {props.secondaryOptionsDisclosure ? (
        <>
          {fineTuningControls}
          <Paper
            withBorder
            radius="md"
            data-testid="generation-options-secondary-panel"
            style={{
              backgroundColor: secondaryOptionsOpen
                ? "var(--app-surface)"
                : "var(--app-surface-sunken)",
            }}
          >
            <UnstyledButton
              w="100%"
              p="sm"
              onClick={() => setSecondaryOptionsOpen((o) => !o)}
              aria-expanded={secondaryOptionsOpen}
              aria-controls={props.secondaryOptionsDisclosure.collapseId}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                cursor: "pointer",
              }}
            >
              <Group gap="xs" align="center">
                <IconChevronDown
                  size={14}
                  aria-hidden="true"
                  style={{
                    flexShrink: 0,
                    transform: secondaryOptionsOpen ? "rotate(0deg)" : "rotate(-90deg)",
                    transition: "transform 150ms ease",
                  }}
                />
                <Text fw={600} size="sm">
                  {props.secondaryOptionsDisclosure.heading}
                </Text>
              </Group>
              {props.secondaryOptionsDisclosure.badgeLabel ? (
                <Badge size="sm" variant="light" color="gray">
                  {props.secondaryOptionsDisclosure.badgeLabel}
                </Badge>
              ) : null}
            </UnstyledButton>
            <Collapse
              id={props.secondaryOptionsDisclosure.collapseId}
              expanded={secondaryOptionsOpen}
            >
              <Box p="sm" pt={0}>
                <Stack gap="md">{disclosureControls}</Stack>
              </Box>
            </Collapse>
          </Paper>
        </>
      ) : (
        secondaryOptionsInline
      )}
    </Stack>
  );
}
