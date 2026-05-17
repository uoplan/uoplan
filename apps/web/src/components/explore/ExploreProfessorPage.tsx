import { Link } from "@tanstack/react-router";
import { Accordion, Anchor, Box, Group, Stack, Text, TextInput, Title } from "@mantine/core";
import { useLingui } from "@lingui/react";
import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Catalogue, ProfessorRatingsMap, Term } from "schedule";
import { normalizeCourseCode, normalizeProfessorName } from "schedule";
import { tr } from "../../i18n";
import { useCourseGradesPb } from "../../hooks/useCourseGradesPb";
import {
  buildCourseSearchEntries,
  buildExploreOfferings,
  buildExploreProfessorSearchEntries,
  groupOfferingsByCourse,
} from "../../lib/explore/gradesSearch";
import {
  EXPLORE_ACCORDION_PAD_INLINE,
  EXPLORE_ACCORDION_PAD_RIGHT,
  ExploreCourseItem,
} from "./ExploreProfessorGradesLayout";
import { ExploreSearchResults } from "./ExploreSearchResults";
import { useExploreSearch, type ExploreSearchNavigate } from "../../hooks/useExploreSearch";

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
  navigateExplore,
}: (
  | { legacyId: number; professorName?: undefined }
  | { professorName: string; legacyId?: undefined }
) & {
  catalogue: Catalogue | null;
  terms: Term[];
  professorRatings: ProfessorRatingsMap | null;
  navigateExplore: ExploreSearchNavigate;
}) {
  useLingui();
  const { data: grades, error } = useCourseGradesPb();

  const titleByCode = useMemo(() => buildTitleByCode(catalogue), [catalogue]);
  const termNameById = useMemo(() => buildTermNameById(terms), [terms]);

  const allOfferings = useMemo(() => {
    if (!grades) return [];
    return buildExploreOfferings(grades, titleByCode, termNameById);
  }, [grades, titleByCode, termNameById]);

  const professorOfferings = useMemo(() => {
    if (legacyId != null) {
      return allOfferings.filter((o) => o.legacyId === legacyId);
    }
    const nameLower = professorNameProp?.toLowerCase() ?? "";
    return allOfferings.filter((o) => o.professorName.toLowerCase() === nameLower);
  }, [allOfferings, legacyId, professorNameProp]);

  const courseEntries = useMemo(
    () => buildCourseSearchEntries(allOfferings, titleByCode),
    [allOfferings, titleByCode],
  );

  const professorEntries = useMemo(
    () => buildExploreProfessorSearchEntries(allOfferings),
    [allOfferings],
  );

  const {
    draftQuery,
    setDraftQuery,
    searchResults,
    highlightFlatIndex,
    setHighlightFlatIndex,
    commitCourse,
    commitProfessor,
    resultsStale,
    handleKeyDown,
    showSearchResults: searchActive,
  } = useExploreSearch({ courseEntries, professorEntries, navigateExplore });

  const courseGroups = useMemo(
    () => groupOfferingsByCourse(professorOfferings),
    [professorOfferings],
  );

  const displayName = professorOfferings[0]?.professorName ?? tr("explore.professorFallback");

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

  const showSearchResults = searchActive && !error;

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
        {/* Compact search header */}
        <Box px={{ base: 16, xs: 24 }} maw={1200} mx="auto" w="100%" style={{ paddingBottom: 12 }}>
          <Box style={{ position: "relative", paddingTop: 0 }}>
            <Anchor
              component={Link}
              to="/"
              c="violet.4"
              size="sm"
              style={{ position: "absolute", top: 0, right: 0, zIndex: 1 }}
            >
              {tr("app.nav.back")}
            </Anchor>
            <Stack gap="xs" align="center" ta="center">
              <Title order={3} c="#F8F9FA" fw={600} fz={{ base: "h4", sm: "h3" }}>
                {tr("explore.title")}
              </Title>
              <Box w="100%" maw={584} mx="auto">
                <TextInput
                  placeholder={tr("explore.searchPlaceholder")}
                  value={draftQuery}
                  onChange={(e) => setDraftQuery(e.currentTarget.value)}
                  size="lg"
                  radius={9999}
                  disabled={!!error}
                  w="100%"
                  autoComplete="off"
                  aria-label={tr("explore.searchPlaceholder")}
                  aria-controls={showSearchResults ? "explore-search-results" : undefined}
                  onKeyDown={handleKeyDown}
                  styles={{
                    root: { width: "100%" },
                    input: {
                      backgroundColor: "#1a1b1e",
                      borderColor: "#3f424a",
                      minHeight: 48,
                      paddingInline: 18,
                      fontSize: "var(--mantine-font-size-md)",
                      boxShadow: "0 1px 6px rgba(0, 0, 0, 0.22)",
                      "@media (min-width: 540px)": {
                        minHeight: 52,
                        paddingInline: 22,
                      },
                    },
                  }}
                />
              </Box>
            </Stack>
          </Box>
        </Box>

        {/* Search results overlay */}
        <Box px={{ base: 16, xs: 24 }} maw={1200} mx="auto" w="100%">
          <AnimatePresence mode="popLayout" initial={false}>
            {showSearchResults ? (
              <motion.div
                key="professor-search-results"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                style={{ width: "100%", maxWidth: 720, marginInline: "auto" }}
              >
                <ExploreSearchResults
                  professors={searchResults.professors}
                  courses={searchResults.courses}
                  professorsFirst={searchResults.professorsFirst}
                  loadingStale={resultsStale}
                  professorRatings={professorRatings}
                  highlightFlatIndex={highlightFlatIndex}
                  onHighlightFlatIndex={setHighlightFlatIndex}
                  onSelectProfessor={commitProfessor}
                  onSelectCourse={commitCourse}
                />
              </motion.div>
            ) : (
              <motion.div
                key="professor-content"
                initial={false}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                {/* Professor name + rating header */}
                <Box
                  style={{
                    paddingTop: 24,
                    paddingBottom: 32,
                    [mobileMediaQuery]: {
                      paddingTop: 16,
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
                  <Text
                    c="red"
                    style={{
                      paddingLeft: EXPLORE_ACCORDION_PAD_INLINE.xs,
                      paddingRight: EXPLORE_ACCORDION_PAD_RIGHT.xs,
                      [mobileMediaQuery]: {
                        paddingLeft: EXPLORE_ACCORDION_PAD_INLINE.base,
                        paddingRight: EXPLORE_ACCORDION_PAD_RIGHT.base,
                      },
                    }}
                  >
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
              </motion.div>
            )}
          </AnimatePresence>
        </Box>
      </Stack>
    </Box>
  );
}
