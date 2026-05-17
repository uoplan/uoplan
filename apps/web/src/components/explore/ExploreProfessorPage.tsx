import { Link } from "@tanstack/react-router";
import { Accordion, Anchor, Box, Group, Stack, Text, Title } from "@mantine/core";
import { useLingui } from "@lingui/react";
import { useMemo } from "react";
import type { Catalogue, ProfessorRatingsMap, Term } from "schedule";
import { normalizeCourseCode, normalizeProfessorName } from "schedule";
import { tr } from "../../i18n";
import { useCourseGradesPb } from "../../hooks/useCourseGradesPb";
import { buildExploreOfferings, groupOfferingsByCourse } from "../../lib/explore/gradesSearch";
import {
  EXPLORE_ACCORDION_PAD_INLINE,
  EXPLORE_ACCORDION_PAD_RIGHT,
  ExploreCourseItem,
} from "./ExploreProfessorGradesLayout";

/** Mobile breakpoint for responsive padding (in px). */
const MOBILE_BREAKPOINT_PX = 540;
const mobileMediaQuery = `@media (max-width: ${MOBILE_BREAKPOINT_PX}px)`;

/** Chevron sits slightly inset from the viewport edge. */
const EXPLORE_CHEVRON_RIGHT = {
  base: "12px",
  xs: "max(12px, calc((100vw - min(100vw, 1200px)) / 2 + 12px))",
};

function buildTitleByCode(catalogue: Catalogue | null): Map<string, string> {
  const m = new Map<string, string>();
  if (!catalogue) return m;
  for (const c of catalogue.courses) {
    m.set(normalizeCourseCode(c.code), c.title);
  }
  return m;
}

function buildTermNameById(terms: Term[]): Map<number, string> {
  const m = new Map<number, string>();
  for (const t of terms) {
    const id = Number.parseInt(t.termId, 10);
    if (Number.isFinite(id)) m.set(id, t.name);
  }
  return m;
}

export function ExploreProfessorPage({
  legacyId,
  professorName: professorNameProp,
  catalogue,
  terms,
  professorRatings,
}: (
  | { legacyId: number; professorName?: undefined }
  | { professorName: string; legacyId?: undefined }
) & {
  catalogue: Catalogue | null;
  terms: Term[];
  professorRatings: ProfessorRatingsMap | null;
}) {
  useLingui();
  const { data: grades, error } = useCourseGradesPb();

  const titleByCode = useMemo(() => buildTitleByCode(catalogue), [catalogue]);
  const termNameById = useMemo(() => buildTermNameById(terms), [terms]);

  const offerings = useMemo(() => {
    if (!grades) return [];
    const all = buildExploreOfferings(grades, titleByCode, termNameById);
    if (legacyId != null) {
      return all.filter((o) => o.legacyId === legacyId);
    }
    const nameLower = professorNameProp?.toLowerCase() ?? "";
    return all.filter((o) => o.professorName.toLowerCase() === nameLower);
  }, [grades, titleByCode, termNameById, legacyId, professorNameProp]);

  const courseGroups = useMemo(() => groupOfferingsByCourse(offerings), [offerings]);

  const displayName = offerings[0]?.professorName ?? tr("explore.professorFallback");

  const ratingLine = useMemo(() => {
    if (!professorRatings) return null;
    const entry = professorRatings[normalizeProfessorName(displayName)];
    if (!entry || !Number.isFinite(entry.rating)) return null;
    return (
      <Text size="sm" c="dimmed">
        {entry.rating.toFixed(1)} · {entry.numRatings} ratings
      </Text>
    );
  }, [professorRatings, displayName]);

  const rmpHref =
    legacyId != null && Number.isFinite(legacyId) && legacyId > 0
      ? `https://www.ratemyprofessors.com/professor/${legacyId}`
      : null;

  return (
    <Box
      component="main"
      style={{
        minHeight: "100vh",
        paddingTop: 24,
        paddingBottom: 48,
        backgroundColor: "#141517",
        boxSizing: "border-box",
        overflowX: "hidden",
      }}
    >
      <Stack gap={0}>
        <Box
          style={{
            paddingLeft: EXPLORE_ACCORDION_PAD_INLINE.xs,
            paddingRight: EXPLORE_ACCORDION_PAD_RIGHT.xs,
            paddingTop: 24,
            [mobileMediaQuery]: {
              paddingLeft: EXPLORE_ACCORDION_PAD_INLINE.base,
              paddingRight: EXPLORE_ACCORDION_PAD_RIGHT.base,
            },
          }}
        >
          <Anchor component={Link} to="/explore" size="sm" c="violet.4">
            {tr("explore.backToSearch")}
          </Anchor>
        </Box>

        <Box
          style={{
            paddingLeft: EXPLORE_ACCORDION_PAD_INLINE.xs,
            paddingRight: EXPLORE_ACCORDION_PAD_RIGHT.xs,
            paddingTop: 32,
            paddingBottom: 32,
            [mobileMediaQuery]: {
              paddingLeft: EXPLORE_ACCORDION_PAD_INLINE.base,
              paddingRight: EXPLORE_ACCORDION_PAD_RIGHT.base,
              paddingTop: 24,
              paddingBottom: 24,
            },
          }}
        >
          <Title order={2} c="#F8F9FA" fw={600} fz={{ base: "h3", sm: "h2" }}>
            {displayName}
          </Title>
          {(ratingLine || rmpHref) && (
            <Group gap={6} align="center" mt={8} wrap="wrap">
              {ratingLine}
              {rmpHref ? (
                <Anchor
                  href={rmpHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  size="sm"
                  c="dimmed"
                >
                  RateMyProfessors
                </Anchor>
              ) : null}
            </Group>
          )}
        </Box>

        {error ? (
          <Text c="red" px={24}>
            {tr("explore.loadError", { message: error })}
          </Text>
        ) : courseGroups.length === 0 ? (
          <Text
            c="dimmed"
            style={{
              paddingLeft: EXPLORE_ACCORDION_PAD_INLINE.xs,
              paddingRight: EXPLORE_ACCORDION_PAD_RIGHT.xs,
              [mobileMediaQuery]: {
                paddingLeft: EXPLORE_ACCORDION_PAD_INLINE.base,
                paddingRight: EXPLORE_ACCORDION_PAD_RIGHT.base,
              },
            }}
          >
            {tr("explore.professorNoCourses")}
          </Text>
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
                  "&:last-of-type": {
                    borderBottom: "none",
                  },
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
                  "&:hover": {
                    backgroundColor: "rgba(255,255,255,0.04)",
                  },
                },
                label: {
                  flex: 1,
                  minWidth: 0,
                  paddingRight: 0,
                },
                panel: {
                  padding: 0,
                  backgroundColor: "#141517",
                },
                content: {
                  padding: 0,
                },
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
              {courseGroups.map((g) => (
                <ExploreCourseItem key={g.groupId} group={g} />
              ))}
            </Accordion>
          </Box>
        )}
      </Stack>
    </Box>
  );
}
