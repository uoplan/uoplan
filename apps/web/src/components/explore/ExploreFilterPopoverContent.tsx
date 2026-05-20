import { Box, Checkbox, Radio, Stack } from "@mantine/core";
import { useLingui } from "@lingui/react";
import { tr } from "../../i18n";
import type {
  ExploreFilterDifficulty,
  ExploreFilterLevel,
  ExploreFilterState,
} from "../../lib/explore/exploreFilters";

type FilterKey = "level" | "language" | "difficulty" | "rating";

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

const checkboxStyles = {
  label: { color: "#c1c2c5", fontSize: "var(--mantine-font-size-sm)", cursor: "pointer" },
  input: { cursor: "pointer", backgroundColor: "#25262b", borderColor: "#4a4d57" },
};

const radioStyles = {
  label: { color: "#c1c2c5", fontSize: "var(--mantine-font-size-sm)", cursor: "pointer" },
  radio: { cursor: "pointer", backgroundColor: "#25262b", borderColor: "#4a4d57" },
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
  useLingui();

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
              onClick={() => {
                if (filters.minRating === value) onChange({ minRating: null });
              }}
            />
          ))}
        </Stack>
      </Radio.Group>
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
  }
}
