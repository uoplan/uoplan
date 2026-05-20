import { Link } from "@tanstack/react-router";
import { Box, Stack, Text } from "@mantine/core";
import { useLingui } from "@lingui/react";
import type { GradeVizData } from "@uoplan/schedule";
import { tr } from "../../i18n";
import { GradeDistributionBottomBar } from "../calendar/GradeDistributionViz";
import type { ExploreCourseSearchEntry } from "../../lib/explore/gradesSearch";
import { courseNormToPathParam } from "../../lib/explore/courseSearchParams";

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

export function SearchResultCourseCard({ entry }: { entry: ExploreCourseSearchEntry }) {
  useLingui();
  const { gradeViz } = entry;
  const grade = gradeViz ? mostCommonGrade(gradeViz) : null;
  const passing = gradeViz ? Math.round(gradeViz.passingPercent) : null;

  return (
    <Link
      to="/explore/course/$course"
      params={{ course: courseNormToPathParam(entry.normCode) }}
      search={{ q: undefined }}
      style={{
        width: 190,
        minWidth: 190,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        minHeight: 155,
        backgroundColor: "#18191c",
        border: "1px solid #2c2e33",
        borderRadius: 0,
        overflow: "hidden",
        textDecoration: "none",
        color: "inherit",
        transition: "background-color 120ms ease, border-color 120ms ease",
      }}
    >
      <Stack gap={5} p={12} style={{ flex: 1 }}>
        <Text size="sm" fw={700} c="#F8F9FA" lh={1.3}>
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
        {gradeViz ? (
          <Text size="xs" c="gray.4" lh={1.3}>
            {grade ? (
              <>
                <Text component="span" fw={600} c="#F8F9FA">
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
