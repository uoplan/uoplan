import { Link } from "@tanstack/react-router";
import { Anchor, Box, Group, Loader, Stack, Text, Title } from "@mantine/core";
import { useLingui } from "@lingui/react";
import { useMemo } from "react";
import type { Catalogue, ProfessorRatingsMap, Term } from "schedule";
import { normalizeCourseCode, normalizeProfessorName } from "schedule";
import { tr } from "../../i18n";
import { useCourseGradesPb } from "../../hooks/useCourseGradesPb";
import { buildExploreOfferings } from "../../lib/explore/gradesSearch";
import {
  EXPLORE_ACCORDION_PAD_INLINE,
  EXPLORE_ACCORDION_PAD_RIGHT,
  ExploreProfessorOfferingRows,
} from "./ExploreProfessorGradesLayout";

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
  catalogue,
  terms,
  professorRatings,
}: {
  legacyId: number;
  catalogue: Catalogue | null;
  terms: Term[];
  professorRatings: ProfessorRatingsMap | null;
}) {
  useLingui();
  const { loading, data: grades, error } = useCourseGradesPb();

  const titleByCode = useMemo(() => buildTitleByCode(catalogue), [catalogue]);
  const termNameById = useMemo(() => buildTermNameById(terms), [terms]);

  const offerings = useMemo(() => {
    if (!grades) return [];
    const all = buildExploreOfferings(grades, titleByCode, termNameById);
    return all
      .filter((o) => o.legacyId === legacyId)
      .sort((a, b) => {
        const c = a.courseCode.localeCompare(b.courseCode, "en");
        if (c !== 0) return c;
        if (b.termId !== a.termId) return b.termId - a.termId;
        return String(a.section ?? "").localeCompare(String(b.section ?? ""), "en");
      });
  }, [grades, titleByCode, termNameById, legacyId]);

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
    Number.isFinite(legacyId) && legacyId > 0
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
        <Group
          justify="space-between"
          wrap="nowrap"
          style={{
            paddingLeft: EXPLORE_ACCORDION_PAD_INLINE,
            paddingRight: EXPLORE_ACCORDION_PAD_RIGHT,
          }}
        >
          <Anchor component={Link} to="/explore" size="sm" c="violet.4">
            {tr("explore.backToSearch")}
          </Anchor>
          {rmpHref ? (
            <Anchor href={rmpHref} target="_blank" rel="noopener noreferrer" size="sm" c="dimmed">
              RateMyProfessors
            </Anchor>
          ) : null}
        </Group>

        <Box
          style={{
            paddingLeft: EXPLORE_ACCORDION_PAD_INLINE,
            paddingRight: EXPLORE_ACCORDION_PAD_RIGHT,
            paddingTop: 40,
            paddingBottom: 40,
          }}
        >
          <Title order={2} c="#F8F9FA" fw={600}>
            {displayName}
          </Title>
          {ratingLine}
        </Box>

        {loading ? (
          <Group justify="center" py="xl" px={24}>
            <Loader color="gray" />
            <Text c="dimmed">{tr("explore.loadingGrades")}</Text>
          </Group>
        ) : error ? (
          <Text c="red" px={24}>
            {tr("explore.loadError", { message: error })}
          </Text>
        ) : offerings.length === 0 ? (
          <Text
            c="dimmed"
            style={{
              paddingLeft: EXPLORE_ACCORDION_PAD_INLINE,
              paddingRight: EXPLORE_ACCORDION_PAD_RIGHT,
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
            <ExploreProfessorOfferingRows offerings={offerings} showCourseCode />
          </Box>
        )}
      </Stack>
    </Box>
  );
}
