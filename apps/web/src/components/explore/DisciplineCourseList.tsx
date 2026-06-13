import { Accordion, Box, Paper, Stack, Text } from "@mantine/core";
import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import type { ProfessorRatingsMap } from "@uoplan/core";
import { normalizeProfessorName } from "@uoplan/core";
import { groupOfferingsByCourse, groupOfferingsByProfessor } from "../../lib/explore/gradesSearch";
import type { CourseOfferingGroup } from "../../lib/explore/gradesSearch";
import { useExploreOfferings } from "./exploreOfferingsContext";
import { useScheduleSentiment } from "../../hooks/useScheduleSentiment";
import { tr } from "../../i18n";
import { courseNormToPathParam } from "../../lib/explore/courseSearchParams";
import { EMPTY_EXPLORE_SEARCH } from "../../lib/explore/exploreFilters";
import {
  EXPLORE_ACCORDION_PAD_INLINE,
  EXPLORE_ACCORDION_PAD_RIGHT,
} from "../../lib/explore/accordionPadding";
import {
  ExploreCourseSummaryBar,
  ExploreProfessorSummaryBar,
} from "./ExploreProfessorGradesLayout";
import {
  EXPLORE_MOBILE_MEDIA_QUERY,
  ExploreAccordion,
  ExploreFullBleed,
} from "./ExploreEntityLayout";

/**
 * Flat, non-expandable list of course rows: each whole row links to the course
 * page (no nested professor accordion). Used by the faculty page, where the
 * per-professor breakdown lives on the course page itself.
 */
function DisciplineCourseRows({ groups }: { groups: CourseOfferingGroup[] }) {
  return (
    <Stack gap={0}>
      {groups.map((group, index) => {
        const isLast = index === groups.length - 1;
        return (
          <Paper
            key={group.groupId}
            className="explore-course-row"
            radius={0}
            style={{
              display: "block",
              textDecoration: "none",
              color: "inherit",
              backgroundColor: "var(--app-bg)",
              borderBottom: isLast ? undefined : "var(--app-border-width) solid var(--app-border)",
              paddingTop: "var(--mantine-spacing-lg)",
              paddingBottom: "var(--mantine-spacing-lg)",
              paddingLeft: EXPLORE_ACCORDION_PAD_INLINE.xs,
              paddingRight: EXPLORE_ACCORDION_PAD_RIGHT.xs,
              [EXPLORE_MOBILE_MEDIA_QUERY]: {
                paddingLeft: EXPLORE_ACCORDION_PAD_INLINE.base,
                paddingRight: EXPLORE_ACCORDION_PAD_RIGHT.base,
              },
            }}
            renderRoot={(props) => (
              <Link
                to="/explore/course/$course"
                params={{ course: courseNormToPathParam(group.groupId) }}
                search={EMPTY_EXPLORE_SEARCH}
                {...props}
              />
            )}
          >
            <ExploreCourseSummaryBar group={group} asPlainCode />
          </Paper>
        );
      })}
    </Stack>
  );
}

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

/**
 * The rich, per-course grade list for a single discipline, shared by the
 * discipline page and the faculty page.
 *
 * - `expandable` (default, discipline page): each course is an accordion item
 *   that expands to its per-professor grade/rating rows.
 * - non-`expandable` (faculty page): a flat list of course rows, each linking
 *   straight to the course page (the per-professor breakdown lives there).
 *
 * `fullBleed` (default true) wraps the list in a 100vw bleed; turn it off when
 * nesting inside another accordion panel (e.g. the faculty page) so the bleed
 * doesn't escape its container.
 */
export function DisciplineCourseList({
  disciplineCode,
  professorRatings,
  fullBleed = true,
  expandable = true,
}: {
  disciplineCode: string;
  professorRatings: ProfessorRatingsMap | null;
  fullBleed?: boolean;
  expandable?: boolean;
}) {
  const { loading, offerings } = useExploreOfferings();
  const { professorByName } = useScheduleSentiment();

  const normalizedCode = disciplineCode.toUpperCase();
  const disciplineOfferings = useMemo(
    () => offerings.filter((o) => o.courseCode.split(/\s+/)[0]?.toUpperCase() === normalizedCode),
    [offerings, normalizedCode],
  );
  const courseGroups = useMemo(
    () => groupOfferingsByCourse(disciplineOfferings),
    [disciplineOfferings],
  );

  if (courseGroups.length === 0) {
    return (
      <Box style={{ paddingLeft: EXPLORE_ACCORDION_PAD_INLINE.xs }}>
        <Text c="dimmed" size="sm">
          {loading ? null : tr("explore.disciplineNoData")}
        </Text>
      </Box>
    );
  }

  const content = expandable ? (
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
  ) : (
    <Box style={{ borderTop: "var(--app-border-width) solid var(--app-border)" }}>
      <DisciplineCourseRows groups={courseGroups} />
    </Box>
  );

  return fullBleed ? <ExploreFullBleed>{content}</ExploreFullBleed> : content;
}
