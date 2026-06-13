import { Accordion, Anchor, Box, Paper, Stack, Text } from "@mantine/core";
import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { IconExternalLink } from "@tabler/icons-react";
import type { Catalogue, ProfessorRatingsMap } from "@uoplan/core";
import { normalizeCourseCode, normalizeProfessorName } from "@uoplan/core";
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
import { ExploreEmptyState } from "./ExploreEmptyState";
import {
  ExploreCourseSummaryBar,
  ExploreProfessorSummaryBar,
} from "./ExploreProfessorGradesLayout";
import {
  EXPLORE_MOBILE_MEDIA_QUERY,
  ExploreAccordion,
  ExploreFullBleed,
} from "./ExploreEntityLayout";

/** A catalogue course that has no grade/schedule offerings to expand. */
type CatalogueCourseLite = { norm: string; code: string; title: string };

/**
 * One row in a discipline's course list: either a course backed by grade/schedule
 * offerings (rich row) or a catalogue-only course (no offerings yet).
 */
type DisciplineCourseEntry =
  | { kind: "offering"; code: string; group: CourseOfferingGroup }
  | { kind: "catalogue"; code: string; course: CatalogueCourseLite };

/** Deep-link to the uOttawa catalogue for a course with no in-app offerings. */
function catalogueUrlForCode(code: string): string {
  return `https://catalogue.uottawa.ca/search/?${new URLSearchParams({ P: code }).toString()}`;
}

/** Shared header layout for a catalogue-only course: code + truncated title. */
function CatalogueCourseHeader({ code, title }: { code: string; title: string }) {
  return (
    <Box
      style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: "1 1 auto" }}
    >
      <Box style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
        <Text fw={600} c="var(--app-text)" style={{ flexShrink: 0 }}>
          {code}
        </Text>
        {title ? (
          <Text size="sm" c="dimmed" lineClamp={1}>
            {title}
          </Text>
        ) : null}
      </Box>
      <Text size="xs" c="dimmed">
        {tr("explore.courseNoDataYet")}
      </Text>
    </Box>
  );
}

/**
 * Flat, non-expandable list of course rows for the faculty page. Courses with
 * offerings link to the course page; catalogue-only courses link out to the
 * uOttawa catalogue (the in-app course page has no data for them).
 */
function DisciplineFlatRows({ entries }: { entries: DisciplineCourseEntry[] }) {
  return (
    <Stack gap={0}>
      {entries.map((entry, index) => {
        const isLast = index === entries.length - 1;
        const rowStyle = {
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
        } as const;

        if (entry.kind === "offering") {
          return (
            <Paper
              key={entry.group.groupId}
              className="explore-course-row"
              radius={0}
              style={rowStyle}
              renderRoot={(props) => (
                <Link
                  to="/explore/course/$course"
                  params={{ course: courseNormToPathParam(entry.group.groupId) }}
                  search={EMPTY_EXPLORE_SEARCH}
                  {...props}
                />
              )}
            >
              <ExploreCourseSummaryBar group={entry.group} asPlainCode />
            </Paper>
          );
        }

        return (
          <Paper
            key={entry.course.norm}
            className="explore-course-row"
            radius={0}
            style={rowStyle}
            renderRoot={(props) => (
              <a
                href={catalogueUrlForCode(entry.course.code)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={tr("explore.openInCatalogue")}
                {...props}
              />
            )}
          >
            <Box
              w="100%"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--mantine-spacing-md)",
              }}
            >
              <CatalogueCourseHeader code={entry.course.code} title={entry.course.title} />
              <IconExternalLink
                size={16}
                stroke={1.5}
                aria-hidden
                style={{ flexShrink: 0, color: "var(--app-text-muted)" }}
              />
            </Box>
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
 * Accordion item for a catalogue-only course (no offerings): the control shows the
 * code + title, and the panel explains the missing data and links to the catalogue.
 */
function DisciplineCatalogueItem({ course }: { course: CatalogueCourseLite }) {
  return (
    <Accordion.Item value={course.norm}>
      <Accordion.Control>
        <CatalogueCourseHeader code={course.code} title={course.title} />
      </Accordion.Control>
      <Accordion.Panel>
        <Box
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--mantine-spacing-xs)",
            paddingTop: "var(--mantine-spacing-md)",
            paddingBottom: "var(--mantine-spacing-md)",
            paddingLeft: EXPLORE_ACCORDION_PAD_INLINE.xs,
            paddingRight: EXPLORE_ACCORDION_PAD_RIGHT.xs,
            [EXPLORE_MOBILE_MEDIA_QUERY]: {
              paddingLeft: EXPLORE_ACCORDION_PAD_INLINE.base,
              paddingRight: EXPLORE_ACCORDION_PAD_RIGHT.base,
            },
          }}
        >
          <Text size="sm" c="dimmed">
            {tr("explore.courseNoDataYet")}
          </Text>
          <Anchor
            href={catalogueUrlForCode(course.code)}
            target="_blank"
            rel="noopener noreferrer"
            c="var(--app-accent)"
            fw={500}
            display="inline-flex"
            style={{ alignItems: "center", gap: 6, alignSelf: "flex-start" }}
          >
            {tr("explore.openInCatalogue")}
            <IconExternalLink size={15} stroke={1.6} aria-hidden />
          </Anchor>
        </Box>
      </Accordion.Panel>
    </Accordion.Item>
  );
}

/**
 * The rich, per-course grade list for a single discipline, shared by the
 * discipline page and the faculty page.
 *
 * Courses are the union of the discipline's catalogue courses and its grade/
 * schedule offerings (keyed by normalized code): courses with offerings render
 * their full grade/schedule data, while catalogue-only courses still appear as
 * lightweight rows linking to the catalogue — so the list always matches the
 * discipline's course count.
 *
 * - `expandable` (default, discipline page): each course is an accordion item
 *   that expands to its per-professor grade/rating rows (or a catalogue note).
 * - non-`expandable` (faculty page): a flat list of course rows.
 *
 * `fullBleed` (default true) wraps the list in a 100vw bleed; turn it off when
 * nesting inside another accordion panel (e.g. the faculty page) so the bleed
 * doesn't escape its container.
 */
export function DisciplineCourseList({
  disciplineCode,
  catalogue,
  professorRatings,
  fullBleed = true,
  expandable = true,
}: {
  disciplineCode: string;
  catalogue: Catalogue | null;
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

  const catalogueCourses = useMemo<CatalogueCourseLite[]>(() => {
    if (!catalogue) return [];
    const out: CatalogueCourseLite[] = [];
    for (const c of catalogue.courses) {
      if (c.code.split(/\s+/)[0]?.toUpperCase() !== normalizedCode) continue;
      out.push({ norm: normalizeCourseCode(c.code), code: c.code, title: c.title });
    }
    return out;
  }, [catalogue, normalizedCode]);

  // Merge catalogue courses with their offering groups (keyed by normalized code).
  // Offering-only codes not in the catalogue are kept so nothing is dropped.
  const entries = useMemo<DisciplineCourseEntry[]>(() => {
    const groupByNorm = new Map<string, CourseOfferingGroup>();
    for (const g of courseGroups) groupByNorm.set(normalizeCourseCode(g.courseCode), g);

    const out: DisciplineCourseEntry[] = [];
    const seen = new Set<string>();
    for (const c of catalogueCourses) {
      if (seen.has(c.norm)) continue;
      seen.add(c.norm);
      const group = groupByNorm.get(c.norm);
      if (group) out.push({ kind: "offering", code: group.courseCode, group });
      else out.push({ kind: "catalogue", code: c.code, course: c });
    }
    for (const g of courseGroups) {
      const norm = normalizeCourseCode(g.courseCode);
      if (seen.has(norm)) continue;
      seen.add(norm);
      out.push({ kind: "offering", code: g.courseCode, group: g });
    }
    out.sort((a, b) => a.code.localeCompare(b.code, "en"));
    return out;
  }, [catalogueCourses, courseGroups]);

  // Offerings still loading: avoid flashing catalogue-only rows before data arrives.
  if (loading && courseGroups.length === 0) return null;

  if (entries.length === 0) {
    return (
      <ExploreEmptyState
        title={tr("explore.disciplineNoData")}
        description={tr("explore.disciplineNoDataDescription")}
      />
    );
  }

  const content = expandable ? (
    <ExploreAccordion>
      {entries.map((entry) =>
        entry.kind === "offering" ? (
          <DisciplineCourseItem
            key={entry.group.groupId}
            group={entry.group}
            professorRatings={professorRatings}
            professorByName={professorByName}
          />
        ) : (
          <DisciplineCatalogueItem key={entry.course.norm} course={entry.course} />
        ),
      )}
    </ExploreAccordion>
  ) : (
    <Box style={{ borderTop: "var(--app-border-width) solid var(--app-border)" }}>
      <DisciplineFlatRows entries={entries} />
    </Box>
  );

  return fullBleed ? <ExploreFullBleed>{content}</ExploreFullBleed> : content;
}
