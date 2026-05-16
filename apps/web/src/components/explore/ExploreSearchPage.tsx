import {
  Accordion,
  Anchor,
  Box,
  Group,
  Loader,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { useLingui } from "@lingui/react";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Catalogue, ProfessorRatingsMap, Term } from "schedule";
import { normalizeCourseCode } from "schedule";
import { tr } from "../../i18n";
import { courseNormToPathParam, parseCoursePathParam } from "../../lib/explore/courseSearchParams";
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
  createExploreCourseFuse,
  groupOfferingsByProfessor,
  searchExplore,
  type ExploreCourseSearchEntry,
  type ExploreProfessorSearchEntry,
  type ProfessorOfferingGroup,
} from "../../lib/explore/gradesSearch";
import { ExploreCourseSpotlightGallery } from "./ExploreCourseSpotlightGallery";
import { buildExploreSearchFlatItems, ExploreSearchResults } from "./ExploreSearchResults";
import {
  EXPLORE_ACCORDION_PAD_INLINE,
  EXPLORE_ACCORDION_PAD_RIGHT,
  ExploreProfessorOfferingRows,
  ExploreProfessorSummaryBar,
} from "./ExploreProfessorGradesLayout";
import { Link } from "@tanstack/react-router";

export type ExploreSearchNavigate = (opts: {
  to: "/explore/" | "/explore/course/$course" | "/explore/professor/$legacyId";
  params?: { course: string } | { legacyId: string };
  replace?: boolean;
}) => void | Promise<void>;

/** Chevron sits slightly inset from the viewport edge (further right than text padding). */
const EXPLORE_CHEVRON_RIGHT = "max(12px, calc((100vw - min(100vw, 1200px)) / 2 + 12px))";

const EXPLORE_SEARCH_DEBOUNCE_MS = 100;

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

function formatCommittedCourseLabel(c: ExploreCourseSearchEntry): string {
  const t = c.courseTitle.trim();
  return t.length > 0 ? `${c.courseCode} — ${t}` : c.courseCode;
}

function ExploreCourseProfessorItem({
  group,
  professorRatings,
}: {
  group: ProfessorOfferingGroup;
  professorRatings: ProfessorRatingsMap | null;
}) {
  return (
    <Accordion.Item value={group.groupId}>
      <Accordion.Control>
        <ExploreProfessorSummaryBar
          group={group}
          professorRatings={professorRatings}
          profileLinkStopPropagation
        />
      </Accordion.Control>
      <Accordion.Panel>
        <ExploreProfessorOfferingRows offerings={group.offerings} />
      </Accordion.Panel>
    </Accordion.Item>
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
  const [draftQuery, setDraftQuery] = useState("");
  const [debouncedDraft] = useDebouncedValue(draftQuery, EXPLORE_SEARCH_DEBOUNCE_MS);
  const draftTrimmed = draftQuery.trim();
  const debouncedTrimmed = debouncedDraft.trim();
  const searchQuery = debouncedTrimmed;
  const [highlightFlatIndex, setHighlightFlatIndex] = useState(0);
  const [highlightSearchQuery, setHighlightSearchQuery] = useState(searchQuery);
  const [urlNormForDraft, setUrlNormForDraft] = useState<string | null | undefined>(undefined);

  const [pendingEnterPickFirst, setPendingEnterPickFirst] = useState(false);
  const [skipClearDraftOnUrlClear, setSkipClearDraftOnUrlClear] = useState(false);
  const [prevResultsStale, setPrevResultsStale] = useState(false);
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

  const courseFuse = useMemo(() => {
    if (courseEntries.length === 0) return null;
    return createExploreCourseFuse(courseEntries);
  }, [courseEntries]);

  const searchResults = useMemo(() => {
    if (searchQuery.length === 0) {
      return { professors: [], courses: [], professorsFirst: true };
    }
    return searchExplore(searchQuery, {
      courseFuse,
      courseEntries,
      professorEntries,
    });
  }, [searchQuery, courseFuse, courseEntries, professorEntries]);

  const flatItems = useMemo(
    () =>
      buildExploreSearchFlatItems(
        searchResults.professors,
        searchResults.courses,
        searchResults.professorsFirst,
      ),
    [searchResults],
  );

  const urlNorm = useMemo(() => parseCoursePathParam(urlCourseParam), [urlCourseParam]);

  const selectedCourseMeta = useMemo(() => {
    if (loading || urlNorm == null) return null;
    return courseEntries.find((e) => e.normCode === urlNorm) ?? null;
  }, [loading, urlNorm, courseEntries]);

  const committedNorm = selectedCourseMeta?.normCode ?? null;

  const resultsStale =
    committedNorm === null && draftTrimmed.length > 0 && draftTrimmed !== debouncedTrimmed;

  const showSearchResults = committedNorm === null && draftTrimmed.length > 0 && !loading && !error;

  const commitCourse = useCallback(
    (c: ExploreCourseSearchEntry) => {
      setPendingEnterPickFirst(false);
      void navigateExplore({
        to: "/explore/course/$course",
        params: { course: courseNormToPathParam(c.normCode) },
      });
    },
    [navigateExplore],
  );

  const commitProfessor = useCallback(
    (p: ExploreProfessorSearchEntry) => {
      if (p.legacyId == null) return;
      setPendingEnterPickFirst(false);
      void navigateExplore({
        to: "/explore/professor/$legacyId",
        params: { legacyId: String(p.legacyId) },
      });
    },
    [navigateExplore],
  );

  if (searchQuery !== highlightSearchQuery) {
    setHighlightSearchQuery(searchQuery);
    setHighlightFlatIndex(0);
  }

  if (urlNorm !== urlNormForDraft) {
    setUrlNormForDraft(urlNorm);
    if (urlNorm == null && !skipClearDraftOnUrlClear) {
      setDraftQuery("");
    }
    setSkipClearDraftOnUrlClear(false);
  }

  const clampedHighlight =
    flatItems.length === 0 ? -1 : Math.min(Math.max(highlightFlatIndex, 0), flatItems.length - 1);

  const pickSelectableItem = useCallback(
    (startIndex: number) => {
      if (flatItems.length === 0) return;
      const start = Math.min(Math.max(startIndex, 0), flatItems.length - 1);
      for (let offset = 0; offset < flatItems.length; offset += 1) {
        const item = flatItems[(start + offset) % flatItems.length];
        if (item.kind === "course") {
          commitCourse(item.entry);
          return;
        }
        if (item.kind === "professor" && item.entry.legacyId != null) {
          commitProfessor(item.entry);
          return;
        }
      }
    },
    [flatItems, commitProfessor, commitCourse],
  );

  const pickHighlighted = useCallback(() => {
    if (clampedHighlight < 0) return;
    pickSelectableItem(clampedHighlight);
  }, [clampedHighlight, pickSelectableItem]);

  const staleBecameFresh = prevResultsStale && !resultsStale;
  if (resultsStale !== prevResultsStale) {
    setPrevResultsStale(resultsStale);
  }

  if (pendingEnterPickFirst && staleBecameFresh) {
    if (flatItems.length > 0) {
      queueMicrotask(() => pickSelectableItem(highlightFlatIndex));
    } else if (debouncedTrimmed.length > 0) {
      setPendingEnterPickFirst(false);
    }
  }

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
  const showSpotlight =
    landingBrowse && draftTrimmed.length === 0 && !loading && !error && spotlightRows.length > 0;

  const inputValue =
    selectedCourseMeta != null ? formatCommittedCourseLabel(selectedCourseMeta) : draftQuery;

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
        px={24}
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
        <Box
          style={{
            position: "relative",
            overflow: "visible",
            flexShrink: 0,
            ...(landingBrowse
              ? {
                  paddingTop: EXPLORE_LANDING_HERO_PAD_TOP,
                  paddingBottom: 12,
                }
              : { paddingBottom: 8 }),
          }}
        >
          <Anchor
            component={Link}
            to="/step/term"
            c="violet.4"
            size="sm"
            style={{ position: "absolute", top: 0, right: 0, zIndex: 1 }}
          >
            {tr("app.nav.back")}
          </Anchor>

          <Stack gap="md" align="center" ta="center">
            <Title order={2} c="#F8F9FA" fw={600} fz={{ base: "h3", sm: "h2" }}>
              {tr("explore.title")}
            </Title>
            <Text size="sm" c="dimmed" maw={520} lh={1.5}>
              {tr("explore.subtitle")}
            </Text>

            <Box w="100%" maw={584} mx="auto">
              <motion.div animate={{ opacity: 1 }} transition={{ duration: 0.15 }}>
                <TextInput
                  placeholder={tr("explore.searchPlaceholder")}
                  value={inputValue}
                  onChange={(e) => {
                    const v = e.currentTarget.value;
                    setDraftQuery(v);
                    if (urlNorm != null) {
                      setSkipClearDraftOnUrlClear(true);
                      void navigateExplore({
                        to: "/explore/",
                        replace: true,
                      });
                    }
                  }}
                  size="xl"
                  radius={9999}
                  disabled={loading || !!error}
                  w="100%"
                  autoComplete="off"
                  aria-label={tr("explore.searchPlaceholder")}
                  aria-controls={showSearchResults ? "explore-search-results" : undefined}
                  onKeyDown={(e) => {
                    if (e.nativeEvent.code !== "Enter" && e.nativeEvent.code !== "NumpadEnter") {
                      if (e.key === "ArrowDown") {
                        if (!showSearchResults || flatItems.length === 0) return;
                        e.preventDefault();
                        setHighlightFlatIndex((i) =>
                          Math.min(flatItems.length - 1, Math.max(0, i) + 1),
                        );
                      }
                      if (e.key === "ArrowUp") {
                        if (!showSearchResults || flatItems.length === 0) return;
                        e.preventDefault();
                        setHighlightFlatIndex((i) => Math.max(0, i - 1));
                      }
                      return;
                    }

                    if (committedNorm !== null) return;
                    if (debouncedTrimmed.length === 0) return;

                    if (resultsStale) {
                      e.preventDefault();
                      setPendingEnterPickFirst(true);
                      return;
                    }

                    if (flatItems.length === 0) {
                      e.preventDefault();
                      setPendingEnterPickFirst(false);
                      return;
                    }

                    e.preventDefault();
                    pickHighlighted();
                  }}
                  styles={{
                    root: { width: "100%" },
                    input: {
                      backgroundColor: "#1a1b1e",
                      borderColor: "#3f424a",
                      minHeight: 52,
                      paddingInline: 22,
                      fontSize: "var(--mantine-font-size-md)",
                      boxShadow: "0 1px 6px rgba(0, 0, 0, 0.22)",
                    },
                  }}
                />
              </motion.div>
            </Box>
          </Stack>
        </Box>

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

        {loading ? (
          <Group justify="center" py="xl">
            <Loader color="gray" />
            <Text c="dimmed">{tr("explore.loadingGrades")}</Text>
          </Group>
        ) : error ? (
          <Text c="red" ta="center" size="sm" mt="xl">
            {tr("explore.loadError", { message: error })}
          </Text>
        ) : committedNorm === null ? null : (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <Stack gap={0} mt={36}>
              {selectedCourseMeta ? (
                <Stack gap={8} align="center" ta="center" mb="lg" px={{ base: 8, sm: 24 }}>
                  <Title order={3} c="gray.1" fw={600}>
                    {selectedCourseMeta.courseCode}
                  </Title>
                  {selectedCourseMeta.courseTitle ? (
                    <Text size="sm" c="dimmed" maw={720} lh={1.5}>
                      {selectedCourseMeta.courseTitle}
                    </Text>
                  ) : null}
                </Stack>
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
                        paddingLeft: EXPLORE_ACCORDION_PAD_INLINE,
                        paddingRight: EXPLORE_ACCORDION_PAD_RIGHT,
                        borderRadius: 0,
                        backgroundColor: "#18191c",
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
                        right: EXPLORE_CHEVRON_RIGHT,
                        display: "flex",
                        alignItems: "center",
                        marginLeft: 0,
                        color: "var(--mantine-color-gray-5)",
                      },
                    }}
                  >
                    {professorGroups.map((g) => (
                      <ExploreCourseProfessorItem
                        key={g.groupId}
                        group={g}
                        professorRatings={professorRatings}
                      />
                    ))}
                  </Accordion>
                </Box>
              )}
            </Stack>
          </motion.div>
        )}
      </Box>
    </Box>
  );
}
