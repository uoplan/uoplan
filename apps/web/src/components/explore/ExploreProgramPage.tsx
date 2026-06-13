import { Box, Group, Stack, Text, Title } from "@mantine/core";
import { useNavigate } from "@tanstack/react-router";
import { m } from "framer-motion";
import { useEffect, useMemo } from "react";
import type { Catalogue, Program } from "@uoplan/core";
import { buildProgramCourseFilter, normalizeCourseCode, programSlug } from "@uoplan/core";
import { tr, useTr } from "../../i18n";
import { EMPTY_EXPLORE_SEARCH } from "../../lib/explore/exploreFilters";
import {
  groupOfferingsByCourse,
  mergeGradeDistributionCounts,
} from "../../lib/explore/gradesSearch";
import type { CourseOfferingGroup } from "../../lib/explore/gradesSearch";
import { GradeDistributionHistogramPlaceholder } from "../calendar/GradeDistributionViz";
import { CatalogueLink } from "./CatalogueLink";
import { useExploreOfferings } from "./exploreOfferingsContext";
import { ExploreCourseItem } from "./ExploreProfessorGradesLayout";
import {
  EXPLORE_ACCORDION_PAD_INLINE,
  EXPLORE_ACCORDION_PAD_RIGHT,
} from "../../lib/explore/accordionPadding";
import {
  EXPLORE_MOBILE_MEDIA_QUERY,
  ExploreAccordion,
  ExploreFullBleed,
} from "./ExploreEntityLayout";
const EXPLORE_HISTOGRAM_WIDTH_PX = 288;

/** True when a course group carries any counted grade data (vs schedule-only). */
function hasGradeData(group: CourseOfferingGroup): boolean {
  const merged = mergeGradeDistributionCounts(group.offerings.map((o) => o.distribution));
  for (const value of Object.values(merged)) {
    if (Number(value) > 0) return true;
  }
  return false;
}

/** Grayed-out placeholder chart shown for a core course with no grade data. */
function GrayedCourseRow({ code, title }: { code: string; title: string | null }) {
  return (
    <Box
      style={{
        display: "flex",
        flexDirection: "row",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "var(--mantine-spacing-md)",
        opacity: 0.55,
        paddingTop: "var(--mantine-spacing-lg)",
        paddingBottom: "var(--mantine-spacing-lg)",
        paddingLeft: EXPLORE_ACCORDION_PAD_INLINE.xs,
        paddingRight: EXPLORE_ACCORDION_PAD_RIGHT.xs,
        borderBottom: "var(--app-border-width) solid var(--app-border)",
        [EXPLORE_MOBILE_MEDIA_QUERY]: {
          flexDirection: "column",
          alignItems: "stretch",
          paddingLeft: EXPLORE_ACCORDION_PAD_INLINE.base,
          paddingRight: EXPLORE_ACCORDION_PAD_RIGHT.base,
        },
      }}
    >
      <Stack gap={4} style={{ minWidth: 0, flex: "1 1 auto" }}>
        <Text size="sm" fw={600} c="var(--app-text)">
          {code}
        </Text>
        {title ? (
          <Text size="xs" c="dimmed" lineClamp={2}>
            {title}
          </Text>
        ) : null}
        <Text size="xs" c="dimmed">
          {tr("explore.program.noGradeData")}
        </Text>
      </Stack>
      <Box
        style={{
          flex: "0 0 auto",
          width: EXPLORE_HISTOGRAM_WIDTH_PX,
          maxWidth: EXPLORE_HISTOGRAM_WIDTH_PX,
          marginLeft: "auto",
          [EXPLORE_MOBILE_MEDIA_QUERY]: { width: "100%", maxWidth: "100%", marginLeft: 0 },
        }}
      >
        <GradeDistributionHistogramPlaceholder />
      </Box>
    </Box>
  );
}

export function ExploreProgramPage({
  programSlug: slug,
  catalogue,
}: {
  programSlug: string;
  catalogue: Catalogue | null;
}) {
  useTr();
  const navigate = useNavigate();
  const { offerings } = useExploreOfferings();

  const program = useMemo<Program | null>(() => {
    if (!catalogue) return null;
    return catalogue.programs.find((p) => programSlug(p) === slug) ?? null;
  }, [catalogue, slug]);

  // Redirect to the explore index when the slug doesn't resolve once data loads.
  useEffect(() => {
    if (catalogue === null) return; // still loading
    if (program === null) {
      void navigate({ to: "/explore", search: EMPTY_EXPLORE_SEARCH, replace: true });
    }
  }, [catalogue, program, navigate]);

  const courseTitleByCode = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of catalogue?.courses ?? []) map.set(normalizeCourseCode(c.code), c.title);
    return map;
  }, [catalogue]);

  const coreCodes = useMemo(() => {
    if (!program) return [] as string[];
    return [...buildProgramCourseFilter(program).codes].sort((a, b) => a.localeCompare(b, "en"));
  }, [program]);

  const coreCodeSet = useMemo(() => new Set(coreCodes), [coreCodes]);

  // Core-course offerings grouped by course, split into those with grade data
  // (rich histogram accordion) and those without (grayed-out placeholder).
  const { dataGroups, noDataCodes } = useMemo(() => {
    const coreOfferings = offerings.filter((o) =>
      coreCodeSet.has(normalizeCourseCode(o.courseCode)),
    );
    const groups = groupOfferingsByCourse(coreOfferings);
    const withData: CourseOfferingGroup[] = [];
    const codesWithData = new Set<string>();
    for (const group of groups) {
      if (hasGradeData(group)) {
        withData.push(group);
        codesWithData.add(group.groupId);
      }
    }
    const without = coreCodes.filter((code) => !codesWithData.has(code));
    return { dataGroups: withData, noDataCodes: without };
  }, [offerings, coreCodeSet, coreCodes]);

  if (!program) return null;

  return (
    <m.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      <Stack gap={0}>
        <Box
          pt={4}
          pb={28}
          style={{
            paddingLeft: EXPLORE_ACCORDION_PAD_INLINE.xs,
            paddingRight: EXPLORE_ACCORDION_PAD_INLINE.xs,
          }}
        >
          <Group gap={8} align="center" wrap="nowrap">
            <Title order={2} c="var(--app-text)" fw={600} fz={{ base: "h3", sm: "h2" }}>
              {program.title}
            </Title>
            {program.url ? (
              <CatalogueLink href={program.url} label={tr("explore.program.officialPage")} />
            ) : null}
          </Group>
          <Text size="xs" fw={600} c="dimmed" mt={20} style={{ letterSpacing: "0.02em" }}>
            {tr("explore.program.requiredCourses")}
          </Text>
        </Box>

        {coreCodes.length === 0 ? (
          <Box style={{ paddingLeft: EXPLORE_ACCORDION_PAD_INLINE.xs }}>
            <Text size="sm" c="dimmed">
              {tr("explore.program.noCourses")}
            </Text>
          </Box>
        ) : (
          <ExploreFullBleed>
            {dataGroups.length > 0 ? (
              <ExploreAccordion>
                {dataGroups.map((g) => (
                  <ExploreCourseItem key={g.groupId} group={g} />
                ))}
              </ExploreAccordion>
            ) : null}

            {noDataCodes.length > 0 ? (
              <Box
                style={{
                  borderTop:
                    dataGroups.length > 0
                      ? undefined
                      : "var(--app-border-width) solid var(--app-border)",
                }}
              >
                {noDataCodes.map((code) => (
                  <GrayedCourseRow
                    key={code}
                    code={code}
                    title={courseTitleByCode.get(code) ?? null}
                  />
                ))}
              </Box>
            ) : null}
          </ExploreFullBleed>
        )}
      </Stack>
    </m.div>
  );
}
