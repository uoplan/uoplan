import { Link } from "@tanstack/react-router";
import { Stack, Text } from "@mantine/core";
import { tr } from "../../i18n";
import { EMPTY_EXPLORE_SEARCH } from "../../lib/explore/exploreFilters";
import {
  programSlugToPathParam,
  type ExploreProgramSearchEntry,
} from "../../lib/explore/programSearch";

type Props = {
  program: ExploreProgramSearchEntry;
  query?: string;
};

export function SearchResultProgramCard({ program, query }: Props) {
  const q = query?.trim() ?? "";

  return (
    <Link
      to="/explore/program/$"
      params={{ _splat: programSlugToPathParam(program.slug) }}
      search={EMPTY_EXPLORE_SEARCH}
      state={
        {
          back: {
            to: "/explore",
            search: EMPTY_EXPLORE_SEARCH,
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
        <Text
          size="sm"
          fw={700}
          c="var(--app-text)"
          lh={1.3}
          style={{
            display: "-webkit-box",
            WebkitLineClamp: 4,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {program.title}
        </Text>
        {program.courseCount > 0 ? (
          <Text size="xs" c="dimmed" lh={1.3} mt="auto">
            {tr("explore.program.courseCount", { count: program.courseCount })}
          </Text>
        ) : null}
      </Stack>
    </Link>
  );
}
