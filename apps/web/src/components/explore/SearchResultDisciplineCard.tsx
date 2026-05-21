import { Link } from "@tanstack/react-router";
import { Stack, Text } from "@mantine/core";
import { useLingui } from "@lingui/react";
import type { Discipline } from "@uoplan/schedule";
import { tr } from "../../i18n";
import type { ExploreSearchParams } from "../../lib/explore/exploreFilters";

type Props = {
  discipline: Discipline;
  courseCount: number;
  searchParams: ExploreSearchParams;
};

export function SearchResultDisciplineCard({ discipline, courseCount, searchParams }: Props) {
  const { i18n } = useLingui();
  const isFr = i18n.locale.startsWith("fr");
  const displayName = isFr ? (discipline.nameFr ?? discipline.name) : discipline.name;

  return (
    <Link
      to="/explore/discipline/$discipline"
      params={{ discipline: discipline.code.toLowerCase() }}
      search={searchParams}
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
        <Text size="xs" c="dimmed" lh={1.3} mt="auto">
          {tr("explore.disciplineCourseCount", { count: courseCount })}
        </Text>
      </Stack>
    </Link>
  );
}
