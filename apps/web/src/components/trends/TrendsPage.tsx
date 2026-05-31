import { useLingui } from "@lingui/react";
import { i18n } from "@lingui/core";
import {
  Alert,
  Box,
  Group,
  Select,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { LineChart } from "@mantine/charts";
import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  availableDisciplines,
  availablePrograms,
  buildProgramCourseFilter,
  computeDisciplineLeaderboard,
  computeGradeTrends,
  programSlug,
  type TrendPoint,
  type TermSeason,
} from "@uoplan/core";
import { formatLocaleNumber, tr } from "../../i18n";
import { useCourseGradesPb } from "../../hooks/useCourseGradesPb";
import { useAppStore } from "../../store/appStore";
import { BackButton } from "../shared/BackButton";
import { ChromeControls } from "../shared/ChromeControls";
import { AppCard } from "../shared/AppCard";
import { AnimatedNumber } from "../shared/AnimatedNumber";
import type { TrendsSearch, TrendsMetric, TrendsSort } from "../../routes/trends";

type MetricId = TrendsMetric;
type LeaderboardSort = TrendsSort;

type TrendsPageProps = {
  search: TrendsSearch;
  onChange: (next: TrendsSearch) => void;
};

const SEASON_SHORT: Record<TermSeason, string> = {
  fall: "F",
  winter: "W",
  springSummer: "S",
};

const LEADERBOARD_MIN_VOLUME = 50;
const LEADERBOARD_LIMIT = 10;

const METRIC_COLOR: Record<MetricId, string> = {
  gpa: "violet.5",
  "a-plus": "teal.6",
  "a-range": "blue.5",
  pass: "green.6",
  volume: "orange.5",
};

function pointMetric(point: TrendPoint, metric: MetricId): number | null {
  switch (metric) {
    case "gpa":
      return point.gpa;
    case "a-plus":
      return point.aPlusPct;
    case "a-range":
      return point.aRangePct;
    case "pass":
      return point.passPct;
    case "volume":
      return point.volume;
  }
}

export function TrendsPage({ search, onChange }: TrendsPageProps) {
  useLingui();
  const { data: grades, error: gradesError } = useCourseGradesPb();
  const disciplines = useAppStore(useShallow((s) => s.disciplines));
  const catalogue = useAppStore((s) => s.catalogue);
  const isFr = i18n.locale.startsWith("fr");

  const extras = search;
  const discipline = search.discipline ?? null;
  const level = search.level ?? null;
  const season = (search.season as TermSeason | undefined) ?? null;
  const programSlugValue = search.program ?? null;

  const metricOptions = useMemo(
    () => [
      { value: "gpa" as MetricId, label: tr("trends.metric.gpa") },
      { value: "a-plus" as MetricId, label: tr("trends.metric.aPlus") },
      { value: "a-range" as MetricId, label: tr("trends.metric.aRange") },
      { value: "pass" as MetricId, label: tr("trends.metric.pass") },
      { value: "volume" as MetricId, label: tr("trends.metric.volume") },
    ],
    [],
  );

  const activeMetric: MetricId =
    metricOptions.find((m) => m.value === extras.metric)?.value ?? "gpa";

  const formatMetric = (metricId: MetricId, value: number | null): string => {
    if (value == null) return "—";
    if (metricId === "gpa") {
      return formatLocaleNumber(value, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    }
    if (metricId === "volume") {
      return formatLocaleNumber(Math.round(value));
    }
    return `${formatLocaleNumber(value, { maximumFractionDigits: 1 })}%`;
  };

  const disciplineNameByCode = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of disciplines ?? []) {
      map.set(d.code, isFr ? (d.nameFr ?? d.name) : d.name);
    }
    return map;
  }, [disciplines, isFr]);

  // Discipline options depend only on grades (intersected with named disciplines).
  const disciplineOptions = useMemo(() => {
    if (!grades) return [];
    return availableDisciplines(grades).map((entry) => {
      const name = disciplineNameByCode.get(entry.discipline);
      return {
        value: entry.discipline,
        label: name ? `${entry.discipline} · ${name}` : entry.discipline,
      };
    });
  }, [grades, disciplineNameByCode]);

  // Program options: only degrees whose core courses have grade data.
  const programOptions = useMemo(() => {
    if (!grades || !catalogue) return [];
    return availablePrograms(grades, catalogue.programs).map((p) => ({
      value: p.slug,
      label: p.title,
    }));
  }, [grades, catalogue]);

  // Estimated core-course filter for the selected program (intersects with the
  // discipline/level/season filters in computeGradeTrends).
  const programFilter = useMemo(() => {
    if (!programSlugValue || !catalogue) return null;
    const program = catalogue.programs.find((p) => programSlug(p) === programSlugValue);
    return program ? buildProgramCourseFilter(program) : null;
  }, [programSlugValue, catalogue]);

  // Trend series depends on grades + active filters.
  const points = useMemo(() => {
    if (!grades) return [];
    return computeGradeTrends(grades, { discipline, level, season, programFilter }).points;
  }, [grades, discipline, level, season, programFilter]);

  // Leaderboard depends only on grades (global scope, by design).
  const leaderboard = useMemo(() => {
    if (!grades) return [];
    return computeDisciplineLeaderboard(grades, { minTermVolume: LEADERBOARD_MIN_VOLUME });
  }, [grades]);

  const chartData = useMemo(
    () =>
      points.map((point) => ({
        term: `${point.season ? SEASON_SHORT[point.season] : "?"}${String(point.year).slice(2)}`,
        value: pointMetric(point, activeMetric),
      })),
    [points, activeMetric],
  );

  const firstPoint = points[0] ?? null;
  const lastPoint = points.length > 0 ? points[points.length - 1] : null;
  const latestValue = lastPoint ? pointMetric(lastPoint, activeMetric) : null;
  const firstValue = firstPoint ? pointMetric(firstPoint, activeMetric) : null;
  const delta = latestValue != null && firstValue != null ? latestValue - firstValue : null;
  const totalVolume = points.reduce((sum, p) => sum + p.volume, 0);

  const leaderboardSort = (extras.sort ?? "rise") as LeaderboardSort;

  const rankedDisciplines = useMemo(() => {
    const rows = [...leaderboard];
    if (leaderboardSort === "rise") {
      return rows
        .filter((d) => d.gpaDelta != null)
        .sort((a, b) => (b.gpaDelta ?? 0) - (a.gpaDelta ?? 0))
        .slice(0, LEADERBOARD_LIMIT);
    }
    if (leaderboardSort === "easiest") {
      return rows
        .filter((d) => d.currentGpa != null)
        .sort((a, b) => (b.currentGpa ?? 0) - (a.currentGpa ?? 0))
        .slice(0, LEADERBOARD_LIMIT);
    }
    return rows
      .filter((d) => d.currentGpa != null)
      .sort((a, b) => (a.currentGpa ?? 0) - (b.currentGpa ?? 0))
      .slice(0, LEADERBOARD_LIMIT);
  }, [leaderboard, leaderboardSort]);

  const update = (patch: Partial<TrendsSearch>) => {
    const next: Record<string, unknown> = { ...search, ...patch };
    for (const key of Object.keys(next)) {
      const value = next[key];
      if (value == null || value === "" || value === "all") delete next[key];
    }
    onChange(next as TrendsSearch);
  };

  return (
    <Box
      component="main"
      style={{
        position: "relative",
        minHeight: "100vh",
        padding: 24,
        backgroundColor: "var(--app-bg)",
        boxSizing: "border-box",
      }}
    >
      <Stack gap="lg" w="100%" maw={1000} mx="auto">
        <Group align="flex-start" justify="space-between" wrap="nowrap">
          <Stack gap={4}>
            <BackButton fallbackTo="/" fallbackLabel={tr("app.nav.backHome")} />
            <Title
              order={1}
              style={{
                fontFamily: "var(--app-font-heading)",
                color: "var(--app-text)",
                fontWeight: 400,
                fontSize: "clamp(1.5rem, 4vw, 2rem)",
              }}
            >
              {tr("trends.title")}
            </Title>
            <Text size="sm" c="dimmed" maw={620}>
              {tr("trends.subtitle")}
            </Text>
          </Stack>
          <ChromeControls />
        </Group>

        {gradesError ? (
          <Alert color="red" title={tr("trends.error.title")}>
            {gradesError}
          </Alert>
        ) : !grades || disciplineOptions.length === 0 ? (
          <AppCard p="xl">
            <Text c="dimmed">{tr("trends.empty.noData")}</Text>
          </AppCard>
        ) : (
          <>
            <AppCard p="md">
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
                      style={{ minWidth: 280 }}
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
                    nothingFoundMessage={tr("trends.filter.noMatch")}
                    style={{ minWidth: 260 }}
                  />
                  <Stack gap={4}>
                    <Text size="xs" c="dimmed" fw={600}>
                      {tr("trends.filter.level")}
                    </Text>
                    <SegmentedControl
                      size="xs"
                      value={level ? String(level) : "all"}
                      onChange={(value) =>
                        update({ level: value === "all" ? undefined : Number(value) })
                      }
                      data={[
                        { value: "all", label: tr("trends.filter.all") },
                        { value: "1000", label: "1000" },
                        { value: "2000", label: "2000" },
                        { value: "3000", label: "3000" },
                        { value: "4000", label: "4000" },
                      ]}
                    />
                  </Stack>
                  <Stack gap={4}>
                    <Text size="xs" c="dimmed" fw={600}>
                      {tr("trends.filter.season")}
                    </Text>
                    <SegmentedControl
                      size="xs"
                      value={season ?? "all"}
                      onChange={(value) =>
                        update({ season: value === "all" ? undefined : (value as TermSeason) })
                      }
                      data={[
                        { value: "all", label: tr("trends.filter.all") },
                        { value: "fall", label: tr("trends.season.fall") },
                        { value: "winter", label: tr("trends.season.winter") },
                        { value: "springSummer", label: tr("trends.season.springSummer") },
                      ]}
                    />
                  </Stack>
                </Group>

                <Stack gap={4}>
                  <Text size="xs" c="dimmed" fw={600}>
                    {tr("trends.metric.label")}
                  </Text>
                  <SegmentedControl
                    size="xs"
                    value={activeMetric}
                    onChange={(value) => update({ metric: value as MetricId })}
                    data={metricOptions.map((m) => ({ value: m.value, label: m.label }))}
                  />
                </Stack>
              </Stack>
            </AppCard>

            {points.length === 0 ? (
              <AppCard p="xl">
                <Text c="dimmed">{tr("trends.empty.noResults")}</Text>
              </AppCard>
            ) : (
              <>
                <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
                  <StatCard
                    label={tr("trends.stat.latest")}
                    value={latestValue}
                    format={(n) => formatMetric(activeMetric, n)}
                  />
                  <StatCard
                    label={tr("trends.stat.change")}
                    value={delta}
                    format={(n) => `${n > 0 ? "+" : ""}${formatMetric(activeMetric, n)}`}
                    valueColor={
                      delta == null || delta === 0
                        ? undefined
                        : delta > 0
                          ? "var(--app-info)"
                          : "var(--app-warning)"
                    }
                  />
                  <StatCard
                    label={tr("trends.stat.terms")}
                    value={points.length}
                    format={(n) => formatLocaleNumber(Math.round(n))}
                  />
                  <StatCard
                    label={tr("trends.stat.volume")}
                    value={totalVolume}
                    format={(n) => formatLocaleNumber(Math.round(n))}
                  />
                </SimpleGrid>

                <AppCard p="md">
                  <LineChart
                    h={320}
                    data={chartData}
                    dataKey="term"
                    series={[
                      {
                        name: "value",
                        label: metricOptions.find((m) => m.value === activeMetric)?.label,
                        color: METRIC_COLOR[activeMetric],
                      },
                    ]}
                    curveType="monotone"
                    connectNulls
                    withDots={chartData.length <= 24}
                    yAxisProps={
                      activeMetric === "gpa"
                        ? { domain: [0, 10] }
                        : activeMetric === "volume"
                          ? { domain: [0, "auto"] }
                          : { domain: [0, 100] }
                    }
                    valueFormatter={(value) => formatMetric(activeMetric, value)}
                  />
                </AppCard>
              </>
            )}

            <AppCard p="md">
              <Stack gap="sm">
                <Group justify="space-between" align="flex-end" wrap="wrap" gap="sm">
                  <Stack gap={2}>
                    <Text fw={600} c="var(--app-text)">
                      {tr("trends.leaderboard.title")}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {tr("trends.leaderboard.scope")}
                    </Text>
                  </Stack>
                  <SegmentedControl
                    size="xs"
                    value={leaderboardSort}
                    onChange={(value) => update({ sort: value as LeaderboardSort })}
                    data={[
                      { value: "rise", label: tr("trends.leaderboard.rise") },
                      { value: "easiest", label: tr("trends.leaderboard.easiest") },
                      { value: "hardest", label: tr("trends.leaderboard.hardest") },
                    ]}
                  />
                </Group>

                <Table.ScrollContainer minWidth={420}>
                  <Table highlightOnHover verticalSpacing="xs">
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>{tr("trends.leaderboard.col.discipline")}</Table.Th>
                        <Table.Th ta="right">{tr("trends.leaderboard.col.currentGpa")}</Table.Th>
                        <Table.Th ta="right">{tr("trends.leaderboard.col.change")}</Table.Th>
                        <Table.Th ta="right">{tr("trends.leaderboard.col.span")}</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {rankedDisciplines.map((row) => {
                        const name = disciplineNameByCode.get(row.discipline);
                        return (
                          <Table.Tr key={row.discipline}>
                            <Table.Td>
                              <Text size="sm" fw={600} c="var(--app-text)">
                                {row.discipline}
                              </Text>
                              {name ? (
                                <Text size="xs" c="dimmed">
                                  {name}
                                </Text>
                              ) : null}
                            </Table.Td>
                            <Table.Td ta="right">{formatMetric("gpa", row.currentGpa)}</Table.Td>
                            <Table.Td ta="right">
                              {row.gpaDelta == null ? (
                                <Text size="sm" c="dimmed">
                                  —
                                </Text>
                              ) : (
                                <Text
                                  size="sm"
                                  c={
                                    row.gpaDelta > 0
                                      ? "var(--app-info)"
                                      : row.gpaDelta < 0
                                        ? "var(--app-warning)"
                                        : "dimmed"
                                  }
                                >
                                  {`${row.gpaDelta >= 0 ? "+" : ""}${formatLocaleNumber(
                                    row.gpaDelta,
                                    {
                                      minimumFractionDigits: 1,
                                      maximumFractionDigits: 1,
                                    },
                                  )}`}
                                </Text>
                              )}
                            </Table.Td>
                            <Table.Td ta="right">
                              <Text size="xs" c="dimmed">
                                {row.firstYear && row.lastYear
                                  ? `${row.firstYear}–${row.lastYear}`
                                  : "—"}
                              </Text>
                            </Table.Td>
                          </Table.Tr>
                        );
                      })}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              </Stack>
            </AppCard>
          </>
        )}
      </Stack>
    </Box>
  );
}

function StatCard({
  label,
  value,
  format,
  placeholder = "—",
  valueColor,
}: {
  label: string;
  value: number | null;
  format: (value: number) => string;
  placeholder?: string;
  valueColor?: string;
}) {
  return (
    <AppCard p="md">
      <Stack gap={2}>
        <Text size="xs" c="dimmed" fw={600} style={{ letterSpacing: "0.02em" }}>
          {label}
        </Text>
        <Text
          fw={700}
          size="lg"
          style={{ color: valueColor ?? "var(--app-text)", fontVariantNumeric: "tabular-nums" }}
        >
          <AnimatedNumber value={value} format={format} placeholder={placeholder} />
        </Text>
      </Stack>
    </AppCard>
  );
}
