import { Accordion, Badge, Box, Paper, Stack, Text, Title } from "@mantine/core";
import { useLingui } from "@lingui/react";
import { useEffect, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { m } from "framer-motion";
import type { Discipline, Faculty, ProfessorRatingsMap } from "@uoplan/core";
import { normalizeProfessorName } from "@uoplan/core";
import { groupOfferingsByCourse, groupOfferingsByProfessor } from "../../lib/explore/gradesSearch";
import { localizeFacultyName } from "../../lib/explore/faculty";
import type { CourseOfferingGroup } from "../../lib/explore/gradesSearch";
import { useExploreOfferings } from "./exploreOfferingsContext";
import { useScheduleSentiment } from "../../hooks/useScheduleSentiment";
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
import {
  EXPLORE_MOBILE_MEDIA_QUERY,
  ExploreAccordion,
  ExploreFullBleed,
} from "./ExploreEntityLayout";

function DisciplineProfessorRows({
  group,
  professorRatings,
  professorByName,
}: {
  group: CourseOfferingGroup;
  professorRatings: ProfessorRatingsMap | null;
  professorByName: Map<string, number> | null;
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
              [EXPLORE_MOBILE_MEDIA_QUERY]: {
                paddingLeft: EXPLORE_ACCORDION_PAD_INLINE.base,
                paddingRight: EXPLORE_ACCORDION_PAD_RIGHT.base,
              },
            }}
          >
            <ExploreProfessorSummaryBar
              group={pg}
              professorRatings={professorRatings}
              sentiment={professorByName?.get(normalizeProfessorName(pg.displayName)) ?? null}
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
  professorByName,
}: {
  group: CourseOfferingGroup;
  professorRatings: ProfessorRatingsMap | null;
  professorByName: Map<string, number> | null;
}) {
  return (
    <Accordion.Item value={group.groupId}>
      <Accordion.Control>
        <ExploreCourseSummaryBar group={group} />
      </Accordion.Control>
      <Accordion.Panel>
        <DisciplineProfessorRows
          group={group}
          professorRatings={professorRatings}
          professorByName={professorByName}
        />
      </Accordion.Panel>
    </Accordion.Item>
  );
}

export function ExploreDisciplinePage({
  disciplineCode,
  disciplines,
  faculties,
  professorRatings,
}: {
  disciplineCode: string;
  disciplines: Discipline[] | null;
  faculties: Faculty[] | null;
  professorRatings: ProfessorRatingsMap | null;
}) {
  const { i18n } = useLingui();
  const { loading, offerings } = useExploreOfferings();
  const navigate = useNavigate();

  // Per-professor course-feedback satisfaction (1-5) for the RatingBadge row.
  const { professorByName } = useScheduleSentiment();

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

  const faculty = useMemo(() => {
    if (!discipline?.facultyId || !faculties) return null;
    return faculties.find((f) => f.id === discipline.facultyId) ?? null;
  }, [discipline, faculties]);
  const facultyName = faculty ? localizeFacultyName(faculty, i18n.locale) : null;

  const disciplineOfferings = useMemo(
    () => offerings.filter((o) => o.courseCode.split(/\s+/)[0]?.toUpperCase() === normalizedCode),
    [offerings, normalizedCode],
  );

  const courseGroups = useMemo(
    () => groupOfferingsByCourse(disciplineOfferings),
    [disciplineOfferings],
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
            {facultyName ? (
              <Badge
                size="lg"
                variant="light"
                color="gray"
                radius="sm"
                mt={10}
                maw="100%"
                style={{ textTransform: "none" }}
              >
                {facultyName}
              </Badge>
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
          <ExploreFullBleed>
            <ExploreAccordion>
              {courseGroups.map((g) => (
                <DisciplineCourseItem
                  key={g.groupId}
                  group={g}
                  professorRatings={professorRatings}
                  professorByName={professorByName}
                />
              ))}
            </ExploreAccordion>
          </ExploreFullBleed>
        )}
      </Stack>
    </m.div>
  );
}
