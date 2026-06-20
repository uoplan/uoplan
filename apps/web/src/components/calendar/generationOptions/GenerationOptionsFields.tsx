import { useState } from "react";
import type { ReactNode } from "react";
import {
  ActionIcon,
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
import { IconChevronDown } from "@tabler/icons-react";
import type { DayOfWeek } from "@uoplan/core";
import { BasicCourseFiltersCard } from "../../requirements/CourseFiltersCard";
import { FrenchImmersionProgramOverview } from "../../shared/FrenchImmersionProgramOverview";
import { tr } from "../../../i18n";
import { DayAvoidToggles } from "./DayAvoidToggles";
import { TimeRangeSelect } from "./TimeRangeSelect";

const LENIENT_PROFESSOR_RATING_MIN = 2;

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
   * Supplementary content rendered above the count input — the sidebars pass the embedded basket
   * here, which now hosts the "courses you want" add-search field.
   */
  coursesSlot?: ReactNode;

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
  const [advancedOpen, setAdvancedOpen] = useState(props.advancedOptions.defaultOpen ?? false);
  const [smartOptionsOpen, setSmartOptionsOpen] = useState(false);

  const timeWindowControl = (
    <TimeRangeSelect
      minStartMinutes={props.minStartMinutes}
      maxEndMinutes={props.maxEndMinutes}
      onMinStartMinutesChange={props.onMinStartMinutesChange}
      onMaxEndMinutesChange={props.onMaxEndMinutesChange}
    />
  );

  const avoidedDaysControl = (
    <DayAvoidToggles
      avoidedDays={props.avoidedDays}
      onAvoidedDaysChange={props.onAvoidedDaysChange}
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

  const professorRatingPreferenceControl = (
    <Checkbox
      label={tr("scheduleCount.preferProfessorRating.label")}
      description={tr("scheduleCount.preferProfessorRating.description")}
      checked={props.minProfessorRating != null}
      onChange={(e) =>
        props.onMinProfessorRatingChange(
          e.currentTarget.checked ? LENIENT_PROFESSOR_RATING_MIN : null,
        )
      }
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
        onChange={(e) => props.onLimitFirstYearCreditsChange(e.currentTarget.checked)}
      />
    ) : null;

  const smartOptionValues = [
    props.compressedSchedule,
    props.preferEasierCourses,
    props.preferHigherSentiment,
    props.minProfessorRating != null,
    ...(props.totalFirstYearCredits > 0 ? [props.limitFirstYearCredits] : []),
  ];
  const smartOptionsChecked = smartOptionValues.every(Boolean);
  const smartOptionsIndeterminate = !smartOptionsChecked && smartOptionValues.some(Boolean);
  const setAllSmartOptions = (checked: boolean) => {
    props.onCompressedScheduleChange(checked);
    props.onPreferEasierCoursesChange(checked);
    props.onPreferHigherSentimentChange(checked);
    props.onMinProfessorRatingChange(checked ? LENIENT_PROFESSOR_RATING_MIN : null);
    if (props.totalFirstYearCredits > 0) props.onLimitFirstYearCreditsChange(checked);
  };

  const smartOptionsControl = (
    <Paper
      withBorder
      radius="md"
      p="sm"
      style={{
        backgroundColor: smartOptionsOpen ? "var(--app-surface)" : "var(--app-surface-sunken)",
      }}
    >
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Checkbox
            label={tr("scheduleCount.smartOptions.label")}
            description={tr("scheduleCount.smartOptions.description")}
            checked={smartOptionsChecked}
            indeterminate={smartOptionsIndeterminate}
            onChange={() => setAllSmartOptions(!smartOptionsChecked)}
          />
          <ActionIcon
            variant="subtle"
            color="gray"
            radius="md"
            aria-label={tr(
              smartOptionsOpen
                ? "scheduleCount.smartOptions.hide"
                : "scheduleCount.smartOptions.show",
            )}
            aria-expanded={smartOptionsOpen}
            aria-controls="generation-smart-options-collapse"
            onClick={() => setSmartOptionsOpen((open) => !open)}
          >
            <IconChevronDown
              size={16}
              aria-hidden="true"
              style={{
                transform: smartOptionsOpen ? "rotate(0deg)" : "rotate(-90deg)",
                transition: "transform 150ms ease",
              }}
            />
          </ActionIcon>
        </Group>
        <Collapse id="generation-smart-options-collapse" expanded={smartOptionsOpen}>
          <Stack gap="sm" pt="xs">
            {compressedControl}
            {preferEasierControl}
            {preferHigherSentimentControl}
            {professorRatingPreferenceControl}
            {firstYearLimitControl}
          </Stack>
        </Collapse>
      </Stack>
    </Paper>
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

      {smartOptionsControl}

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
          <Stack gap={advancedOpen ? 0 : 8}>
            <Group justify="space-between" align="center" wrap="nowrap">
              <Group gap="xs" align="center" wrap="nowrap" style={{ minWidth: 0 }}>
                <IconChevronDown
                  size={14}
                  aria-hidden="true"
                  style={{
                    flexShrink: 0,
                    transform: advancedOpen ? "rotate(0deg)" : "rotate(-90deg)",
                    transition: "transform 150ms ease",
                  }}
                />
                <Text fw={600} size="sm" truncate>
                  {tr("advancedOptions.heading")}
                </Text>
              </Group>
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
            {!advancedOpen ? (
              <Group gap="xs" wrap="wrap" pl={22}>
                {summaryItems.map((item) => (
                  <Text key={item} size="xs" c="dimmed" component="span">
                    • {item}
                  </Text>
                ))}
              </Group>
            ) : null}
          </Stack>
        </UnstyledButton>
        <Collapse id={props.advancedOptions.collapseId} expanded={advancedOpen}>
          <Box p="sm" pt={0}>
            <Stack gap="md">
              {timeWindowControl}
              {avoidedDaysControl}
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
