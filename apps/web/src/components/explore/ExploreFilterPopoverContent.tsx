import {
  Box,
  Checkbox,
  type ComboboxItem,
  Group,
  MultiSelect,
  Radio,
  SegmentedControl,
  Stack,
  Text,
} from "@mantine/core";
import { useMemo } from "react";
import { useTr, tr } from "../../i18n";
import { createRankedOptionsFilter } from "../../lib/explore/optionRanking";
import type {
  ExploreFilterDifficulty,
  ExploreFilterLevel,
  ExploreFilterState,
  ExploreSortDir,
  ExploreSortKey,
} from "../../lib/explore/exploreFilters";

type FilterKey = "level" | "language" | "discipline" | "difficulty" | "rating" | "sort";

export type DisciplineOption = { code: string; name: string };

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
  { value: "grade", labelKey: "explore.sort.grade" },
  { value: "code", labelKey: "explore.sort.code" },
  { value: "rating", labelKey: "explore.sort.rating" },
];

const SORT_DEFAULT_DIR: Record<ExploreSortKey, ExploreSortDir> = {
  relevance: "desc",
  grade: "desc",
  code: "asc",
  rating: "desc",
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
  disciplineOptions = [],
}: {
  filterKey: FilterKey;
  filters: ExploreFilterState;
  onChange: (next: Partial<ExploreFilterState>) => void;
  disciplineOptions?: DisciplineOption[];
}) {
  useTr();

  const nameByCode = useMemo(() => {
    const map = new Map<string, string>();
    for (const opt of disciplineOptions) map.set(opt.code, opt.name);
    return map;
  }, [disciplineOptions]);

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

  if (filterKey === "discipline") {
    const data: ComboboxItem[] = disciplineOptions.map((opt) => ({
      value: opt.code,
      label: opt.code,
    }));

    const renderOption: (input: { option: ComboboxItem }) => React.ReactNode = ({ option }) => {
      const name = nameByCode.get(option.value) ?? "";
      return (
        <Text size="sm" component="span" style={{ color: "var(--app-text)" }}>
          <Text component="span" inherit style={{ color: "var(--app-text-dim)" }}>
            {option.value} •
          </Text>{" "}
          {name}
        </Text>
      );
    };

    const optionsFilter = createRankedOptionsFilter((option) => ({
      code: option.value,
      text: nameByCode.get(option.value) ?? "",
    }));

    return (
      <MultiSelect
        data={data}
        value={filters.disciplines}
        onChange={(values) => onChange({ disciplines: values })}
        renderOption={renderOption}
        filter={optionsFilter}
        searchable
        clearable
        radius="md"
        w={224}
        maxDropdownHeight={240}
        placeholder={
          filters.disciplines.length === 0 ? tr("explore.filter.discipline.placeholder") : undefined
        }
        nothingFoundMessage={tr("explore.filter.discipline.empty")}
        comboboxProps={{ withinPortal: true, zIndex: 400 }}
        styles={{ dropdown: { minWidth: 240 } }}
      />
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
    case "discipline":
      return tr("explore.filter.discipline");
    case "difficulty":
      return tr("explore.filter.difficulty");
    case "rating":
      return tr("explore.filter.rating");
    case "sort":
      return tr("explore.sort.label");
  }
}
