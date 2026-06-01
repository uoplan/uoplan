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
import { useMediaQuery } from "@mantine/hooks";
import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  availableDisciplines,
  availablePrograms,
  buildProgramCourseFilter,
  computeCourseLeaderboard,
  computeDisciplineLeaderboard,
  computeGradeTrends,
  normalizeCourseCode,
  programSlug,
  type TrendPoint,
  type TermSeason,
} from "@uoplan/core";
import { useTr, formatLocaleNumber, tr } from "../../i18n";
import { useCourseGradesPb } from "../../hooks/useCourseGradesPb";
import { useAppStore } from "../../store/appStore";
import { courseNormToPathParam } from "../../lib/explore/courseSearchParams";
import { programSlugToPathParam } from "../../lib/explore/programSearch";
import { EMPTY_EXPLORE_SEARCH } from "../../lib/explore/exploreFilters";
import type { BackState } from "../../lib/navigation/backState";
import { BackButton } from "../shared/BackButton";
import { ChromeControls } from "../shared/ChromeControls";
import { AppCard } from "../shared/AppCard";
import { AnimatedNumber } from "../shared/AnimatedNumber";
import {
  toUrlSearch,
  type TrendsSearch,
  type TrendsMetric,
  type TrendsSort,
} from "../../routes/trends";

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
/** Lower per-term volume guard for the finer-grained per-course leaderboard. */
const COURSE_LEADERBOARD_MIN_VOLUME = 5;

type LeaderboardRow = {
  key: string;
  label: string;
  name: string | null;
  currentGpa: number | null;
  gpaDelta: number | null;
  firstYear: number | null;
  lastYear: number | null;
};

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
  useTr();
  const { data: grades, error: gradesError } = useCourseGradesPb();
  const disciplines = useAppStore(useShallow((s) => s.disciplines));
  const catalogue = useAppStore((s) => s.catalogue);
  const isFr = i18n.locale.startsWith("fr");
  const isMobile = useMediaQuery("(max-width: 768px)", false, {
    getInitialValueInEffect: false,
  });

  // On mobile, stack long-label segmented controls vertically so their options
  // aren't clipped; numeric controls (e.g. level) just go full-width.
  const verticalSegmented = isMobile ? ({ fullWidth: true, orientation: "vertical" } as const) : {};
  const fullWidthSegmented = isMobile ? ({ fullWidth: true } as const) : {};

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

  // Leaderboard: per-course rows when scoped to a program/discipline (matching
  // the chart's course set), otherwise the global per-discipline leaderboard.
  const filteredMode = programFilter != null || discipline != null;

  const courseTitleByCode = useMemo(() => {
    const map = new Map<string, string>();
    for (const course of catalogue?.courses ?? []) {
      map.set(normalizeCourseCode(course.code), course.title);
    }
    return map;
  }, [catalogue]);

  const leaderboardRows = useMemo<LeaderboardRow[]>(() => {
    if (!grades) return [];
    if (filteredMode) {
      return computeCourseLeaderboard(
        grades,
        { discipline, level, season, programFilter },
        { minTermVolume: COURSE_LEADERBOARD_MIN_VOLUME },
      ).map((row) => ({
        key: row.code,
        label: row.code,
        name: courseTitleByCode.get(row.code) ?? null,
        currentGpa: row.currentGpa,
        gpaDelta: row.gpaDelta,
        firstYear: row.firstYear,
        lastYear: row.lastYear,
      }));
    }
    return computeDisciplineLeaderboard(grades, {
      minTermVolume: LEADERBOARD_MIN_VOLUME,
      level,
      season,
    }).map((row) => ({
      key: row.discipline,
      label: row.discipline,
      name: disciplineNameByCode.get(row.discipline) ?? null,
      currentGpa: row.currentGpa,
      gpaDelta: row.gpaDelta,
      firstYear: row.firstYear,
      lastYear: row.lastYear,
    }));
  }, [
    grades,
    filteredMode,
    discipline,
    level,
    season,
    programFilter,
    courseTitleByCode,
    disciplineNameByCode,
  ]);

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

  const rankedRows = useMemo(() => {
    const rows = [...leaderboardRows];
    const limit = filteredMode ? rows.length : LEADERBOARD_LIMIT;
    if (leaderboardSort === "rise") {
      if (filteredMode) {
        // Keep every matched course; rows without a delta sink to the bottom.
        return rows.sort((a, b) => {
          if (a.gpaDelta == null && b.gpaDelta == null) return 0;
          if (a.gpaDelta == null) return 1;
          if (b.gpaDelta == null) return -1;
          return b.gpaDelta - a.gpaDelta;
        });
      }
      return rows
        .filter((d) => d.gpaDelta != null)
        .sort((a, b) => (b.gpaDelta ?? 0) - (a.gpaDelta ?? 0))
        .slice(0, limit);
    }
    if (leaderboardSort === "easiest") {
      return rows
        .filter((d) => d.currentGpa != null)
        .sort((a, b) => (b.currentGpa ?? 0) - (a.currentGpa ?? 0))
        .slice(0, limit);
    }
    return rows
      .filter((d) => d.currentGpa != null)
      .sort((a, b) => (a.currentGpa ?? 0) - (b.currentGpa ?? 0))
      .slice(0, limit);
  }, [leaderboardRows, leaderboardSort, filteredMode]);

  const leaderboardScope = (() => {
    if (programSlugValue) {
      const title = programOptions.find((p) => p.value === programSlugValue)?.label;
      return title ? tr("trends.leaderboard.scopeProgram", { name: title }) : null;
    }
    if (discipline) {
      const name = disciplineNameByCode.get(discipline);
      return tr("trends.leaderboard.scopeDiscipline", {
        name: name ? `${discipline} · ${name}` : discipline,
      });
    }
    return tr("trends.leaderboard.scope");
  })();

  const update = (patch: Partial<TrendsSearch>) => {
    const next: Record<string, unknown> = { ...search, ...patch };
    for (const key of Object.keys(next)) {
      const value = next[key];
      if (value == null || value === "" || value === "all") delete next[key];
    }
    onChange(next as TrendsSearch);
  };

  const trendsBack = useMemo<BackState>(
    () => ({ to: "/trends", search: toUrlSearch(search), label: tr("trends.title") }),
    [search],
  );

  const renderRowLabel = (row: LeaderboardRow) => {
    const label = (
      <Text size="sm" fw={600} c="var(--app-accent)" span>
        {row.label}
      </Text>
    );
    if (filteredMode) {
      return (
        <Link
          to="/explore/course/$course"
          params={{ course: courseNormToPathParam(row.key) }}
          search={EMPTY_EXPLORE_SEARCH}
          state={{ back: trendsBack } as never}
          style={{ textDecoration: "none" }}
        >
          {label}
        </Link>
      );
    }
    return (
      <Link
        to="/explore/discipline/$discipline"
        params={{ discipline: row.key.toLowerCase() }}
        search={EMPTY_EXPLORE_SEARCH}
        state={{ back: trendsBack } as never}
        style={{ textDecoration: "none" }}
      >
        {label}
      </Link>
    );
  };

  return (
    <Box
      component="main"
      style={{
        position: "relative",
        minHeight: "100vh",
        padding: isMobile ? 16 : 24,
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
                    nothingFoundMessage={tr("trends.filter.noMatch")}
                    style={{ flex: "1 1 240px", minWidth: 0 }}
                  />
                  <Stack gap={4} style={{ flex: isMobile ? "1 1 100%" : undefined }}>
                    <Text size="xs" c="dimmed" fw={600}>
                      {tr("trends.filter.level")}
                    </Text>
                    <SegmentedControl
                      size="xs"
                      {...fullWidthSegmented}
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
                  <Stack gap={4} style={{ flex: isMobile ? "1 1 100%" : undefined }}>
                    <Text size="xs" c="dimmed" fw={600}>
                      {tr("trends.filter.season")}
                    </Text>
                    <SegmentedControl
                      size="xs"
                      {...verticalSegmented}
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
                    {...verticalSegmented}
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
                      {filteredMode
                        ? tr("trends.leaderboard.titleCourses")
                        : tr("trends.leaderboard.title")}
                    </Text>
                    {leaderboardScope ? (
                      programSlugValue ? (
                        <Link
                          to="/explore/program/$"
                          params={{ _splat: programSlugToPathParam(programSlugValue) }}
                          search={EMPTY_EXPLORE_SEARCH}
                          state={{ back: trendsBack } as never}
                          style={{ textDecoration: "none" }}
                        >
                          <Text size="xs" c="var(--app-accent)" span>
                            {leaderboardScope}
                          </Text>
                        </Link>
                      ) : (
                        <Text size="xs" c="dimmed">
                          {leaderboardScope}
                        </Text>
                      )
                    ) : null}
                  </Stack>
                  <SegmentedControl
                    size="xs"
                    {...verticalSegmented}
                    style={isMobile ? { width: "100%" } : undefined}
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
                        <Table.Th>
                          {filteredMode
                            ? tr("trends.leaderboard.col.course")
                            : tr("trends.leaderboard.col.discipline")}
                        </Table.Th>
                        <Table.Th ta="right">{tr("trends.leaderboard.col.currentGpa")}</Table.Th>
                        <Table.Th ta="right">{tr("trends.leaderboard.col.change")}</Table.Th>
                        <Table.Th ta="right">{tr("trends.leaderboard.col.span")}</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {rankedRows.length === 0 ? (
                        <Table.Tr>
                          <Table.Td colSpan={4}>
                            <Text size="sm" c="dimmed">
                              {tr("trends.leaderboard.empty")}
                            </Text>
                          </Table.Td>
                        </Table.Tr>
                      ) : (
                        rankedRows.map((row) => (
                          <Table.Tr key={row.key}>
                            <Table.Td>
                              {renderRowLabel(row)}
                              {row.name ? (
                                <Text size="xs" c="dimmed">
                                  {row.name}
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
                        ))
                      )}
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
