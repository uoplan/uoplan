import { Accordion, Box, Text, Title } from "@mantine/core";
import { useLingui } from "@lingui/react";
import { memo, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import type {
  Catalogue,
  Discipline,
  Faculty,
  GradeVizData,
  ProfessorRatingsMap,
} from "@uoplan/core";
import { disciplinesForFaculty, localizeFacultyName } from "../../lib/explore/faculty";
import type { FacultyDisciplineEntry } from "../../lib/explore/faculty";
import { aggregateGradeVizForCourseNorms } from "../../lib/explore/gradesSearch";
import { tr } from "../../i18n";
import { EMPTY_EXPLORE_SEARCH } from "../../lib/explore/exploreFilters";
import { EXPLORE_ACCORDION_PAD_INLINE } from "../../lib/explore/accordionPadding";
import {
  GradeDistributionHistogram,
  GradeDistributionHistogramPlaceholder,
} from "../calendar/GradeDistributionViz";
import { DisciplineCourseList } from "./DisciplineCourseList";
import { ExplorePageTransition } from "./ExplorePageTransition";
import { ExploreEmptyState } from "./ExploreEmptyState";
import { useExploreOfferings } from "./exploreOfferingsContext";
import {
  EXPLORE_MOBILE_MEDIA_QUERY,
  ExploreAccordion,
  ExploreFullBleed,
} from "./ExploreEntityLayout";

/** Width of the merged grade histogram in the discipline header (matches course rows). */
const DISCIPLINE_HISTOGRAM_WIDTH_PX = 288;

function buildDisciplineCourseCount(catalogue: Catalogue | null): Map<string, number> {
  const counts = new Map<string, number>();
  if (!catalogue) return counts;
  for (const course of catalogue.courses) {
    const prefix = course.code.split(/\s+/)[0]?.toUpperCase();
    if (prefix) counts.set(prefix, (counts.get(prefix) ?? 0) + 1);
  }
  return counts;
}

const FacultyDisciplineControl = memo(function FacultyDisciplineControl({
  entry,
  gradeViz,
}: {
  entry: FacultyDisciplineEntry;
  gradeViz: GradeVizData | null;
}) {
  const { i18n } = useLingui();
  const isFr = i18n.locale.startsWith("fr");
  const { discipline, courseCount } = entry;
  const displayName = isFr ? (discipline.nameFr ?? discipline.name) : discipline.name;

  return (
    <Box
      w="100%"
      style={{
        display: "flex",
        flexDirection: "row",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "var(--mantine-spacing-md)",
        [EXPLORE_MOBILE_MEDIA_QUERY]: { flexDirection: "column", alignItems: "stretch" },
      }}
    >
      <Box
        style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: "1 1 auto" }}
      >
        <Box style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
          <Link
            to="/explore/discipline/$discipline"
            params={{ discipline: discipline.code.toLowerCase() }}
            search={EMPTY_EXPLORE_SEARCH}
            onClick={(e) => {
              e.stopPropagation();
            }}
            className="explore-name-link"
            style={{ fontWeight: 600, color: "var(--app-text)" }}
          >
            {discipline.code}
          </Link>
          <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
            {tr("explore.disciplineCourseCount", { count: courseCount })}
          </Text>
        </Box>
        <Text size="xs" c="dimmed" lineClamp={1}>
          {displayName}
        </Text>
      </Box>
      <Box
        style={{
          flex: "0 0 auto",
          width: DISCIPLINE_HISTOGRAM_WIDTH_PX,
          maxWidth: DISCIPLINE_HISTOGRAM_WIDTH_PX,
          marginLeft: "auto",
          [EXPLORE_MOBILE_MEDIA_QUERY]: { width: "100%", maxWidth: "100%", marginLeft: 0 },
        }}
      >
        {gradeViz ? (
          <GradeDistributionHistogram gradeViz={gradeViz} variant="compact" showStudentCount />
        ) : (
          <GradeDistributionHistogramPlaceholder />
        )}
      </Box>
    </Box>
  );
});

export function ExploreFacultyPage({
  facultyId,
  faculties,
  disciplines,
  catalogue,
  professorRatings,
}: {
  facultyId: string;
  faculties: Faculty[] | null;
  disciplines: Discipline[] | null;
  catalogue: Catalogue | null;
  professorRatings: ProfessorRatingsMap | null;
}) {
  const { i18n } = useLingui();
  const navigate = useNavigate();
  const [openDisciplines, setOpenDisciplines] = useState<string[]>([]);

  const faculty = useMemo(() => {
    if (!faculties) return null;
    return faculties.find((f) => f.id === facultyId) ?? null;
  }, [faculties, facultyId]);

  // Navigate to /explore if the faculty id is not found once data loads
  useEffect(() => {
    if (faculties === null) return; // still loading
    if (faculty === null) {
      void navigate({ to: "/explore", search: EMPTY_EXPLORE_SEARCH, replace: true });
    }
  }, [faculties, faculty, navigate]);

  const { offeringsByCourseNorm } = useExploreOfferings();

  const courseCounts = useMemo(() => buildDisciplineCourseCount(catalogue), [catalogue]);

  const facultyDisciplines = useMemo<FacultyDisciplineEntry[]>(
    () => (faculty ? disciplinesForFaculty(disciplines, faculty.id, courseCounts) : []),
    [faculty, disciplines, courseCounts],
  );

  // Merged grade distribution per discipline (all courses sharing the prefix),
  // shown in each discipline header. Computed in a single pass over the offering
  // norms so it stays cheap and stable across scroll/expand re-renders.
  const gradeVizByDiscipline = useMemo(() => {
    const normsByPrefix = new Map<string, string[]>();
    for (const norm of offeringsByCourseNorm.keys()) {
      const prefix = norm.split(" ")[0];
      if (!prefix) continue;
      const arr = normsByPrefix.get(prefix);
      if (arr) arr.push(norm);
      else normsByPrefix.set(prefix, [norm]);
    }
    const out = new Map<string, GradeVizData | null>();
    for (const entry of facultyDisciplines) {
      const norms = normsByPrefix.get(entry.discipline.code.toUpperCase()) ?? [];
      out.set(entry.discipline.code, aggregateGradeVizForCourseNorms(offeringsByCourseNorm, norms));
    }
    return out;
  }, [offeringsByCourseNorm, facultyDisciplines]);

  const facultyName = faculty ? localizeFacultyName(faculty, i18n.locale) : null;

  return (
    <ExplorePageTransition>
      {faculty ? (
        <Box
          pt={4}
          pb={32}
          style={{
            paddingLeft: EXPLORE_ACCORDION_PAD_INLINE.xs,
            paddingRight: EXPLORE_ACCORDION_PAD_INLINE.xs,
          }}
        >
          <Title order={2} c="var(--app-text)" fw={600} fz={{ base: "h3", sm: "h2" }}>
            {facultyName}
          </Title>
          <Text size="sm" c="dimmed" lh={1.5} mt={8}>
            {tr("explore.facultyDisciplineCount", { count: facultyDisciplines.length })}
          </Text>
        </Box>
      ) : null}

      {facultyDisciplines.length === 0 ? (
        faculty ? (
          <ExploreEmptyState
            title={tr("explore.facultyNoData")}
            description={tr("explore.facultyNoDataDescription")}
          />
        ) : null
      ) : (
        <ExploreFullBleed>
          <ExploreAccordion value={openDisciplines} onChange={setOpenDisciplines}>
            {facultyDisciplines.map((entry) => (
              <Accordion.Item key={entry.discipline.code} value={entry.discipline.code}>
                <Accordion.Control>
                  <FacultyDisciplineControl
                    entry={entry}
                    gradeViz={gradeVizByDiscipline.get(entry.discipline.code) ?? null}
                  />
                </Accordion.Control>
                <Accordion.Panel>
                  {openDisciplines.includes(entry.discipline.code) ? (
                    <DisciplineCourseList
                      disciplineCode={entry.discipline.code}
                      catalogue={catalogue}
                      professorRatings={professorRatings}
                      fullBleed={false}
                      expandable={false}
                    />
                  ) : null}
                </Accordion.Panel>
              </Accordion.Item>
            ))}
          </ExploreAccordion>
        </ExploreFullBleed>
      )}
    </ExplorePageTransition>
  );
}
