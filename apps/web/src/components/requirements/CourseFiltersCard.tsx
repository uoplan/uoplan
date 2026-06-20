import {
  Collapse,
  Group,
  MultiSelect,
  Paper,
  SegmentedControl,
  Stack,
  Switch,
  Text,
  UnstyledButton,
} from "@mantine/core";
import type { MultiSelectProps } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconChevronDown } from "@tabler/icons-react";
import { tr } from "../../i18n";

const BASIC_COURSE_FILTERS_TOGGLE_ID = "basicCourseFilters.toggle";

const UNDERGRAD_LEVELS = [1000, 2000, 3000, 4000];
const LOWER_UNDERGRAD_LEVELS = [1000, 2000];
const UPPER_UNDERGRAD_LEVELS = [3000, 4000];
const GRAD_LEVELS = [5000, 6000];
const ALL_LEVELS = [...UNDERGRAD_LEVELS, ...GRAD_LEVELS];

type ElectiveLevelPreset = "undergrad-any" | "lower" | "upper" | "all" | "grad" | "custom";

function sameLevels(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort((x, y) => x - y);
  const sortedB = [...b].sort((x, y) => x - y);
  return sortedA.every((value, index) => value === sortedB[index]);
}

function electiveLevelPresetFor(
  buckets: number[],
  showGraduateElectiveLevels: boolean,
): ElectiveLevelPreset {
  if (buckets.length === 0 || sameLevels(buckets, UNDERGRAD_LEVELS)) return "undergrad-any";
  if (sameLevels(buckets, LOWER_UNDERGRAD_LEVELS)) return "lower";
  if (sameLevels(buckets, UPPER_UNDERGRAD_LEVELS)) return "upper";
  if (showGraduateElectiveLevels && sameLevels(buckets, ALL_LEVELS)) return "all";
  if (showGraduateElectiveLevels && sameLevels(buckets, GRAD_LEVELS)) return "grad";
  return "custom";
}

function bucketsForElectiveLevelPreset(preset: ElectiveLevelPreset): number[] | null {
  switch (preset) {
    case "undergrad-any":
      return [];
    case "lower":
      return LOWER_UNDERGRAD_LEVELS;
    case "upper":
      return UPPER_UNDERGRAD_LEVELS;
    case "all":
      return ALL_LEVELS;
    case "grad":
      return GRAD_LEVELS;
    case "custom":
      return null;
  }
}

interface ExcludeElectiveSubjectsProps {
  data: { value: string; label: string }[];
  value: string[];
  onChange: (value: string[]) => void;
}

interface ExcludeCoursesProps extends ExcludeElectiveSubjectsProps {
  renderOption?: MultiSelectProps["renderOption"];
  filter?: MultiSelectProps["filter"];
}

interface BaseCourseFiltersProps {
  levelBuckets: ("undergrad" | "grad")[];
  languageBuckets: ("en" | "fr" | "other")[];
  electiveLevelBuckets: number[];
  includeClosedComponents: boolean;
  virtualSectionsOnly: boolean;
  showGraduateElectiveLevels?: boolean;
  onChangeLevelBuckets: (buckets: ("undergrad" | "grad")[]) => void;
  onChangeLanguageBuckets: (buckets: ("en" | "fr" | "other")[]) => void;
  onChangeElectiveLevelBuckets: (buckets: number[]) => void;
  onIncludeClosedComponentsChange: (value: boolean) => void;
  onVirtualSectionsOnlyChange: (value: boolean) => void;
}

interface BasicCourseFiltersCardProps extends BaseCourseFiltersProps {
  excludeElectiveSubjects?: ExcludeElectiveSubjectsProps;
  excludeCourses?: ExcludeCoursesProps;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

export function BasicCourseFiltersCard({
  levelBuckets,
  languageBuckets,
  electiveLevelBuckets,
  includeClosedComponents,
  virtualSectionsOnly,
  showGraduateElectiveLevels = false,
  onChangeLevelBuckets,
  onChangeLanguageBuckets,
  onChangeElectiveLevelBuckets,
  onIncludeClosedComponentsChange,
  onVirtualSectionsOnlyChange,
  excludeElectiveSubjects,
  excludeCourses,
  collapsible = false,
  defaultCollapsed = true,
}: BasicCourseFiltersCardProps) {
  const [filtersOpen, { toggle: toggleFilters }] = useDisclosure(!defaultCollapsed);

  const levelPreset = electiveLevelPresetFor(electiveLevelBuckets, showGraduateElectiveLevels);
  const levelPresetOptions = [
    { value: "undergrad-any", label: tr("basicCourseFilters.levelPreset.undergradAny") },
    { value: "lower", label: tr("basicCourseFilters.levelPreset.lower") },
    { value: "upper", label: tr("basicCourseFilters.levelPreset.upper") },
    ...(showGraduateElectiveLevels
      ? [
          { value: "all", label: tr("basicCourseFilters.levelPreset.all") },
          { value: "grad", label: tr("basicCourseFilters.levelPreset.grad") },
        ]
      : []),
    ...(levelPreset === "custom"
      ? [{ value: "custom", label: tr("basicCourseFilters.levelPreset.custom") }]
      : []),
  ];

  const headerContent = (
    <>
      <Text size="sm" fw={500}>
        {tr("basicCourseFilters.title")}
      </Text>
      <Text size="xs" c="dimmed">
        {tr("basicCourseFilters.hint")}
      </Text>
    </>
  );

  const filterBody = (
    <Stack gap="md" mt={collapsible ? "sm" : 0}>
      {excludeElectiveSubjects && (
        <MultiSelect
          label={tr("basicCalendar.exclude.label")}
          placeholder={tr("basicCalendar.exclude.placeholder")}
          searchable
          data={excludeElectiveSubjects.data}
          value={excludeElectiveSubjects.value}
          onChange={excludeElectiveSubjects.onChange}
          radius="var(--app-radius-sm)"
        />
      )}
      {excludeCourses && (
        <MultiSelect
          label={tr("scheduleCount.blacklist.label")}
          description={tr("scheduleCount.blacklist.description")}
          placeholder={tr("scheduleCount.blacklist.placeholder")}
          searchable
          clearable
          data={excludeCourses.data}
          value={excludeCourses.value}
          onChange={excludeCourses.onChange}
          renderOption={excludeCourses.renderOption}
          filter={excludeCourses.filter}
          radius="var(--app-radius-sm)"
        />
      )}
      <Group gap="md" align="flex-start" style={{ alignItems: "center" }}>
        <MultiSelect
          label={tr("basicCourseFilters.careers.label")}
          data={[
            { value: "undergrad", label: tr("constrainStep.levels.undergrad") },
            { value: "grad", label: tr("constrainStep.levels.grad") },
          ]}
          value={levelBuckets}
          onChange={(vals) =>
            onChangeLevelBuckets(
              vals.filter((v): v is "undergrad" | "grad" => v === "undergrad" || v === "grad"),
            )
          }
          clearable={false}
          w="100%"
        />
        <MultiSelect
          label={tr("constrainStep.languages.label")}
          data={[
            { value: "en", label: tr("constrainStep.languages.english") },
            { value: "fr", label: tr("constrainStep.languages.french") },
            { value: "other", label: tr("constrainStep.languages.other") },
          ]}
          value={languageBuckets}
          onChange={(vals) =>
            onChangeLanguageBuckets(
              vals.filter(
                (v): v is "en" | "fr" | "other" => v === "en" || v === "fr" || v === "other",
              ),
            )
          }
          clearable={false}
          w="100%"
        />
        <Stack gap={6} style={{ width: "100%" }}>
          <Text size="sm" fw={500}>
            {tr("basicCourseFilters.levels.label")}
          </Text>
          <SegmentedControl
            aria-label={tr("basicCourseFilters.levels.label")}
            value={levelPreset}
            onChange={(value) => {
              const buckets = bucketsForElectiveLevelPreset(value as ElectiveLevelPreset);
              if (buckets == null) return;
              onChangeElectiveLevelBuckets(buckets);
            }}
            data={levelPresetOptions}
            size="xs"
            radius="var(--app-radius-sm)"
          />
        </Stack>
        <Switch
          label={tr("constrainStep.includeClosedSections")}
          checked={includeClosedComponents}
          onChange={(e) => onIncludeClosedComponentsChange(e.currentTarget.checked)}
        />
        <Switch
          label={tr("constrainStep.virtualSectionsOnly")}
          checked={virtualSectionsOnly}
          onChange={(e) => onVirtualSectionsOnlyChange(e.currentTarget.checked)}
        />
      </Group>
    </Stack>
  );

  return (
    <Paper p="sm" withBorder radius="var(--app-radius)">
      <Stack gap="xs">
        {collapsible ? (
          <UnstyledButton
            type="button"
            onClick={toggleFilters}
            aria-label={tr(BASIC_COURSE_FILTERS_TOGGLE_ID)}
            aria-expanded={filtersOpen}
            style={{
              borderRadius: "var(--app-radius-sm)",
              textAlign: "left",
              width: "100%",
            }}
          >
            <Group align="flex-start" gap="sm" wrap="nowrap">
              <IconChevronDown
                size={18}
                style={{
                  flexShrink: 0,
                  marginTop: 2,
                  transform: filtersOpen ? "rotate(0deg)" : "rotate(-90deg)",
                  transition: "var(--app-transition)",
                }}
                aria-hidden
              />
              <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
                {headerContent}
              </Stack>
            </Group>
          </UnstyledButton>
        ) : (
          <Group justify="space-between" align="center">
            <Stack gap={4}>{headerContent}</Stack>
          </Group>
        )}
        <Collapse expanded={collapsible ? filtersOpen : true}>{filterBody}</Collapse>
      </Stack>
    </Paper>
  );
}
