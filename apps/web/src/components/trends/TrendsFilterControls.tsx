import { Group, Select, SegmentedControl, Stack, Text } from "@mantine/core";
import type { TermSeason } from "@uoplan/core";
import { tr } from "../../i18n";
import type { TrendsMetric } from "../../lib/trends/searchParams";
import { useTrends } from "./TrendsFilterProvider";

/**
 * Shared filter bar for the trends pages: program / discipline scope, level and
 * season filters, and the active metric. Persisted via URL search params, so it
 * stays in sync as the user moves between the hub and sub-routes.
 */
export function TrendsFilterControls() {
  const {
    isMobile,
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
    <Stack gap="md">
      <Group gap="md" align="flex-end" wrap="wrap">
        {programOptions.length > 0 ? (
          <Select
            label={tr("trends.filter.program")}
            placeholder={tr("trends.filter.allPrograms")}
            description={tr("trends.filter.programHint")}
            data={programOptions}
            value={programSlugValue}
            onChange={(value) => update({ program: value ?? undefined })}
            disabled={discipline != null}
            searchable
            clearable
            nothingFoundMessage={tr("trends.filter.noProgramMatch")}
            style={{ flex: "1 1 240px", minWidth: 0 }}
          />
        ) : null}
        <Select
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
          style={{ flex: "1 1 240px", minWidth: 0 }}
        />
        <Stack gap={4} style={{ flex: isMobile ? "1 1 120px" : undefined, minWidth: 0 }}>
          <Text size="xs" c="dimmed" fw={600}>
            {tr("trends.filter.level")}
          </Text>
          {isMobile ? (
            <Select
              size="xs"
              value={level ? String(level) : "all"}
              onChange={(value) =>
                update({ level: !value || value === "all" ? undefined : Number(value) })
              }
              data={levelData}
            />
          ) : (
            <SegmentedControl
              size="xs"
              value={level ? String(level) : "all"}
              onChange={(value) => update({ level: value === "all" ? undefined : Number(value) })}
              data={levelData}
            />
          )}
        </Stack>
        <Stack gap={4} style={{ flex: isMobile ? "1 1 120px" : undefined, minWidth: 0 }}>
          <Text size="xs" c="dimmed" fw={600}>
            {tr("trends.filter.season")}
          </Text>
          {isMobile ? (
            <Select
              size="xs"
              value={season ?? "all"}
              onChange={(value) =>
                update({
                  season: !value || value === "all" ? undefined : (value as TermSeason),
                })
              }
              data={seasonData}
            />
          ) : (
            <SegmentedControl
              size="xs"
              value={season ?? "all"}
              onChange={(value) =>
                update({ season: value === "all" ? undefined : (value as TermSeason) })
              }
              data={seasonData}
            />
          )}
        </Stack>
      </Group>

      <Stack gap={4}>
        <Text size="xs" c="dimmed" fw={600}>
          {tr("trends.metric.label")}
        </Text>
        {isMobile ? (
          <Select
            size="xs"
            value={activeMetric}
            onChange={(value) => value && update({ metric: value as TrendsMetric })}
            data={metricOptions.map((m) => ({ value: m.value, label: m.label }))}
          />
        ) : (
          <SegmentedControl
            size="xs"
            value={activeMetric}
            onChange={(value) => update({ metric: value as TrendsMetric })}
            data={metricOptions.map((m) => ({ value: m.value, label: m.label }))}
          />
        )}
      </Stack>
    </Stack>
  );
}
