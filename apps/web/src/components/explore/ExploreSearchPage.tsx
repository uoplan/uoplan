import {
  Accordion,
  Anchor,
  Box,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  TextInput,
  Title,
  UnstyledButton,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { useLingui } from "@lingui/react";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
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
  createExploreCourseFuse,
  groupOfferingsByProfessor,
  searchExploreCourses,
  type ExploreCourseSearchEntry,
  type ProfessorOfferingGroup,
} from "../../lib/explore/gradesSearch";
import { ExploreCourseSpotlightGallery } from "./ExploreCourseSpotlightGallery";
import {
  EXPLORE_ACCORDION_PAD_INLINE,
  EXPLORE_ACCORDION_PAD_RIGHT,
  ExploreProfessorOfferingRows,
  ExploreProfessorSummaryBar,
} from "./ExploreProfessorGradesLayout";
import { Link } from "@tanstack/react-router";

export type ExploreSearchNavigate = (opts: {
  to: "/explore/" | "/explore/course/$course";
  params?: { course: string };
  replace?: boolean;
}) => void | Promise<void>;

/** Chevron sits slightly inset from the viewport edge (further right than text padding). */
const EXPLORE_CHEVRON_RIGHT = "max(12px, calc((100vw - min(100vw, 1200px)) / 2 + 12px))";

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
  const [debouncedDraft] = useDebouncedValue(draftQuery, 220);
  const debouncedTrimmed = debouncedDraft.trim();
  const fuseQuery = useDeferredValue(debouncedTrimmed);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [highlightFuseQuery, setHighlightFuseQuery] = useState(fuseQuery);
  const [urlNormForDraft, setUrlNormForDraft] = useState<string | null | undefined>(undefined);

  const [pendingEnterPickFirst, setPendingEnterPickFirst] = useState(false);
  const [skipClearDraftOnUrlClear, setSkipClearDraftOnUrlClear] = useState(false);
  const [prevDropdownStale, setPrevDropdownStale] = useState(false);
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

  const suggestions = useMemo(() => {
    if (!courseFuse || courseEntries.length === 0 || fuseQuery.length === 0) return [];
    return searchExploreCourses(courseFuse, courseEntries, fuseQuery);
  }, [fuseQuery, courseFuse, courseEntries]);

  const urlNorm = useMemo(() => parseCoursePathParam(urlCourseParam), [urlCourseParam]);

  const selectedCourseMeta = useMemo(() => {
    if (loading || urlNorm == null) return null;
    return courseEntries.find((e) => e.normCode === urlNorm) ?? null;
  }, [loading, urlNorm, courseEntries]);

  const committedNorm = selectedCourseMeta?.normCode ?? null;

  const dropdownStale =
    committedNorm === null && debouncedTrimmed.length > 0 && fuseQuery !== debouncedTrimmed;

  const showInlineSuggestions =
    committedNorm === null && debouncedTrimmed.length > 0 && !loading && !error;

  const commitCourse = useCallback(
    (c: ExploreCourseSearchEntry) => {
      setPendingEnterPickFirst(false);
      void navigateExplore({
        to: "/explore/course/$course",
        params: { course: courseNormToPathParam(c.normCode) },
        replace: true,
      });
    },
    [navigateExplore],
  );

  if (fuseQuery !== highlightFuseQuery) {
    setHighlightFuseQuery(fuseQuery);
    setHighlightIndex(0);
  }

  if (urlNorm !== urlNormForDraft) {
    setUrlNormForDraft(urlNorm);
    if (urlNorm == null && !skipClearDraftOnUrlClear) {
      setDraftQuery("");
    }
    setSkipClearDraftOnUrlClear(false);
  }

  const staleBecameFresh = prevDropdownStale && !dropdownStale;
  if (dropdownStale !== prevDropdownStale) {
    setPrevDropdownStale(dropdownStale);
  }
  if (pendingEnterPickFirst && staleBecameFresh) {
    if (suggestions.length > 0) {
      queueMicrotask(() => commitCourse(suggestions[0]));
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

  const inputValue =
    selectedCourseMeta != null ? formatCommittedCourseLabel(selectedCourseMeta) : draftQuery;

  const clampedHighlight =
    suggestions.length === 0 ? -1 : Math.min(Math.max(highlightIndex, 0), suggestions.length - 1);

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
                minHeight: "calc(100vh - 72px)",
              }
            : undefined
        }
      >
        <Box
          style={{
            position: "relative",
            overflow: "visible",
            ...(landingBrowse
              ? {
                  flex: "1 1 auto",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  paddingBottom: 16,
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
              <motion.div
                animate={dropdownStale ? { opacity: [1, 0.88, 1] } : { opacity: 1 }}
                transition={{
                  duration: dropdownStale ? 1.15 : 0.2,
                  repeat: dropdownStale ? Infinity : 0,
                  ease: "easeInOut",
                }}
              >
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
                  aria-expanded={showInlineSuggestions}
                  aria-controls={showInlineSuggestions ? "explore-course-suggestions" : undefined}
                  onKeyDown={(e) => {
                    if (e.nativeEvent.code !== "Enter" && e.nativeEvent.code !== "NumpadEnter") {
                      if (e.key === "ArrowDown") {
                        if (!showInlineSuggestions || suggestions.length === 0) return;
                        e.preventDefault();
                        setHighlightIndex((i) =>
                          Math.min(suggestions.length - 1, Math.max(0, i) + 1),
                        );
                      }
                      if (e.key === "ArrowUp") {
                        if (!showInlineSuggestions || suggestions.length === 0) return;
                        e.preventDefault();
                        setHighlightIndex((i) => Math.max(0, i - 1));
                      }
                      return;
                    }

                    if (committedNorm !== null) return;
                    if (debouncedTrimmed.length === 0) return;

                    if (dropdownStale) {
                      e.preventDefault();
                      setPendingEnterPickFirst(true);
                      return;
                    }

                    if (suggestions.length === 0) {
                      e.preventDefault();
                      setPendingEnterPickFirst(false);
                      return;
                    }

                    e.preventDefault();
                    const pick =
                      clampedHighlight >= 0 ? suggestions[clampedHighlight] : suggestions[0];
                    if (pick) commitCourse(pick);
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

              <AnimatePresence initial={false}>
                {showInlineSuggestions ? (
                  <motion.div
                    key="explore-suggestions"
                    id="explore-course-suggestions"
                    role="listbox"
                    aria-label={tr("explore.searchPlaceholder")}
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                    style={{ marginTop: 10 }}
                  >
                    <Paper
                      radius="md"
                      p={0}
                      style={{
                        overflow: "hidden",
                        border: "1px solid #2c2e33",
                        backgroundColor: "#1a1b1e",
                      }}
                    >
                      {dropdownStale ? (
                        <Group justify="center" gap="xs" py="lg">
                          <Loader size="sm" color="gray" />
                          <motion.div
                            animate={{ opacity: [0.55, 1, 0.55] }}
                            transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
                          >
                            <Text size="sm" c="dimmed">
                              {tr("explore.searchUpdating")}
                            </Text>
                          </motion.div>
                        </Group>
                      ) : suggestions.length === 0 ? (
                        <Text size="sm" c="dimmed" ta="center" py="lg" px="md">
                          {tr("explore.noResults")}
                        </Text>
                      ) : (
                        suggestions.map((c, idx) => {
                          const title = c.courseTitle.trim();
                          const active = idx === clampedHighlight;
                          return (
                            <UnstyledButton
                              key={c.normCode}
                              role="option"
                              aria-selected={active}
                              w="100%"
                              onMouseDown={(ev) => ev.preventDefault()}
                              onMouseEnter={() => setHighlightIndex(idx)}
                              onClick={() => commitCourse(c)}
                              styles={{
                                root: {
                                  display: "block",
                                  width: "100%",
                                  padding: "12px 16px",
                                  textAlign: "left",
                                  borderBottom: "1px solid #25262b",
                                  backgroundColor: active ? "rgba(134, 46, 156, 0.14)" : undefined,
                                  transition: "background-color 80ms ease",
                                },
                              }}
                            >
                              <Text size="sm" lh={1.45} style={{ wordBreak: "break-word" }}>
                                <Text component="span" fw={600} c="#F8F9FA">
                                  {c.courseCode}
                                </Text>
                                {title.length > 0 ? (
                                  <Text component="span" fw={400} c="dimmed">
                                    {" "}
                                    • {title}
                                  </Text>
                                ) : null}
                              </Text>
                            </UnstyledButton>
                          );
                        })
                      )}
                    </Paper>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </Box>
          </Stack>
        </Box>

        {landingBrowse && !loading && !error && spotlightRows.length > 0 ? (
          <ExploreCourseSpotlightGallery rows={spotlightRows} onSelectCourse={commitCourse} />
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
