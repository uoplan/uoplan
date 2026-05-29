import { Link } from "@tanstack/react-router";
import { Box, Stack, Text } from "@mantine/core";
import { useLingui } from "@lingui/react";
import type { GradeVizData, ProfessorRatingsMap } from "@uoplan/core";
import { normalizeProfessorName } from "@uoplan/core";
import { tr } from "../../i18n";
import { GradeDistributionBottomBar } from "../calendar/GradeDistributionViz";
import type { ExploreProfessorSearchEntry } from "../../lib/explore/gradesSearch";
import type { ExploreSearchParams } from "../../lib/explore/exploreFilters";
import { useExploreHistory } from "./ExploreHistoryContext";

const LETTER_GRADES = new Set(["F", "E", "D", "D+", "C", "C+", "B", "B+", "A-", "A", "A+"]);

function mostCommonGrade(gradeViz: GradeVizData): string | null {
  return (
    gradeViz.histogram
      .filter((h) => LETTER_GRADES.has(h.grade) && h.count > 0)
      .reduce<{
        grade: string;
        count: number;
      } | null>((best, h) => (best === null || h.count > best.count ? h : best), null)?.grade ??
    null
  );
}

function professorLegacyParam(entry: ExploreProfessorSearchEntry): string {
  return entry.legacyId != null ? String(entry.legacyId) : encodeURIComponent(entry.displayName);
}

export function SearchResultProfessorCard({
  entry,
  professorRatings,
  query,
  searchParams,
}: {
  entry: ExploreProfessorSearchEntry;
  professorRatings: ProfessorRatingsMap | null;
  query?: string;
  searchParams: ExploreSearchParams;
}) {
  useLingui();
  const { push } = useExploreHistory();
  const { gradeViz } = entry;
  const grade = gradeViz ? mostCommonGrade(gradeViz) : null;
  const passing = gradeViz ? Math.round(gradeViz.passingPercent) : null;

  const rmpEntry = professorRatings
    ? professorRatings[normalizeProfessorName(entry.displayName)]
    : null;
  const hasRating = rmpEntry != null && Number.isFinite(rmpEntry.rating);

  const q = query?.trim() ?? "";

  return (
    <Link
      to="/explore/professor/$legacyId"
      params={{ legacyId: professorLegacyParam(entry) }}
      search={searchParams}
      onClick={() => {
        push({
          to: "/explore",
          search: searchParams,
          label: q ? tr("explore.backToSearch", { q }) : tr("explore.title"),
        });
      }}
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
        <Text size="sm" fw={700} c="#F8F9FA" lh={1.3} style={{ wordBreak: "break-word" }}>
          {entry.displayName}
        </Text>
        {hasRating ? (
          <Text size="xs" c="gray.4" lh={1.3}>
            ★ {rmpEntry?.rating.toFixed(1)} · {rmpEntry?.numRatings} ratings
          </Text>
        ) : (
          <Text size="xs" c="dimmed" lh={1.3}>
            {tr("search.noRating")}
          </Text>
        )}
        <Text size="xs" c="dimmed" lh={1.3}>
          {tr("explore.professorCourseCount", {
            count: entry.uniqueCourseCount,
          })}
        </Text>
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
        ) : null}
      </Stack>
      <GradeDistributionBottomBar gradeViz={gradeViz} />
    </Link>
  );
}
