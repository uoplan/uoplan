import type { ReactNode } from "react";
import {
  Alert,
  Checkbox,
  Group,
  MultiSelect,
  NumberInput,
  Select,
  Stack,
  Switch,
  TextInput,
  type MultiSelectProps,
  type OptionsFilter,
} from "@mantine/core";
import type { DayOfWeek } from "@uoplan/core";
import { BasicCourseFiltersCard } from "../../requirements/CourseFiltersCard";
import { FrenchImmersionProgramOverview } from "../../shared/FrenchImmersionProgramOverview";
import { tr } from "../../../i18n";

/** Format minutes since midnight as HH:mm for input type="time". */
function minutesToTimeString(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

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

export interface GenerationOptionsFieldsProps {
  /** "Courses you want" multiselect. */
  courseOptions: { value: string; label: string }[];
  desiredCourses: string[];
  onDesiredCoursesChange: (value: string[]) => void;
  renderCourseOption?: MultiSelectProps["renderOption"];
  courseFilter?: OptionsFilter;

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
}

/**
 * The unified generation-option field set rendered identically on both calendar sidebars (basic and
 * advanced). Purely presentational and prop-driven — each mode supplies its own change handlers and
 * count semantics. Mode-specific extras (desired-course warnings, the per-requirement "pick specific
 * courses" panel, the basic completed-courses editor) are composed around this by the wrappers.
 */
export function GenerationOptionsFields(props: GenerationOptionsFieldsProps) {
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

  return (
    <Stack gap="md" data-testid="generation-options-fields">
      <MultiSelect
        label={tr("generationOptions.courses.label")}
        description={tr("generationOptions.courses.description")}
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

      <NumberInput
        label={tr("generationOptions.count.label")}
        description={tr("generationOptions.count.description")}
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

      <Checkbox
        label={tr("scheduleCount.compressed.label")}
        description={tr("scheduleCount.compressed.description")}
        checked={props.compressedSchedule}
        onChange={(e) => props.onCompressedScheduleChange(e.currentTarget.checked)}
      />
      <Checkbox
        label={tr("scheduleCount.preferEasier.label")}
        description={tr("scheduleCount.preferEasier.description")}
        checked={props.preferEasierCourses}
        onChange={(e) => props.onPreferEasierCoursesChange(e.currentTarget.checked)}
      />
      <Group align="flex-end" gap="md">
        <TextInput
          label={tr("scheduleCount.time.earliest")}
          type="time"
          value={minutesToTimeString(props.minStartMinutes)}
          onChange={(e) =>
            props.onMinStartMinutesChange(timeStringToMinutes(e.currentTarget.value))
          }
        />
        <TextInput
          label={tr("scheduleCount.time.latest")}
          type="time"
          value={minutesToTimeString(props.maxEndMinutes)}
          onChange={(e) => props.onMaxEndMinutesChange(timeStringToMinutes(e.currentTarget.value))}
        />
      </Group>
      <Select
        label={tr("scheduleCount.rating.label")}
        description={tr("scheduleCount.rating.description")}
        placeholder={tr("scheduleCount.rating.placeholder")}
        data={ratingOptions}
        value={props.minProfessorRating == null ? null : String(props.minProfessorRating)}
        onChange={(v) => props.onMinProfessorRatingChange(v == null ? null : Number(v))}
        clearable
      />
      <MultiSelect
        label={tr("scheduleCount.avoidDays.label")}
        description={tr("scheduleCount.avoidDays.description")}
        placeholder={tr("scheduleCount.avoidDays.placeholder")}
        data={dayOptions}
        value={props.avoidedDays}
        onChange={(values) => props.onAvoidedDaysChange(values as DayOfWeek[])}
        clearable
      />

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

      <Switch
        label={tr("frenchImmersion.toggle.label")}
        description={tr("frenchImmersion.toggle.description")}
        checked={props.frenchImmersionStream}
        onChange={(e) => props.onFrenchImmersionStreamChange(e.currentTarget.checked)}
        radius="md"
        styles={{ description: { color: "var(--app-text-muted)" } }}
      />
      {props.frenchImmersionStream ? <FrenchImmersionProgramOverview variant="compact" /> : null}
    </Stack>
  );
}
