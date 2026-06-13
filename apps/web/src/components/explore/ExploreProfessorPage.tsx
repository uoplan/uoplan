import { Box, Group, Skeleton, Stack, Text, Title } from "@mantine/core";
import { useMemo } from "react";
import { m } from "framer-motion";
import { useShallow } from "zustand/react/shallow";
import { normalizeProfessorName, pickCanonicalProfessorName } from "@uoplan/core";
import type { CanonicalProfessorName } from "@uoplan/core";
import { tr, useTr } from "../../i18n";
import { useScheduleSentiment } from "../../hooks/useScheduleSentiment";
import { hasActiveFilters } from "../../lib/explore/exploreFilters";
import {
  filterProfessorCourseGroups,
  professorMatchesRatingFilter,
} from "../../lib/explore/detailFilters";
import { professorRouteParam, resolveProfessorRoute } from "../../lib/explore/professorRoute";
import { useAppStore } from "../../store/appStore";
import { useExploreOfferings } from "./exploreOfferingsContext";
import { useExploreDetailFilters } from "./useExploreDetailFilters";
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
  const { offerings: allOfferings, getCourseEntryByNorm } = useExploreOfferings();
  const registry = useAppStore(useShallow((s) => s.professors));
  const professorsLoading = useAppStore((s) => s.professorsLoading);

  const {
    filters,
    sentiment: sentimentSets,
    requirementCandidateSet,
    linkSearch,
  } = useExploreDetailFilters();

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

  const courseEntryByNorm = useMemo(() => {
    const needsCourseIndex =
      filters.levels.length > 0 ||
      filters.languages.length > 0 ||
      filters.disciplines.length > 0 ||
      filters.difficulty !== null ||
      filters.minFeedback !== null ||
      filters.contributesToRequirements;
    return needsCourseIndex ? getCourseEntryByNorm() : new Map();
  }, [filters, getCourseEntryByNorm]);

  const { groups: courseGroups } = useMemo(
    () =>
      filterProfessorCourseGroups(professorOfferings, filters, {
        courseEntryByNorm,
        sentiment: sentimentSets,
        requirementCandidateSet,
      }),
    [professorOfferings, filters, courseEntryByNorm, sentimentSets, requirementCandidateSet],
  );

  const rating = entry?.rating ?? null;
  const numRatings = entry?.numRatings ?? null;
  const hasRating = rating != null && Number.isFinite(rating);

  // Min-rating describes the single professor, so it gates the whole course list.
  const ratingGated = !professorMatchesRatingFilter(hasRating ? rating : null, filters.minRating);
  const displayedCourseGroups = ratingGated ? [] : courseGroups;
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
          {showSatisfaction || showRmp ? (
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
          ) : professorsLoading || feedbackLoading ? (
            <Group gap={6} align="center" mt={8} wrap="wrap" aria-hidden>
              <Skeleton height={18} width={58} radius="sm" />
              <Skeleton height={18} width={58} radius="sm" />
            </Group>
          ) : null}
        </ExploreEntityHeader>

        {displayedCourseGroups.length === 0 ? (
          <Box
            style={{
              paddingLeft: EXPLORE_ACCORDION_PAD_INLINE.xs,
              [EXPLORE_MOBILE_MEDIA_QUERY]: {
                paddingLeft: EXPLORE_ACCORDION_PAD_INLINE.base,
              },
            }}
          >
            <Text c="dimmed" size="sm">
              {hasActiveFilters(filters)
                ? tr("explore.professorNoCoursesForFilters")
                : tr("explore.professorNoCourses")}
            </Text>
          </Box>
        ) : (
          <ExploreFullBleed>
            <ExploreAccordion>
              {displayedCourseGroups.map((g) => (
                <ExploreCourseItem key={g.groupId} group={g} linkSearch={linkSearch} />
              ))}
            </ExploreAccordion>
          </ExploreFullBleed>
        )}
      </Stack>
    </m.div>
  );
}
