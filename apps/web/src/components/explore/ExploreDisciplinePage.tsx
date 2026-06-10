import { Accordion, Box, Paper, Stack, Text, Title } from "@mantine/core";
import { useLingui } from "@lingui/react";
import { useEffect, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { m } from "framer-motion";
import type { Discipline, ProfessorRatingsMap } from "@uoplan/core";
import {
  groupOfferingsByCourse,
  groupOfferingsByProfessor,
  type CourseOfferingGroup,
} from "../../lib/explore/gradesSearch";
import { useExploreOfferings } from "./exploreOfferingsContext";
import type { BackState } from "../../lib/navigation/backState";
import { tr } from "../../i18n";
import { EMPTY_EXPLORE_SEARCH } from "../../lib/explore/exploreFilters";
import {
  ExploreCourseSummaryBar,
  ExploreProfessorSummaryBar,
} from "./ExploreProfessorGradesLayout";
import {
  EXPLORE_ACCORDION_PAD_INLINE,
  EXPLORE_ACCORDION_PAD_RIGHT,
} from "../../lib/explore/accordionPadding";

const EXPLORE_CHEVRON_RIGHT = {
  base: "12px",
  xs: "max(12px, calc((100vw - min(100vw, 1200px)) / 2 + 12px))",
};

const mobileMediaQuery = "@media (max-width: 540px)";

function DisciplineProfessorRows({
  group,
  professorRatings,
  currentEntry,
}: {
  group: CourseOfferingGroup;
  professorRatings: ProfessorRatingsMap | null;
  currentEntry?: BackState;
}) {
  const professorGroups = useMemo(
    () => groupOfferingsByProfessor(group.offerings),
    [group.offerings],
  );

  return (
    <Stack gap={0}>
      {professorGroups.map((pg, index) => {
        const isLast = index === professorGroups.length - 1;
        return (
          <Paper
            key={pg.groupId}
            radius="var(--app-radius)"
            style={{
              backgroundColor: "var(--app-bg)",
              borderBottom: isLast ? undefined : "var(--app-border-width) solid var(--app-border)",
              borderTop: "none",
              borderLeft: "none",
              borderRight: "none",
              paddingTop: "var(--mantine-spacing-lg)",
              paddingBottom: "var(--mantine-spacing-lg)",
              paddingLeft: EXPLORE_ACCORDION_PAD_INLINE.xs,
              paddingRight: EXPLORE_ACCORDION_PAD_RIGHT.xs,
              [mobileMediaQuery]: {
                paddingLeft: EXPLORE_ACCORDION_PAD_INLINE.base,
                paddingRight: EXPLORE_ACCORDION_PAD_RIGHT.base,
              },
            }}
          >
            <ExploreProfessorSummaryBar
              group={pg}
              professorRatings={professorRatings}
              currentEntry={currentEntry}
            />
          </Paper>
        );
      })}
    </Stack>
  );
}

function DisciplineCourseItem({
  group,
  professorRatings,
  currentEntry,
}: {
  group: CourseOfferingGroup;
  professorRatings: ProfessorRatingsMap | null;
  currentEntry?: BackState;
}) {
  return (
    <Accordion.Item value={group.groupId}>
      <Accordion.Control>
        <ExploreCourseSummaryBar group={group} currentEntry={currentEntry} />
      </Accordion.Control>
      <Accordion.Panel>
        <DisciplineProfessorRows
          group={group}
          professorRatings={professorRatings}
          currentEntry={currentEntry}
        />
      </Accordion.Panel>
    </Accordion.Item>
  );
}

export function ExploreDisciplinePage({
  disciplineCode,
  disciplines,
  professorRatings,
}: {
  disciplineCode: string;
  disciplines: Discipline[] | null;
  professorRatings: ProfessorRatingsMap | null;
}) {
  const { i18n } = useLingui();
  const { loading, offerings } = useExploreOfferings();
  const navigate = useNavigate();

  const normalizedCode = disciplineCode.toUpperCase();

  const discipline = useMemo(() => {
    if (!disciplines) return null;
    return disciplines.find((d) => d.code.toUpperCase() === normalizedCode) ?? null;
  }, [disciplines, normalizedCode]);

  // Navigate to /explore if discipline code is not found once data loads
  useEffect(() => {
    if (disciplines === null) return; // still loading
    if (discipline === null) {
      void navigate({
        to: "/explore",
        search: EMPTY_EXPLORE_SEARCH,
        replace: true,
      });
    }
  }, [disciplines, discipline, navigate]);

  const isFr = i18n.locale.startsWith("fr");
  const displayName = discipline
    ? isFr
      ? (discipline.nameFr ?? discipline.name)
      : discipline.name
    : null;

  // Prefer the canonical code from the data (already uppercased), fall back to the URL param
  const titleCode = discipline?.code ?? normalizedCode;

  const disciplineOfferings = useMemo(
    () => offerings.filter((o) => o.courseCode.split(/\s+/)[0]?.toUpperCase() === normalizedCode),
    [offerings, normalizedCode],
  );

  const courseGroups = useMemo(
    () => groupOfferingsByCourse(disciplineOfferings),
    [disciplineOfferings],
  );

  const disciplineEntry = useMemo<BackState>(
    () => ({
      to: "/explore/discipline/$discipline",
      params: { discipline: disciplineCode },
      label: titleCode,
    }),
    [disciplineCode, titleCode],
  );

  return (
    <m.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      <Stack gap={0}>
        {discipline ? (
          <Box
            pt={4}
            pb={32}
            style={{
              paddingLeft: EXPLORE_ACCORDION_PAD_INLINE.xs,
              paddingRight: EXPLORE_ACCORDION_PAD_INLINE.xs,
            }}
          >
            <Title order={2} c="var(--app-text)" fw={600} fz={{ base: "h3", sm: "h2" }}>
              {titleCode}
            </Title>
            {displayName ? (
              <Text size="sm" c="dimmed" lh={1.5} mt={8}>
                {displayName}
              </Text>
            ) : null}
          </Box>
        ) : null}

        {courseGroups.length === 0 ? (
          <Box style={{ paddingLeft: EXPLORE_ACCORDION_PAD_INLINE.xs }}>
            <Text c="dimmed" size="sm">
              {loading ? null : tr("explore.disciplineNoData")}
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
              classNames={{ control: "explore-accordion-control" }}
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
                <DisciplineCourseItem
                  key={g.groupId}
                  group={g}
                  professorRatings={professorRatings}
                  currentEntry={disciplineEntry}
                />
              ))}
            </Accordion>
          </Box>
        )}
      </Stack>
    </m.div>
  );
}
