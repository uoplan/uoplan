import { Box, Checkbox, Group, Radio, SegmentedControl, Stack, Text } from "@mantine/core";
import { useTr, tr } from "../../i18n";
import type {
  ExploreFilterDifficulty,
  ExploreFilterLevel,
  ExploreFilterState,
  ExploreSortDir,
  ExploreSortKey,
} from "../../lib/explore/exploreFilters";

type FilterKey = "level" | "language" | "difficulty" | "rating" | "sort";

const LEVELS: { value: ExploreFilterLevel; labelKey: string }[] = [
  { value: 1000, labelKey: "explore.filter.level.1000" },
  { value: 2000, labelKey: "explore.filter.level.2000" },
  { value: 3000, labelKey: "explore.filter.level.3000" },
  { value: 4000, labelKey: "explore.filter.level.4000" },
  { value: 5000, labelKey: "explore.filter.level.5000" },
];

const LANGUAGES: { value: "en" | "fr"; labelKey: string }[] = [
  { value: "en", labelKey: "explore.filter.language.en" },
  { value: "fr", labelKey: "explore.filter.language.fr" },
];

const DIFFICULTIES: { value: ExploreFilterDifficulty; labelKey: string }[] = [
  { value: "easy", labelKey: "explore.filter.difficulty.easy" },
  { value: "moderate", labelKey: "explore.filter.difficulty.moderate" },
  { value: "tough", labelKey: "explore.filter.difficulty.tough" },
];

const RATINGS: { value: number; labelKey: string }[] = [
  { value: 3.0, labelKey: "explore.filter.rating.good" },
  { value: 3.5, labelKey: "explore.filter.rating.great" },
  { value: 4.0, labelKey: "explore.filter.rating.excellent" },
];

const SORT_OPTIONS: { value: ExploreSortKey; labelKey: string }[] = [
  { value: "relevance", labelKey: "explore.sort.relevance" },
  { value: "avgGrade", labelKey: "explore.sort.avgGrade" },
  { value: "courseCode", labelKey: "explore.sort.courseCode" },
  { value: "profRating", labelKey: "explore.sort.profRating" },
];

const SORT_DEFAULT_DIR: Record<ExploreSortKey, ExploreSortDir> = {
  relevance: "desc",
  avgGrade: "desc",
  courseCode: "asc",
  profRating: "desc",
};

const checkboxStyles = {
  label: {
    color: "var(--app-text-muted)",
    fontSize: "var(--mantine-font-size-sm)",
    cursor: "pointer",
  },
  input: {
    cursor: "pointer",
    backgroundColor: "var(--app-surface-overlay)",
    borderColor: "var(--app-border-strong)",
  },
};

const radioStyles = {
  label: {
    color: "var(--app-text-muted)",
    fontSize: "var(--mantine-font-size-sm)",
    cursor: "pointer",
  },
};

const radioClassNames = {
  radio: "explore-radio-input",
};

const segmentedStyles = {
  root: { backgroundColor: "var(--app-surface-overlay)" },
  label: { color: "var(--app-text-muted)", fontSize: "var(--mantine-font-size-xs)" },
};

export function ExploreFilterPopoverContent({
  filterKey,
  filters,
  onChange,
}: {
  filterKey: FilterKey;
  filters: ExploreFilterState;
  onChange: (next: Partial<ExploreFilterState>) => void;
}) {
  useTr();

  if (filterKey === "level") {
    return (
      <Stack gap={8}>
        {LEVELS.map(({ value, labelKey }) => (
          <Checkbox
            key={value}
            label={tr(labelKey)}
            checked={filters.levels.includes(value)}
            styles={checkboxStyles}
            onChange={(e) => {
              const next = e.currentTarget.checked
                ? [...filters.levels, value]
                : filters.levels.filter((l) => l !== value);
              onChange({ levels: next });
            }}
          />
        ))}
      </Stack>
    );
  }

  if (filterKey === "language") {
    return (
      <Stack gap={8}>
        {LANGUAGES.map(({ value, labelKey }) => (
          <Checkbox
            key={value}
            label={tr(labelKey)}
            checked={filters.languages.includes(value)}
            styles={checkboxStyles}
            onChange={(e) => {
              const next = e.currentTarget.checked
                ? [...filters.languages, value]
                : filters.languages.filter((l) => l !== value);
              onChange({ languages: next });
            }}
          />
        ))}
      </Stack>
    );
  }

  if (filterKey === "difficulty") {
    return (
      <Radio.Group
        value={filters.difficulty ?? ""}
        onChange={(v) => onChange({ difficulty: v === "" ? null : (v as ExploreFilterDifficulty) })}
      >
        <Stack gap={8}>
          {DIFFICULTIES.map(({ value, labelKey }) => (
            <Radio
              key={value}
              value={value}
              label={tr(labelKey)}
              styles={radioStyles}
              classNames={radioClassNames}
              iconColor="var(--app-on-accent)"
              onClick={() => {
                if (filters.difficulty === value) onChange({ difficulty: null });
              }}
            />
          ))}
        </Stack>
      </Radio.Group>
    );
  }

  if (filterKey === "rating") {
    return (
      <Radio.Group
        value={filters.minRating != null ? String(filters.minRating) : ""}
        onChange={(v) => onChange({ minRating: v === "" ? null : Number(v) })}
      >
        <Stack gap={8}>
          {RATINGS.map(({ value, labelKey }) => (
            <Radio
              key={value}
              value={String(value)}
              label={tr(labelKey)}
              styles={radioStyles}
              classNames={radioClassNames}
              iconColor="var(--app-on-accent)"
              onClick={() => {
                if (filters.minRating === value) onChange({ minRating: null });
              }}
            />
          ))}
        </Stack>
      </Radio.Group>
    );
  }

  if (filterKey === "sort") {
    const showDirection = filters.sortKey !== "relevance";
    return (
      <Stack gap={12}>
        <Radio.Group
          value={filters.sortKey}
          onChange={(value) => {
            const key = value as ExploreSortKey;
            onChange({ sortKey: key, sortDir: SORT_DEFAULT_DIR[key] });
          }}
        >
          <Stack gap={8}>
            {SORT_OPTIONS.map(({ value, labelKey }) => (
              <Radio
                key={value}
                value={value}
                label={tr(labelKey)}
                styles={radioStyles}
                classNames={radioClassNames}
                iconColor="var(--app-on-accent)"
              />
            ))}
          </Stack>
        </Radio.Group>
        <Stack gap={6}>
          <Group justify="space-between" align="center">
            <Text size="xs" c="dimmed">
              {tr("explore.sort.direction")}
            </Text>
          </Group>
          <SegmentedControl
            size="xs"
            value={filters.sortDir}
            onChange={(value) => onChange({ sortDir: value as ExploreSortDir })}
            data={[
              { label: tr("explore.sort.ascending"), value: "asc" },
              { label: tr("explore.sort.descending"), value: "desc" },
            ]}
            disabled={!showDirection}
            styles={segmentedStyles}
          />
        </Stack>
      </Stack>
    );
  }

  return <Box />;
}

export function filterSectionLabel(key: FilterKey): string {
  switch (key) {
    case "level":
      return tr("explore.filter.level");
    case "language":
      return tr("explore.filter.language");
    case "difficulty":
      return tr("explore.filter.difficulty");
    case "rating":
      return tr("explore.filter.rating");
    case "sort":
      return tr("explore.sort.label");
  }
}
