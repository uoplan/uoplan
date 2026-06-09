import { Group, Select } from "@mantine/core";
import type { TermSeason } from "@uoplan/core";
import { tr } from "../../i18n";
import type { TrendsMetric } from "../../lib/trends/searchParams";
import { useTrends } from "./TrendsFilterProvider";

/**
 * Shared filter bar for the trends pages: program / discipline scope, level and
 * season filters, and the active metric. Every control is a compact `Select`,
 * laid out as a single wrapping row so it stays slim on desktop and folds neatly
 * into the mobile drawer. Persisted via URL search params, so it stays in sync as
 * the user moves between the hub and sub-routes.
 */
export function TrendsFilterControls() {
  const {
    update,
    discipline,
    level,
    season,
    programSlugValue,
    activeMetric,
    metricOptions,
    disciplineOptions,
    programOptions,
    disciplineOptionsFilter,
    levelData,
    seasonData,
  } = useTrends();

  return (
    <Group gap="sm" align="flex-end" wrap="wrap">
      {programOptions.length > 0 ? (
        <Select
          size="xs"
          label={tr("trends.filter.program")}
          placeholder={tr("trends.filter.allPrograms")}
          data={programOptions}
          value={programSlugValue}
          onChange={(value) => update({ program: value ?? undefined })}
          disabled={discipline != null}
          searchable
          clearable
          nothingFoundMessage={tr("trends.filter.noProgramMatch")}
          style={{ flex: "2 1 220px", minWidth: 0 }}
        />
      ) : null}
      <Select
        size="xs"
        label={tr("trends.filter.discipline")}
        placeholder={tr("trends.filter.allDisciplines")}
        data={disciplineOptions}
        value={discipline}
        onChange={(value) => update({ discipline: value ?? undefined })}
        disabled={programSlugValue != null}
        searchable
        clearable
        filter={disciplineOptionsFilter}
        nothingFoundMessage={tr("trends.filter.noMatch")}
        style={{ flex: "2 1 220px", minWidth: 0 }}
      />
      <Select
        size="xs"
        label={tr("trends.filter.level")}
        value={level ? String(level) : "all"}
        onChange={(value) =>
          update({ level: !value || value === "all" ? undefined : Number(value) })
        }
        data={levelData}
        style={{ flex: "1 1 100px", minWidth: 0 }}
      />
      <Select
        size="xs"
        label={tr("trends.filter.season")}
        value={season ?? "all"}
        onChange={(value) =>
          update({ season: !value || value === "all" ? undefined : (value as TermSeason) })
        }
        data={seasonData}
        style={{ flex: "1 1 120px", minWidth: 0 }}
      />
      <Select
        size="xs"
        label={tr("trends.metric.label")}
        value={activeMetric}
        onChange={(value) => value && update({ metric: value as TrendsMetric })}
        data={metricOptions.map((m) => ({ value: m.value, label: m.label }))}
        style={{ flex: "1 1 140px", minWidth: 0 }}
      />
    </Group>
  );
}
