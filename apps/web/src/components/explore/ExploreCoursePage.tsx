import { Accordion, Box, Stack, Text, Title } from "@mantine/core";
import { useLingui } from "@lingui/react";
import { useEffect, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import type { Catalogue, ProfessorRatingsMap } from "@uoplan/core";
import { normalizeCourseCode } from "@uoplan/core";
import { tr } from "../../i18n";
import {
  buildCourseSearchEntries,
  type ProfessorOfferingGroup,
  groupOfferingsByProfessor,
} from "../../lib/explore/gradesSearch";
import { useExploreOfferings } from "./ExploreOfferingsContext";
import { EMPTY_EXPLORE_SEARCH } from "../../lib/explore/exploreFilters";
import { parseCoursePathParam } from "../../lib/explore/courseSearchParams";
import {
  EXPLORE_ACCORDION_PAD_INLINE,
  EXPLORE_ACCORDION_PAD_RIGHT,
  ExploreProfessorOfferingRows,
  ExploreProfessorSummaryBar,
} from "./ExploreProfessorGradesLayout";

const EXPLORE_CHEVRON_RIGHT = {
  base: `calc(12px)`,
  xs: "max(12px, calc((100vw - min(100vw, 1200px)) / 2 + 12px))",
};

function buildTitleByCode(catalogue: Catalogue | null): Map<string, string> {
  const m = new Map<string, string>();
  if (!catalogue) return m;
  for (const c of catalogue.courses) m.set(normalizeCourseCode(c.code), c.title);
  return m;
}

function CourseProfessorItem({
  group,
  professorRatings,
}: {
  group: ProfessorOfferingGroup;
  professorRatings: ProfessorRatingsMap | null;
}) {
  return (
    <Accordion.Item value={group.groupId}>
      <Accordion.Control>
        <ExploreProfessorSummaryBar
          group={group}
          professorRatings={professorRatings}
          stopPropagation
        />
      </Accordion.Control>
      <Accordion.Panel>
        <ExploreProfessorOfferingRows offerings={group.offerings} />
      </Accordion.Panel>
    </Accordion.Item>
  );
}

export function ExploreCoursePage({
  urlCourseParam,
  catalogue,
  professorRatings,
}: {
  urlCourseParam: string;
  catalogue: Catalogue | null;
  professorRatings: ProfessorRatingsMap | null;
}) {
  useLingui();
  const { loading, offerings } = useExploreOfferings();
  const navigate = useNavigate();

  const titleByCode = useMemo(() => buildTitleByCode(catalogue), [catalogue]);

  const courseEntries = useMemo(
    () => buildCourseSearchEntries(offerings, titleByCode),
    [offerings, titleByCode],
  );

  const urlNorm = useMemo(() => parseCoursePathParam(urlCourseParam), [urlCourseParam]);

  // Redirect to /explore if course not found once data loads
  useEffect(() => {
    if (loading || courseEntries.length === 0) return;
    if (urlNorm == null) return;
    if (courseEntries.some((e) => e.normCode === urlNorm)) return;
    void navigate({ to: "/explore", search: EMPTY_EXPLORE_SEARCH, replace: true });
  }, [loading, courseEntries, urlNorm, navigate]);

  const selectedCourseMeta = useMemo(() => {
    if (loading || urlNorm == null) return null;
    return courseEntries.find((e) => e.normCode === urlNorm) ?? null;
  }, [loading, urlNorm, courseEntries]);

  const courseOfferings = useMemo(() => {
    if (urlNorm === null) return [];
    return offerings.filter((o) => normalizeCourseCode(o.courseCode) === urlNorm);
  }, [offerings, urlNorm]);

  const professorGroups = useMemo(
    () => groupOfferingsByProfessor(courseOfferings),
    [courseOfferings],
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      <Stack gap={0}>
        {selectedCourseMeta ? (
          <Box
            pt={4}
            pb={32}
            style={{
              paddingLeft: EXPLORE_ACCORDION_PAD_INLINE.xs,
              paddingRight: EXPLORE_ACCORDION_PAD_INLINE.xs,
            }}
          >
            <Title order={2} c="#F8F9FA" fw={600} fz={{ base: "h3", sm: "h2" }}>
              {selectedCourseMeta.courseCode}
            </Title>
            {selectedCourseMeta.courseTitle ? (
              <Text size="sm" c="dimmed" lh={1.5} mt={8}>
                {selectedCourseMeta.courseTitle}
              </Text>
            ) : null}
          </Box>
        ) : null}

        {professorGroups.length === 0 ? (
          <Box style={{ paddingLeft: EXPLORE_ACCORDION_PAD_INLINE.xs }}>
            <Text c="dimmed" size="sm">
              {loading ? null : tr("explore.courseNoProfessors")}
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
              radius={0}
              chevronPosition="right"
              variant="default"
              styles={{
                root: {
                  backgroundColor: "#141517",
                  borderTop: "1px solid #2c2e33",
                },
                item: {
                  borderBottom: "1px solid #2c2e33",
                  backgroundColor: "#18191c",
                  "&:last-of-type": { borderBottom: "none" },
                },
                control: {
                  position: "relative",
                  paddingTop: "var(--mantine-spacing-lg)",
                  paddingBottom: "var(--mantine-spacing-lg)",
                  paddingLeft: EXPLORE_ACCORDION_PAD_INLINE.xs,
                  paddingRight: EXPLORE_ACCORDION_PAD_RIGHT.xs,
                  borderRadius: 0,
                  backgroundColor: "#18191c",
                  "@media (max-width: 540px)": {
                    paddingLeft: EXPLORE_ACCORDION_PAD_INLINE.base,
                    paddingRight: EXPLORE_ACCORDION_PAD_RIGHT.base,
                  },
                  "&:hover": { backgroundColor: "rgba(255,255,255,0.04)" },
                },
                label: { flex: 1, minWidth: 0, paddingRight: 0 },
                panel: { padding: 0, backgroundColor: "#141517" },
                content: { padding: 0 },
                chevron: {
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  right: EXPLORE_CHEVRON_RIGHT.xs,
                  display: "flex",
                  alignItems: "center",
                  marginLeft: 0,
                  color: "var(--mantine-color-gray-5)",
                  "@media (max-width: 540px)": {
                    right: EXPLORE_CHEVRON_RIGHT.base,
                  },
                },
              }}
            >
              {professorGroups.map((g) => (
                <CourseProfessorItem
                  key={g.groupId}
                  group={g}
                  professorRatings={professorRatings}
                />
              ))}
            </Accordion>
          </Box>
        )}
      </Stack>
    </motion.div>
  );
}
