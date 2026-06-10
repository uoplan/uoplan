import { Accordion, Box, Flex, Group, Stack, Text, Title } from "@mantine/core";
import { useMemo } from "react";
import { m } from "framer-motion";
import { useShallow } from "zustand/react/shallow";
import { useTr, tr } from "../../i18n";
import { groupOfferingsByCourse } from "../../lib/explore/gradesSearch";
import { resolveProfessorRoute, professorRouteParam } from "../../lib/explore/professorRoute";
import { useAppStore } from "../../store/appStore";
import { useExploreOfferings } from "./exploreOfferingsContext";
import { useProfessorFeedbackViews } from "../../hooks/useFeedbackViews";
import { FeedbackSummaryCard } from "./feedback/FeedbackSummaryCard";
import { ExploreCourseItem } from "./ExploreProfessorGradesLayout";
import {
  EXPLORE_ACCORDION_PAD_INLINE,
  EXPLORE_ACCORDION_PAD_RIGHT,
} from "../../lib/explore/accordionPadding";
import { RateMyProfessorLink } from "./RateMyProfessorLink";

const EXPLORE_CHEVRON_RIGHT = {
  base: "12px",
  xs: "max(12px, calc((100vw - min(100vw, 1200px)) / 2 + 12px))",
};

const mobileMediaQuery = "@media (max-width: 540px)";

export function ExploreProfessorPage({ slug }: { slug: string }) {
  useTr();
  const { offerings: allOfferings } = useExploreOfferings();
  const registry = useAppStore(useShallow((s) => s.professors));

  const resolved = useMemo(() => resolveProfessorRoute(registry, slug), [registry, slug]);
  const { index, entry, legacyId } = resolved;

  const professorOfferings = useMemo(() => {
    if (index != null) return allOfferings.filter((o) => o.professorRef === index);
    if (legacyId != null) return allOfferings.filter((o) => o.legacyId === legacyId);
    const nameLower = resolved.displayName.toLowerCase();
    return allOfferings.filter((o) => o.professorName.toLowerCase() === nameLower);
  }, [allOfferings, index, legacyId, resolved.displayName]);

  const displayName =
    entry?.name ??
    professorOfferings[0]?.professorName ??
    resolved.displayName ??
    tr("explore.professorFallback");

  const courseGroups = useMemo(
    () => groupOfferingsByCourse(professorOfferings),
    [professorOfferings],
  );

  const rating = entry?.rating ?? null;
  const numRatings = entry?.numRatings ?? null;
  const hasRating = rating != null && Number.isFinite(rating);
  const rmpLegacyId = legacyId;
  const hasRmpLink = rmpLegacyId != null && Number.isFinite(rmpLegacyId) && rmpLegacyId > 0;

  const profRouteParam = entry
    ? professorRouteParam({ slug: entry.slug, legacyId: legacyId ?? undefined, displayName })
    : professorRouteParam({ legacyId: legacyId ?? undefined, displayName });

  const feedbackArg = useMemo(
    () =>
      index != null
        ? { professorRef: index }
        : legacyId != null
          ? { legacyId }
          : { professorName: displayName },
    [index, legacyId, displayName],
  );
  const { views: feedbackViews, loading: feedbackLoading } = useProfessorFeedbackViews(feedbackArg);
  const showFeedback = feedbackLoading || feedbackViews.length > 0;

  return (
    <m.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      <Stack gap={0}>
        <Box
          pt={{ base: 4, md: 0 }}
          pb="md"
          style={{
            paddingLeft: EXPLORE_ACCORDION_PAD_INLINE.xs,
            paddingRight: EXPLORE_ACCORDION_PAD_INLINE.xs,
          }}
        >
          <Flex
            direction={{ base: "column", md: "row" }}
            gap="lg"
            align={{ base: "stretch", md: "center" }}
          >
            <Box style={{ flex: 1, minWidth: 0 }}>
              <Title order={2} c="var(--app-text)" fw={600} fz={{ base: "h3", sm: "h2" }}>
                {displayName}
              </Title>
              {(hasRating || hasRmpLink) && (
                <Group gap={6} align="center" mt={8} wrap="wrap">
                  {hasRating ? (
                    <Text size="sm" c="dimmed">
                      {rating?.toFixed(1)} · {numRatings} ratings
                    </Text>
                  ) : (
                    <Text size="sm" c="dimmed">
                      {tr("search.noRating")}
                    </Text>
                  )}
                  {hasRmpLink && rmpLegacyId != null ? (
                    <RateMyProfessorLink legacyId={rmpLegacyId} />
                  ) : null}
                </Group>
              )}
            </Box>
            {showFeedback ? (
              <Box style={{ width: "100%", maxWidth: 420 }}>
                <FeedbackSummaryCard
                  to="/explore/professor/$slug/feedback"
                  params={{ slug: profRouteParam }}
                  views={feedbackViews}
                  loading={feedbackLoading}
                />
              </Box>
            ) : null}
          </Flex>
        </Box>

        {courseGroups.length === 0 ? (
          <Box
            style={{
              paddingLeft: EXPLORE_ACCORDION_PAD_INLINE.xs,
              [mobileMediaQuery]: {
                paddingLeft: EXPLORE_ACCORDION_PAD_INLINE.base,
              },
            }}
          >
            <Text c="dimmed" size="sm">
              {tr("explore.professorNoCourses")}
            </Text>
          </Box>
        ) : (
          <Box
            style={{
              width: "100vw",
              maxWidth: "100vw",
              marginInline: "calc(50% - 50vw)",
            }}
          >
            <Accordion
              multiple
              radius="var(--app-radius)"
              chevronPosition="right"
              variant="default"
              styles={{
                root: {
                  backgroundColor: "var(--app-bg)",
                  borderTop: "var(--app-border-width) solid var(--app-border)",
                },
                item: {
                  borderBottom: "var(--app-border-width) solid var(--app-border)",
                  backgroundColor: "var(--app-surface-sunken)",
                  "&:last-of-type": { borderBottom: "none" },
                },
                control: {
                  position: "relative",
                  paddingTop: "var(--mantine-spacing-lg)",
                  paddingBottom: "var(--mantine-spacing-lg)",
                  paddingLeft: EXPLORE_ACCORDION_PAD_INLINE.xs,
                  paddingRight: EXPLORE_ACCORDION_PAD_RIGHT.xs,
                  borderRadius: "var(--app-radius-sm)",
                  backgroundColor: "var(--app-surface-sunken)",
                  "@media (max-width: 540px)": {
                    paddingLeft: EXPLORE_ACCORDION_PAD_INLINE.base,
                    paddingRight: EXPLORE_ACCORDION_PAD_RIGHT.base,
                  },
                  "&:hover": { backgroundColor: "var(--app-translucent)" },
                },
                label: { flex: 1, minWidth: 0, paddingRight: 0 },
                panel: { padding: 0, backgroundColor: "var(--app-bg)" },
                content: { padding: 0 },
                chevron: {
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  right: EXPLORE_CHEVRON_RIGHT.xs,
                  display: "flex",
                  alignItems: "center",
                  marginLeft: 0,
                  color: "var(--app-text-muted)",
                  "@media (max-width: 540px)": {
                    right: EXPLORE_CHEVRON_RIGHT.base,
                  },
                },
              }}
            >
              {courseGroups.map((g) => (
                <ExploreCourseItem
                  key={g.groupId}
                  group={g}
                  currentEntry={{
                    to: "/explore/professor/$slug",
                    params: { slug: profRouteParam },
                    label: displayName,
                  }}
                />
              ))}
            </Accordion>
          </Box>
        )}
      </Stack>
    </m.div>
  );
}
