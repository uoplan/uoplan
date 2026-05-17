import { Link } from "@tanstack/react-router";
import { Accordion, Anchor, Box, Stack, Text, TextInput, Title } from "@mantine/core";
import { useLingui } from "@lingui/react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import type { Catalogue, ProfessorRatingsMap, Term } from "schedule";
import { normalizeCourseCode } from "schedule";
import { tr } from "../../i18n";
import { parseCoursePathParam } from "../../lib/explore/courseSearchParams";
import { useCourseGradesPb } from "../../hooks/useCourseGradesPb";
import {
  buildCourseSpotlightIndex,
  pickSpotlightVariants,
  rankCoursesForSpotlight,
  SPOTLIGHT_MIN_GALLERY_ITEMS,
  SPOTLIGHT_ROW_DURATIONS_SEC,
} from "../../lib/explore/courseSpotlight";
import {
  buildCourseSearchEntries,
  buildExploreOfferings,
  buildExploreProfessorSearchEntries,
  groupOfferingsByProfessor,
  type ProfessorOfferingGroup,
} from "../../lib/explore/gradesSearch";
import { ExploreCourseSpotlightGallery } from "./ExploreCourseSpotlightGallery";
import { ExploreSearchResults } from "./ExploreSearchResults";
import {
  EXPLORE_ACCORDION_PAD_INLINE,
  EXPLORE_ACCORDION_PAD_RIGHT,
  ExploreProfessorOfferingRows,
  ExploreProfessorSummaryBar,
} from "./ExploreProfessorGradesLayout";
import { useExploreSearch, type ExploreSearchNavigate } from "../../hooks/useExploreSearch";
import {
  useExploreHistory,
  ExploreBackButton,
  type ExploreHistoryEntry,
} from "./ExploreHistoryContext";

export type { ExploreSearchNavigate };

/** Chevron sits slightly inset from the viewport edge (further right than text padding). */
const EXPLORE_CHEVRON_RIGHT = {
  base: `calc(12px)`,
  xs: "max(12px, calc((100vw - min(100vw, 1200px)) / 2 + 12px))",
};

/** Viewport band for landing (main vertical padding ≈ 72px). */
const EXPLORE_LANDING_VIEWPORT = "calc(100vh - 72px)";

/** Keeps title + search in the upper area; spotlight fills the rest of the viewport. */
const EXPLORE_LANDING_HERO_PAD_TOP = "clamp(40px, 13vh, 128px)";

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

function ExploreCourseProfessorItem({
  group,
  professorRatings,
  currentEntry,
}: {
  group: ProfessorOfferingGroup;
  professorRatings: ProfessorRatingsMap | null;
  currentEntry?: ExploreHistoryEntry;
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

function ExploreSearchInput({
  value,
  onChange,
  onKeyDown,
  disabled,
  showResults,
}: {
  value: string;
  onChange: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  disabled: boolean;
  showResults: boolean;
}) {
  return (
    <TextInput
      placeholder={tr("explore.searchPlaceholder")}
      value={value}
      onChange={(e) => onChange(e.currentTarget.value)}
      size="lg"
      radius={9999}
      disabled={disabled}
      w="100%"
      autoComplete="off"
      aria-label={tr("explore.searchPlaceholder")}
      aria-controls={showResults ? "explore-search-results" : undefined}
      onKeyDown={onKeyDown}
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
  );
}

export function ExploreSearchPage({
  catalogue,
  terms,
  professorRatings,
  navigateExplore,
  urlCourseParam,
}: {
  catalogue: Catalogue | null;
  terms: Term[];
  professorRatings: ProfessorRatingsMap | null;
  navigateExplore: ExploreSearchNavigate;
  urlCourseParam?: string;
}) {
  useLingui();
  const { loading, data: grades, error } = useCourseGradesPb();
  const [spotlightVariants] = useState(() => pickSpotlightVariants(3));

  const titleByCode = useMemo(() => buildTitleByCode(catalogue), [catalogue]);
  const termNameById = useMemo(() => buildTermNameById(terms), [terms]);

  const offerings = useMemo(() => {
    if (!grades) return [];
    return buildExploreOfferings(grades, titleByCode, termNameById);
  }, [grades, titleByCode, termNameById]);

  const courseEntries = useMemo(
    () => buildCourseSearchEntries(offerings, titleByCode),
    [offerings, titleByCode],
  );

  const professorEntries = useMemo(
    () => buildExploreProfessorSearchEntries(offerings),
    [offerings],
  );

  const { stack, pop } = useExploreHistory();
  const backEntry = stack[stack.length - 1];

  const urlNormEarly = useMemo(() => parseCoursePathParam(urlCourseParam), [urlCourseParam]);
  const currentEntry = useMemo<ExploreHistoryEntry | undefined>(() => {
    if (!urlCourseParam) return { to: "/explore/", label: "Explore" };
    if (!urlNormEarly) return undefined;
    return {
      to: "/explore/course/$course",
      params: { course: urlCourseParam },
      label: urlNormEarly,
    };
  }, [urlCourseParam, urlNormEarly]);

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
  } = useExploreSearch({ courseEntries, professorEntries, navigateExplore, currentEntry });

  const spotlightRows = useMemo(() => {
    if (offerings.length === 0) return [];
    const index = buildCourseSpotlightIndex(offerings, titleByCode);
    return spotlightVariants
      .map((variant, i) => ({
        variant,
        courses: rankCoursesForSpotlight(index, variant, 12),
        durationSec: SPOTLIGHT_ROW_DURATIONS_SEC[i] ?? 120,
        reverse: i === 1,
      }))
      .filter((row) => row.courses.length >= SPOTLIGHT_MIN_GALLERY_ITEMS);
  }, [offerings, titleByCode, spotlightVariants]);

  const urlNorm = useMemo(() => parseCoursePathParam(urlCourseParam), [urlCourseParam]);

  const selectedCourseMeta = useMemo(() => {
    if (loading || urlNorm == null) return null;
    return courseEntries.find((e) => e.normCode === urlNorm) ?? null;
  }, [loading, urlNorm, courseEntries]);

  const committedNorm = selectedCourseMeta?.normCode ?? null;

  useEffect(() => {
    if (loading || courseEntries.length === 0) return;
    if (urlNorm == null) return;
    if (courseEntries.some((e) => e.normCode === urlNorm)) return;
    void navigateExplore({ to: "/explore/", replace: true });
  }, [loading, courseEntries, urlNorm, navigateExplore]);

  const courseOfferings = useMemo(() => {
    if (committedNorm === null) return [];
    return offerings.filter((o) => normalizeCourseCode(o.courseCode) === committedNorm);
  }, [offerings, committedNorm]);

  const professorGroups = useMemo(
    () => groupOfferingsByProfessor(courseOfferings),
    [courseOfferings],
  );

  const landingBrowse = committedNorm === null;
  const showSearchResults = searchActive && !loading && !error;
  const showSpotlight =
    landingBrowse &&
    draftQuery.trim().length === 0 &&
    !loading &&
    !error &&
    spotlightRows.length > 0;

  const searchInputDisabled = loading || !!error;

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
      <Box
        px={{ base: 16, xs: 24 }}
        maw={1200}
        mx="auto"
        w="100%"
        style={
          landingBrowse
            ? {
                display: "flex",
                flexDirection: "column",
                height: showSearchResults ? undefined : EXPLORE_LANDING_VIEWPORT,
                minHeight: showSearchResults ? EXPLORE_LANDING_VIEWPORT : undefined,
              }
            : undefined
        }
      >
        {/* Header: centered hero on home, compact top bar on detail pages */}
        <Box
          style={{
            position: "relative",
            overflow: "visible",
            flexShrink: 0,
            ...(landingBrowse
              ? { paddingTop: EXPLORE_LANDING_HERO_PAD_TOP, paddingBottom: 12 }
              : { paddingTop: 0, paddingBottom: 12 }),
          }}
        >
          {landingBrowse ? (
            <Stack gap="md" align="center" ta="center">
              <Title order={2} c="#F8F9FA" fw={600} fz={{ base: "h3", sm: "h2" }}>
                {tr("explore.title")}
              </Title>
              <Text size="sm" c="dimmed" maw={520} lh={1.5}>
                {tr("explore.subtitle")}
              </Text>
              <Box w="100%" maw={584} mx="auto">
                <motion.div animate={{ opacity: 1 }} transition={{ duration: 0.15 }}>
                  <ExploreSearchInput
                    value={draftQuery}
                    onChange={setDraftQuery}
                    onKeyDown={handleKeyDown}
                    disabled={searchInputDisabled}
                    showResults={showSearchResults}
                  />
                </motion.div>
              </Box>
            </Stack>
          ) : (
            <Stack gap="xs" align="center" ta="center">
              {backEntry ? (
                <ExploreBackButton
                  entry={backEntry}
                  onBack={() => {
                    pop();
                    void navigateExplore({ to: backEntry.to, params: backEntry.params });
                  }}
                />
              ) : (
                <ExploreBackButton
                  entry={{ to: "/explore/", label: tr("explore.title") }}
                  onBack={() => {
                    void navigateExplore({ to: "/explore/" });
                  }}
                />
              )}
              <Title order={3} c="#F8F9FA" fw={600} fz={{ base: "h4", sm: "h3" }}>
                <Anchor
                  component={Link}
                  to="/explore"
                  c="inherit"
                  underline="hover"
                  fz="inherit"
                  fw="inherit"
                >
                  {tr("explore.title")}
                </Anchor>
              </Title>
              <Box w="100%" maw={584} mx="auto">
                <ExploreSearchInput
                  value={draftQuery}
                  onChange={setDraftQuery}
                  onKeyDown={handleKeyDown}
                  disabled={searchInputDisabled}
                  showResults={showSearchResults}
                />
              </Box>
            </Stack>
          )}
        </Box>

        {/* Home page: search results or spotlight gallery */}
        {landingBrowse ? (
          <Box
            style={{
              flex: showSearchResults ? "0 0 auto" : "1 1 auto",
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              justifyContent: showSpotlight ? "flex-end" : "flex-start",
            }}
          >
            <AnimatePresence mode="popLayout" initial={false}>
              {showSearchResults ? (
                <motion.div
                  key="explore-search-results"
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
              ) : showSpotlight ? (
                <motion.div
                  key="explore-spotlight"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                  style={{ width: "100%", flexShrink: 0 }}
                >
                  <ExploreCourseSpotlightGallery
                    rows={spotlightRows}
                    onSelectCourse={commitCourse}
                  />
                </motion.div>
              ) : null}
            </AnimatePresence>
          </Box>
        ) : null}

        {/* Course detail page: search results (when searching) or course content */}
        {!landingBrowse ? (
          error ? (
            <Text c="red" ta="center" size="sm" mt="xl">
              {tr("explore.loadError", { message: error })}
            </Text>
          ) : showSearchResults ? (
            <motion.div
              key="explore-search-results"
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
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              <Stack gap={0}>
                {selectedCourseMeta ? (
                  <Box
                    style={{
                      paddingTop: 24,
                      paddingBottom: 32,
                      "@media (max-width: 540px)": {
                        paddingTop: 16,
                        paddingBottom: 24,
                      },
                    }}
                  >
                    <Title order={2} c="#F8F9FA" fw={600} fz={{ base: "h3", sm: "h2" }}>
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
                  <Text c="dimmed" ta="center" size="sm" py="xl">
                    {tr("explore.courseNoProfessors")}
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
                      {professorGroups.map((g) => (
                        <ExploreCourseProfessorItem
                          key={g.groupId}
                          group={g}
                          professorRatings={professorRatings}
                          currentEntry={currentEntry}
                        />
                      ))}
                    </Accordion>
                  </Box>
                )}
              </Stack>
            </motion.div>
          )
        ) : null}
      </Box>
    </Box>
  );
}
