import { Box, Group, Stack, Text, Title } from "@mantine/core";
import { useMemo } from "react";
import { m } from "framer-motion";
import { useShallow } from "zustand/react/shallow";
import { normalizeProfessorName, pickCanonicalProfessorName } from "@uoplan/core";
import type { CanonicalProfessorName } from "@uoplan/core";
import { tr, useTr } from "../../i18n";
import { useScheduleSentiment } from "../../hooks/useScheduleSentiment";
import { groupOfferingsByCourse } from "../../lib/explore/gradesSearch";
import { professorRouteParam, resolveProfessorRoute } from "../../lib/explore/professorRoute";
import { useAppStore } from "../../store/appStore";
import { useExploreOfferings } from "./exploreOfferingsContext";
import { useProfessorFeedbackViews } from "../../hooks/useFeedbackViews";
import { FeedbackSummaryCard } from "./feedback/FeedbackSummaryCard";
import { ExploreCourseItem } from "./ExploreProfessorGradesLayout";
import { EXPLORE_ACCORDION_PAD_INLINE } from "../../lib/explore/accordionPadding";
import { RatingBadge } from "../shared/RatingBadge";
import {
  EXPLORE_MOBILE_MEDIA_QUERY,
  ExploreAccordion,
  ExploreEntityHeader,
  ExploreFeedbackAside,
  ExploreFullBleed,
} from "./ExploreEntityLayout";

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

  const displayName: CanonicalProfessorName =
    entry?.name ??
    professorOfferings[0]?.professorName ??
    resolved.displayName ??
    pickCanonicalProfessorName([tr("explore.professorFallback")]);

  const courseGroups = useMemo(
    () => groupOfferingsByCourse(professorOfferings),
    [professorOfferings],
  );

  const rating = entry?.rating ?? null;
  const numRatings = entry?.numRatings ?? null;
  const hasRating = rating != null && Number.isFinite(rating);
  const rmpLegacyId = legacyId;
  const hasRmpLink = rmpLegacyId != null && Number.isFinite(rmpLegacyId) && rmpLegacyId > 0;
  const showRmp = hasRating || hasRmpLink;

  const { professorByName } = useScheduleSentiment();
  const sentiment = professorByName?.get(normalizeProfessorName(displayName)) ?? null;
  const showSatisfaction = sentiment != null && sentiment > 0;

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
        <ExploreEntityHeader
          aside={
            showFeedback ? (
              <ExploreFeedbackAside>
                <FeedbackSummaryCard
                  to="/explore/professor/$slug/feedback"
                  params={{ slug: profRouteParam }}
                  views={feedbackViews}
                  loading={feedbackLoading}
                />
              </ExploreFeedbackAside>
            ) : null
          }
        >
          <Title order={2} c="var(--app-text)" fw={600} fz={{ base: "h3", sm: "h2" }}>
            {displayName}
          </Title>
          {(showSatisfaction || showRmp) && (
            <Group gap={6} align="center" mt={8} wrap="wrap">
              {showSatisfaction ? <RatingBadge kind="satisfaction" value={sentiment} /> : null}
              {showSatisfaction && showRmp ? (
                <Text component="span" size="xs" c="dimmed">
                  ·
                </Text>
              ) : null}
              {showRmp ? (
                <RatingBadge
                  kind="rmp"
                  value={hasRating ? rating : null}
                  count={hasRating ? numRatings : null}
                  legacyId={rmpLegacyId}
                />
              ) : null}
            </Group>
          )}
        </ExploreEntityHeader>

        {courseGroups.length === 0 ? (
          <Box
            style={{
              paddingLeft: EXPLORE_ACCORDION_PAD_INLINE.xs,
              [EXPLORE_MOBILE_MEDIA_QUERY]: {
                paddingLeft: EXPLORE_ACCORDION_PAD_INLINE.base,
              },
            }}
          >
            <Text c="dimmed" size="sm">
              {tr("explore.professorNoCourses")}
            </Text>
          </Box>
        ) : (
          <ExploreFullBleed>
            <ExploreAccordion>
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
            </ExploreAccordion>
          </ExploreFullBleed>
        )}
      </Stack>
    </m.div>
  );
}
