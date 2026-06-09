import { Link } from "@tanstack/react-router";
import { Box, Stack, Text } from "@mantine/core";
import type { GradeVizData } from "@uoplan/core";
import { useTr, tr } from "../../i18n";
import { GradeDistributionBottomBar } from "../calendar/GradeDistributionViz";
import type { ExploreCourseSearchEntry } from "../../lib/explore/gradesSearch";
import { courseNormToPathParam } from "../../lib/explore/courseSearchParams";
import type { ExploreSearchParams } from "../../lib/explore/exploreFilters";

const LETTER_GRADES = new Set(["F", "E", "D", "D+", "C", "C+", "B", "B+", "A-", "A", "A+"]);

function mostCommonGrade(gradeViz: GradeVizData): string | null {
  return (
    gradeViz.histogram
      .filter((h) => LETTER_GRADES.has(h.grade) && h.count > 0)
      .reduce<{ grade: string; count: number } | null>(
        (best, h) => (best === null || h.count > best.count ? h : best),
        null,
      )?.grade ?? null
  );
}

export function SearchResultCourseCard({
  entry,
  sentiment,
  query,
  searchParams,
}: {
  entry: ExploreCourseSearchEntry;
  sentiment?: number | null;
  query?: string;
  searchParams: ExploreSearchParams;
}) {
  useTr();
  const { gradeViz } = entry;
  const grade = gradeViz ? mostCommonGrade(gradeViz) : null;
  const passing = gradeViz ? Math.round(gradeViz.passingPercent) : null;

  const q = query?.trim() ?? "";

  return (
    <Link
      to="/explore/course/$course"
      params={{ course: courseNormToPathParam(entry.normCode) }}
      search={searchParams}
      state={
        {
          back: {
            to: "/explore",
            search: searchParams,
            label: q ? tr("explore.backToSearch", { q }) : tr("explore.title"),
          },
        } as never
      }
      className="soft-lift"
      style={{
        width: 190,
        minWidth: 190,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        minHeight: 155,
        backgroundColor: "var(--app-surface-sunken)",
        border: "var(--app-border-width) solid var(--app-border)",
        borderRadius: "var(--app-radius)",
        overflow: "hidden",
        textDecoration: "none",
        color: "inherit",
        transition:
          "background-color var(--app-transition), border-color var(--app-transition), transform var(--app-transition), box-shadow var(--app-transition)",
      }}
    >
      <Stack gap={5} p={12} style={{ flex: 1 }}>
        <Text size="sm" fw={700} c="var(--app-text)" lh={1.3}>
          {entry.courseCode}
        </Text>
        {entry.courseTitle ? (
          <Text
            size="xs"
            c="dimmed"
            lh={1.4}
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {entry.courseTitle}
          </Text>
        ) : null}
        <Box style={{ flex: 1 }} />
        {sentiment != null && sentiment > 0 ? (
          <Text size="xs" c="var(--app-text-muted)" lh={1.3}>
            <Text component="span" fw={700} c="var(--app-text)">
              {sentiment.toFixed(1)}
            </Text>{" "}
            {tr("search.satisfactionSuffix")}
          </Text>
        ) : null}
        {gradeViz ? (
          <Text size="xs" c="var(--app-text-muted)" lh={1.3}>
            {grade ? (
              <>
                <Text component="span" fw={600} c="var(--app-text)">
                  {grade}
                </Text>{" "}
                ·{" "}
              </>
            ) : null}
            {passing !== null ? tr("search.passingPercent", { percent: passing }) : null}
          </Text>
        ) : (
          <Text size="xs" c="dimmed" lh={1.3}>
            {tr("search.noGradeData")}
          </Text>
        )}
      </Stack>
      <GradeDistributionBottomBar gradeViz={gradeViz} />
    </Link>
  );
}
