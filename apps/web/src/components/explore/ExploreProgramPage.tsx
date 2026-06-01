import { Accordion, Anchor, Box, Stack, Text, Title } from "@mantine/core";
import { IconExternalLink } from "@tabler/icons-react";
import { useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useMemo } from "react";
import type { Catalogue, Program } from "@uoplan/core";
import { buildProgramCourseFilter, normalizeCourseCode, programSlug } from "@uoplan/core";
import { useTr, tr } from "../../i18n";
import { EMPTY_EXPLORE_SEARCH } from "../../lib/explore/exploreFilters";
import {
  groupOfferingsByCourse,
  mergeGradeDistributionCounts,
  type CourseOfferingGroup,
} from "../../lib/explore/gradesSearch";
import { programSlugToPathParam } from "../../lib/explore/programSearch";
import type { BackState } from "../../lib/navigation/backState";
import { GradeDistributionHistogramPlaceholder } from "../calendar/GradeDistributionViz";
import { useExploreOfferings } from "./ExploreOfferingsContext";
import {
  EXPLORE_ACCORDION_PAD_INLINE,
  EXPLORE_ACCORDION_PAD_RIGHT,
  ExploreCourseItem,
} from "./ExploreProfessorGradesLayout";

const EXPLORE_CHEVRON_RIGHT = {
  base: "12px",
  xs: "max(12px, calc((100vw - min(100vw, 1200px)) / 2 + 12px))",
};

const mobileMediaQuery = "@media (max-width: 540px)";
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
        [mobileMediaQuery]: {
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
          [mobileMediaQuery]: { width: "100%", maxWidth: "100%", marginLeft: 0 },
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

  const backEntry = useMemo<BackState>(
    () => ({
      to: "/explore/program/$",
      params: { _splat: programSlugToPathParam(slug) },
      label: program?.title ?? tr("explore.program.title"),
    }),
    [slug, program?.title],
  );

  if (!program) return null;

  return (
    <motion.div
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
          <Title order={2} c="var(--app-text)" fw={600} fz={{ base: "h3", sm: "h2" }}>
            {program.title}
          </Title>
          {program.url ? (
            <Anchor
              href={program.url}
              target="_blank"
              rel="noopener noreferrer"
              size="sm"
              mt={8}
              c="var(--app-accent)"
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              {tr("explore.program.officialPage")}
              <IconExternalLink size={14} />
            </Anchor>
          ) : null}
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
          <Box
            style={{
              width: "100vw",
              maxWidth: "100vw",
              marginInline: "calc(50% - 50vw)",
            }}
          >
            {dataGroups.length > 0 ? (
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
                {dataGroups.map((g) => (
                  <ExploreCourseItem key={g.groupId} group={g} currentEntry={backEntry} />
                ))}
              </Accordion>
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
          </Box>
        )}
      </Stack>
    </motion.div>
  );
}
