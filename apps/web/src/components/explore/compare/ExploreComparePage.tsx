import { useEffect, useRef } from "react";
import { Box, Stack, Text, Title } from "@mantine/core";
import { useNavigate } from "@tanstack/react-router";
import { compareRefsFromIds, isCompareKind, MIN_COMPARE_ITEMS } from "@uoplan/core";
import type { CompareKind } from "@uoplan/core";
import { tr, useTr } from "../../../i18n";
import { useAnalytics } from "../../../lib/analytics";
import { EMPTY_EXPLORE_SEARCH } from "../../../lib/explore/exploreFilters";
import { useCompareSelection } from "../../../hooks/useCompare";
import { ExplorePageTransition } from "../ExplorePageTransition";
import { CourseCompareView } from "./CourseCompareView";

function CompareEmptyState() {
  return (
    <Stack gap={6} maw={420} mx="auto" mt={48} ta="center">
      <Text fw={600} c="var(--app-text)">
        {tr("compare.empty.title")}
      </Text>
      <Text size="sm" c="dimmed">
        {tr("compare.empty.body")}
      </Text>
    </Stack>
  );
}

/**
 * Generic compare route page. Reads the comparison set from the URL (`ids`,
 * comma-separated, keyed by the `$resource` path param) so it is shareable, and
 * keeps the transient compare tray in sync when entries are removed. Only the
 * `course` resource ships today; other kinds fall back to the empty state.
 */
export function ExploreComparePage({ resource, ids }: { resource: string; ids: string[] }) {
  useTr();
  const analytics = useAnalytics();
  const navigate = useNavigate();
  const { removeFromCompare } = useCompareSelection();
  const lastViewedSignature = useRef<string | null>(null);

  const kind: CompareKind | null = isCompareKind(resource) ? resource : null;
  const refs = kind ? compareRefsFromIds(kind, ids) : [];
  const codes = refs.map((r) => r.id);
  const enough = codes.length >= MIN_COMPARE_ITEMS;
  const codesKey = codes.join(",");

  useEffect(() => {
    if (!kind || !enough) return;
    const signature = `${kind}:${codesKey}`;
    if (lastViewedSignature.current === signature) return;
    lastViewedSignature.current = signature;
    const idList = codesKey.split(",");
    analytics.capture("compare_viewed", { kind, count: idList.length, ids: idList });
  }, [analytics, kind, enough, codesKey]);

  const handleRemove = (code: string) => {
    if (kind) removeFromCompare({ kind, id: code });
    const nextCodes = codes.filter((c) => c !== code);
    void navigate({
      to: "/explore/compare/$resource",
      params: { resource },
      search: {
        ...EMPTY_EXPLORE_SEARCH,
        ids: nextCodes.length > 0 ? nextCodes.join(",") : undefined,
      },
      replace: true,
    });
  };

  return (
    <ExplorePageTransition>
      <Box
        px={{ base: 16, sm: 24 }}
        py={24}
        style={{ maxWidth: 1100, margin: "0 auto", width: "100%" }}
      >
        <Title order={2} c="var(--app-text)" fw={600} fz={{ base: "h3", sm: "h2" }} mb={16}>
          {tr("compare.page.title")}
        </Title>
        {kind === "course" && enough ? (
          <CourseCompareView codes={codes} onRemove={handleRemove} />
        ) : (
          <CompareEmptyState />
        )}
      </Box>
    </ExplorePageTransition>
  );
}
