import { Accordion, Box, Stack, Text, Title } from "@mantine/core";
import { useLingui } from "@lingui/react";
import { useEffect, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import type { ProfessorRatingsMap } from "@uoplan/core";
import { tr } from "../../i18n";
import {
  type ProfessorOfferingGroup,
  groupOfferingsByProfessor,
} from "../../lib/explore/gradesSearch";
import { useExploreOfferings } from "./ExploreOfferingsContext";
import type { BackState } from "../../lib/navigation/backState";
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

function CourseProfessorItem({
  group,
  professorRatings,
  currentEntry,
}: {
  group: ProfessorOfferingGroup;
  professorRatings: ProfessorRatingsMap | null;
  currentEntry?: BackState;
}) {
  return (
    <Accordion.Item value={group.groupId}>
      <Accordion.Control>
        <ExploreProfessorSummaryBar
          group={group}
          professorRatings={professorRatings}
          stopPropagation
          currentEntry={currentEntry}
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
  professorRatings,
}: {
  urlCourseParam: string;
  professorRatings: ProfessorRatingsMap | null;
}) {
  useLingui();
  const { loading, offeringsByCourseNorm } = useExploreOfferings();
  const navigate = useNavigate();

  const urlNorm = useMemo(() => parseCoursePathParam(urlCourseParam), [urlCourseParam]);

  const courseOfferings = useMemo(() => {
    if (urlNorm === null) return [];
    return offeringsByCourseNorm.get(urlNorm) ?? [];
  }, [offeringsByCourseNorm, urlNorm]);

  // Redirect to /explore if course has no offerings once data loads.
  useEffect(() => {
    if (loading || urlNorm == null) return;
    if (courseOfferings.length > 0) return;
    void navigate({ to: "/explore", search: EMPTY_EXPLORE_SEARCH, replace: true });
  }, [loading, urlNorm, courseOfferings, navigate]);

  const selectedCourseMeta = useMemo(() => {
    if (loading || urlNorm == null || courseOfferings.length === 0) return null;
    const first = courseOfferings[0];
    return { courseCode: first.courseCode, courseTitle: first.courseTitle };
  }, [loading, urlNorm, courseOfferings]);

  const professorGroups = useMemo(
    () => groupOfferingsByProfessor(courseOfferings),
    [courseOfferings],
  );

  const courseEntry = useMemo<BackState | undefined>(() => {
    if (!selectedCourseMeta) return undefined;
    return {
      to: "/explore/course/$course",
      params: { course: urlCourseParam },
      label: selectedCourseMeta.courseCode,
    };
  }, [selectedCourseMeta, urlCourseParam]);

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
            <Title order={2} c="var(--app-text)" fw={600} fz={{ base: "h3", sm: "h2" }}>
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
                  backgroundColor: "var(--app-bg)",
                  borderTop: "1px solid var(--app-border)",
                },
                item: {
                  borderBottom: "1px solid var(--app-border)",
                  backgroundColor: "var(--app-surface-sunken)",
                  "&:last-of-type": { borderBottom: "none" },
                },
                control: {
                  position: "relative",
                  paddingTop: "var(--mantine-spacing-lg)",
                  paddingBottom: "var(--mantine-spacing-lg)",
                  paddingLeft: EXPLORE_ACCORDION_PAD_INLINE.xs,
                  paddingRight: EXPLORE_ACCORDION_PAD_RIGHT.xs,
                  borderRadius: 0,
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
              {professorGroups.map((g) => (
                <CourseProfessorItem
                  key={g.groupId}
                  group={g}
                  professorRatings={professorRatings}
                  currentEntry={courseEntry}
                />
              ))}
            </Accordion>
          </Box>
        )}
      </Stack>
    </motion.div>
  );
}
