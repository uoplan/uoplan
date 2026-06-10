import { Link } from "@tanstack/react-router";
import { Box, Stack, Text } from "@mantine/core";
import { useLingui } from "@lingui/react";
import type { Discipline, GradeVizData } from "@uoplan/core";
import { tr } from "../../i18n";
import type { ExploreSearchParams } from "../../lib/explore/exploreFilters";
import { GradeDistributionBottomBar } from "../calendar/GradeDistributionViz";
import { RatingBadge } from "../shared/RatingBadge";

type Props = {
  discipline: Discipline;
  courseCount: number;
  gradeViz?: GradeVizData | null;
  sentiment?: number | null;
  query?: string;
  searchParams: ExploreSearchParams;
};

export function SearchResultDisciplineCard({
  discipline,
  courseCount,
  gradeViz,
  sentiment,
  query,
  searchParams,
}: Props) {
  const { i18n } = useLingui();
  const isFr = i18n.locale.startsWith("fr");
  const displayName = isFr ? (discipline.nameFr ?? discipline.name) : discipline.name;
  const q = query?.trim() ?? "";

  return (
    <Link
      to="/explore/discipline/$discipline"
      params={{ discipline: discipline.code.toLowerCase() }}
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
          {discipline.code}
        </Text>
        <Text
          size="xs"
          c="dimmed"
          lh={1.4}
          style={{
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {displayName}
        </Text>
        <Box style={{ flex: 1 }} />
        {sentiment != null && sentiment > 0 ? (
          <RatingBadge kind="satisfaction" value={sentiment} />
        ) : null}
        <Text size="xs" c="dimmed" lh={1.3}>
          {tr("explore.disciplineCourseCount", { count: courseCount })}
        </Text>
      </Stack>
      <GradeDistributionBottomBar gradeViz={gradeViz} />
    </Link>
  );
}
