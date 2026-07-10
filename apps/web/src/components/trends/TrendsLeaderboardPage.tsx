import { AppCard } from "../shared/AppCard";
import { Group, SegmentedControl, Stack, Table, Text } from "@mantine/core";
import { Link } from "@tanstack/react-router";
import {
  computeCourseLeaderboard,
  computeDisciplineLeaderboard,
  normalizeCourseCode,
} from "@uoplan/core";
import { useMemo } from "react";
import { formatLocaleNumber, tr, useTr } from "../../i18n";
import { useCatalogue } from "@uoplan/store/hooks";
import { courseNormToPathParam } from "../../lib/explore/courseSearchParams";
import { programSlugToPathParam } from "../../lib/explore/programSearch";
import { EMPTY_EXPLORE_SEARCH } from "../../lib/explore/exploreFilters";
import type { TrendsSort } from "../../lib/trends/searchParams";
import { useTrends } from "./trendsContext";

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

/**
 * Ranked "grade inflation" board: biggest risers, easiest, or hardest. Scopes to
 * per-course rows when a program / discipline filter is active, otherwise ranks
 * disciplines university-wide.
 */
export function TrendsLeaderboardPage() {
  useTr();
  const {
    isMobile,
    grades,
    discipline,
    level,
    season,
    programFilter,
    programSlugValue,
    filteredMode,
    disciplineNameByCode,
    programOptions,
    formatMetric,
    update,
    search,
  } = useTrends();

  const catalogue = useCatalogue();

  const verticalSegmented = isMobile ? ({ fullWidth: true, orientation: "vertical" } as const) : {};

  const courseTitleByCode = useMemo(() => {
    const map = new Map<string, string>();
    for (const course of catalogue?.courses ?? []) {
      map.set(course.code, course.title);
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

  const leaderboardSort = (search.sort ?? "rise") as TrendsSort;

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
          params={{ course: courseNormToPathParam(normalizeCourseCode(row.key)) }}
          search={EMPTY_EXPLORE_SEARCH}
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
        style={{ textDecoration: "none" }}
      >
        {label}
      </Link>
    );
  };

  return (
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
            onChange={(value) => update({ sort: value as TrendsSort })}
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
                          {`${row.gpaDelta >= 0 ? "+" : ""}${formatLocaleNumber(row.gpaDelta, {
                            minimumFractionDigits: 1,
                            maximumFractionDigits: 1,
                          })}`}
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td ta="right">
                      <Text size="xs" c="dimmed">
                        {row.firstYear && row.lastYear ? `${row.firstYear}–${row.lastYear}` : "—"}
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
  );
}
