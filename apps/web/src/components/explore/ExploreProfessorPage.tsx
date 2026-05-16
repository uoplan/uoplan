import { Link } from "@tanstack/react-router";
import {
  Anchor,
  Box,
  Group,
  Loader,
  Paper,
  ScrollArea,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useLingui } from "@lingui/react";
import { useMemo, useState } from "react";
import type { Catalogue, ProfessorRatingsMap, Term } from "schedule";
import {
  normalizeCourseCode,
  normalizeProfessorName,
  normalizeGradeVizDistribution,
} from "schedule";
import { GradeDistributionExpanded } from "../calendar/GradeDistributionViz";
import { tr } from "../../i18n";
import { useCourseGradesPb } from "../../hooks/useCourseGradesPb";
import { buildExploreOfferings, type ExploreOfferingFlat } from "../../lib/explore/gradesSearch";

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
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  const selectedOffering = useMemo(() => {
    if (offerings.length === 0) return null;
    if (selectedId == null) return offerings[0];
    return offerings.find((o) => o.id === selectedId) ?? offerings[0];
  }, [offerings, selectedId]);

  const gradeViz = useMemo(
    () => (selectedOffering ? normalizeGradeVizDistribution(selectedOffering.distribution) : null),
    [selectedOffering],
  );

  const ratingLine = () => {
    if (!professorRatings) return null;
    const entry = professorRatings[normalizeProfessorName(displayName)];
    if (!entry || !Number.isFinite(entry.rating)) return null;
    return (
      <Text size="sm" c="dimmed">
        {entry.rating.toFixed(1)} · {entry.numRatings} ratings
      </Text>
    );
  };

  const rmpHref =
    Number.isFinite(legacyId) && legacyId > 0
      ? `https://www.ratemyprofessors.com/professor/${legacyId}`
      : null;

  return (
    <Box
      component="main"
      style={{
        minHeight: "100vh",
        padding: 24,
        backgroundColor: "#141517",
        boxSizing: "border-box",
      }}
    >
      <Stack gap="lg" maw={1200} mx="auto">
        <Group justify="space-between">
          <Anchor component={Link} to="/explore" size="sm" c="violet.4">
            {tr("explore.backToSearch")}
          </Anchor>
          {rmpHref ? (
            <Anchor href={rmpHref} target="_blank" rel="noopener noreferrer" size="sm" c="dimmed">
              RateMyProfessors
            </Anchor>
          ) : null}
        </Group>

        <div>
          <Title order={2} c="#F8F9FA" fw={600}>
            {displayName}
          </Title>
          {ratingLine()}
        </div>

        {loading ? (
          <Group justify="center" py="xl">
            <Loader color="gray" />
            <Text c="dimmed">{tr("explore.loadingGrades")}</Text>
          </Group>
        ) : error ? (
          <Text c="red">{tr("explore.loadError", { message: error })}</Text>
        ) : offerings.length === 0 ? (
          <Text c="dimmed">{tr("explore.professorNoCourses")}</Text>
        ) : (
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
            <ScrollArea.Autosize mah="calc(100vh - 260px)" type="auto" offsetScrollbars>
              <Stack gap="xs">
                {offerings.map((o: ExploreOfferingFlat) => (
                  <Paper
                    key={o.id}
                    withBorder
                    p="sm"
                    onClick={() => setSelectedId(o.id)}
                    style={{
                      cursor: "pointer",
                      backgroundColor: "#1a1b1e",
                      borderColor:
                        selectedOffering?.id === o.id ? "var(--mantine-color-violet-6)" : "#2c2e33",
                    }}
                  >
                    <Group justify="space-between" align="flex-start" wrap="nowrap">
                      <div>
                        <Text fw={600} size="sm" c="gray.2">
                          {o.courseCode}
                        </Text>
                        {o.courseTitle ? (
                          <Text size="xs" c="dimmed" lineClamp={2}>
                            {o.courseTitle}
                          </Text>
                        ) : null}
                      </div>
                      <Stack gap={2} align="flex-end">
                        <Text size="xs" c="dimmed">
                          {o.termLabel}
                        </Text>
                        {o.section ? (
                          <Text size="xs" c="dimmed">
                            {tr("explore.section", { section: o.section })}
                          </Text>
                        ) : null}
                      </Stack>
                    </Group>
                  </Paper>
                ))}
              </Stack>
            </ScrollArea.Autosize>

            <Box visibleFrom="md" style={{ position: "sticky", top: 24, alignSelf: "flex-start" }}>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb={8}>
                {tr("explore.distributionHeading")}
              </Text>
              <Paper
                withBorder
                p="md"
                style={{ backgroundColor: "#1a1b1e", borderColor: "#2c2e33" }}
              >
                {gradeViz ? <GradeDistributionExpanded gradeViz={gradeViz} /> : null}
              </Paper>
            </Box>
          </SimpleGrid>
        )}

        <Box hiddenFrom="md">
          {offerings.length > 0 ? (
            <>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb={8}>
                {tr("explore.distributionHeading")}
              </Text>
              <Paper
                withBorder
                p="md"
                style={{ backgroundColor: "#1a1b1e", borderColor: "#2c2e33" }}
              >
                {gradeViz ? <GradeDistributionExpanded gradeViz={gradeViz} /> : null}
              </Paper>
            </>
          ) : null}
        </Box>
      </Stack>
    </Box>
  );
}
