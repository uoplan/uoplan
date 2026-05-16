import { Box, Group, Loader, Paper, Stack, Text, UnstyledButton } from "@mantine/core";
import { AnimatePresence, motion } from "framer-motion";
import { useMemo, type ReactNode } from "react";
import type { ProfessorRatingsMap } from "schedule";
import { normalizeProfessorName } from "schedule";
import { tr } from "../../i18n";
import type {
  ExploreCourseSearchEntry,
  ExploreProfessorSearchEntry,
} from "../../lib/explore/gradesSearch";

const contentTransition = { duration: 0.18, ease: [0.22, 1, 0.36, 1] as const };

export type ExploreSearchFlatItem =
  | { kind: "professor"; entry: ExploreProfessorSearchEntry }
  | { kind: "course"; entry: ExploreCourseSearchEntry };

export function buildExploreSearchFlatItems(
  professors: ExploreProfessorSearchEntry[],
  courses: ExploreCourseSearchEntry[],
  professorsFirst: boolean,
): ExploreSearchFlatItem[] {
  const profItems: ExploreSearchFlatItem[] = professors.map((entry) => ({
    kind: "professor",
    entry,
  }));
  const courseItems: ExploreSearchFlatItem[] = courses.map((entry) => ({
    kind: "course",
    entry,
  }));
  return professorsFirst ? [...profItems, ...courseItems] : [...courseItems, ...profItems];
}

function professorRatingLine(displayName: string, professorRatings: ProfessorRatingsMap | null) {
  if (!professorRatings) return null;
  const entry = professorRatings[normalizeProfessorName(displayName)];
  if (!entry || !Number.isFinite(entry.rating)) return null;
  return (
    <Text size="xs" c="dimmed">
      {entry.rating.toFixed(1)} · {entry.numRatings} ratings
    </Text>
  );
}

function ExploreProfessorResultRow({
  entry,
  active,
  professorRatings,
  onHighlight,
  onSelect,
}: {
  entry: ExploreProfessorSearchEntry;
  active: boolean;
  professorRatings: ProfessorRatingsMap | null;
  onHighlight: () => void;
  onSelect: () => void;
}) {
  const navigable = entry.legacyId != null;
  const ratingLine = professorRatingLine(entry.displayName, professorRatings);

  return (
    <UnstyledButton
      role="option"
      aria-selected={active}
      w="100%"
      disabled={!navigable}
      onMouseEnter={onHighlight}
      onClick={navigable ? onSelect : undefined}
      styles={{
        root: {
          display: "block",
          width: "100%",
          padding: "14px 18px",
          textAlign: "left",
          borderBottom: "1px solid #25262b",
          backgroundColor: active ? "rgba(255, 255, 255, 0.08)" : undefined,
          transition: "background-color 120ms ease",
          cursor: navigable ? "pointer" : "default",
          opacity: navigable ? 1 : 0.72,
          "&:hover": {
            backgroundColor: active ? "rgba(255, 255, 255, 0.08)" : "rgba(255, 255, 255, 0.06)",
          },
        },
      }}
    >
      <Stack gap={4}>
        <Text size="sm" fw={600} c="#F8F9FA" lh={1.45} style={{ wordBreak: "break-word" }}>
          {entry.displayName}
        </Text>
        {ratingLine}
        <Text size="xs" c="dimmed">
          {tr("explore.professorCourseCount", { count: entry.uniqueCourseCount })}
        </Text>
      </Stack>
    </UnstyledButton>
  );
}

function ExploreCourseResultRow({
  entry,
  active,
  onHighlight,
  onSelect,
}: {
  entry: ExploreCourseSearchEntry;
  active: boolean;
  onHighlight: () => void;
  onSelect: () => void;
}) {
  const title = entry.courseTitle.trim();

  return (
    <UnstyledButton
      role="option"
      aria-selected={active}
      w="100%"
      onMouseEnter={onHighlight}
      onClick={onSelect}
      styles={{
        root: {
          display: "block",
          width: "100%",
          padding: "14px 18px",
          textAlign: "left",
          borderBottom: "1px solid #25262b",
          backgroundColor: active ? "rgba(255, 255, 255, 0.08)" : undefined,
          transition: "background-color 120ms ease",
          "&:hover": {
            backgroundColor: active ? "rgba(255, 255, 255, 0.08)" : "rgba(255, 255, 255, 0.06)",
          },
        },
      }}
    >
      <Text size="sm" lh={1.45} style={{ wordBreak: "break-word" }}>
        <Text component="span" fw={600} c="#F8F9FA">
          {entry.courseCode}
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
}

function ExploreSearchSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <motion.div layout="position">
      <Stack gap={0}>
        <Text
          size="xs"
          fw={600}
          tt="uppercase"
          c="dimmed"
          px="md"
          py="sm"
          style={{ letterSpacing: "0.06em", borderBottom: "1px solid #2c2e33" }}
        >
          {label}
        </Text>
        {children}
      </Stack>
    </motion.div>
  );
}

export function ExploreSearchResults({
  professors,
  courses,
  professorsFirst,
  loadingStale,
  professorRatings,
  highlightFlatIndex,
  onHighlightFlatIndex,
  onSelectProfessor,
  onSelectCourse,
}: {
  professors: ExploreProfessorSearchEntry[];
  courses: ExploreCourseSearchEntry[];
  professorsFirst: boolean;
  loadingStale: boolean;
  professorRatings: ProfessorRatingsMap | null;
  highlightFlatIndex: number;
  onHighlightFlatIndex: (index: number) => void;
  onSelectProfessor: (entry: ExploreProfessorSearchEntry) => void;
  onSelectCourse: (entry: ExploreCourseSearchEntry) => void;
}) {
  const flatItems = useMemo(
    () => buildExploreSearchFlatItems(professors, courses, professorsFirst),
    [professors, courses, professorsFirst],
  );

  const activeFlatIndex =
    flatItems.length === 0 ? -1 : Math.min(Math.max(highlightFlatIndex, 0), flatItems.length - 1);

  const flatIndexByProf = useMemo(() => {
    const m = new Map<string, number>();
    flatItems.forEach((item, i) => {
      if (item.kind === "professor") m.set(item.entry.groupId, i);
    });
    return m;
  }, [flatItems]);

  const flatIndexByCourse = useMemo(() => {
    const m = new Map<string, number>();
    flatItems.forEach((item, i) => {
      if (item.kind === "course") m.set(item.entry.normCode, i);
    });
    return m;
  }, [flatItems]);

  const hasResults = professors.length > 0 || courses.length > 0;

  const professorSection =
    professors.length > 0 ? (
      <ExploreSearchSection label={tr("explore.resultsProfessors")}>
        {professors.map((entry) => (
          <ExploreProfessorResultRow
            key={entry.groupId}
            entry={entry}
            active={flatIndexByProf.get(entry.groupId) === activeFlatIndex}
            professorRatings={professorRatings}
            onHighlight={() => onHighlightFlatIndex(flatIndexByProf.get(entry.groupId) ?? 0)}
            onSelect={() => onSelectProfessor(entry)}
          />
        ))}
      </ExploreSearchSection>
    ) : null;

  const courseSection =
    courses.length > 0 ? (
      <ExploreSearchSection label={tr("explore.resultsCourses")}>
        {courses.map((entry) => (
          <ExploreCourseResultRow
            key={entry.normCode}
            entry={entry}
            active={flatIndexByCourse.get(entry.normCode) === activeFlatIndex}
            onHighlight={() => onHighlightFlatIndex(flatIndexByCourse.get(entry.normCode) ?? 0)}
            onSelect={() => onSelectCourse(entry)}
          />
        ))}
      </ExploreSearchSection>
    ) : null;

  const sections = professorsFirst
    ? [professorSection, courseSection]
    : [courseSection, professorSection];

  return (
    <Box
      id="explore-search-results"
      role="listbox"
      aria-busy={loadingStale}
      aria-label={tr("explore.searchPlaceholder")}
      style={{ width: "100%", marginTop: 8 }}
    >
      <motion.div layout transition={{ layout: { duration: 0.22, ease: [0.22, 1, 0.36, 1] } }}>
        <Paper
          radius="md"
          p={0}
          style={{
            position: "relative",
            overflow: "hidden",
            border: "1px solid #2c2e33",
            backgroundColor: "#1a1b1e",
            minHeight: hasResults ? undefined : 88,
          }}
        >
          <AnimatePresence mode="wait" initial={false}>
            {!hasResults ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={contentTransition}
              >
                <Text size="sm" c="dimmed" ta="center" py="xl" px="md">
                  {loadingStale ? tr("explore.searchUpdating") : tr("explore.noResults")}
                </Text>
              </motion.div>
            ) : (
              <motion.div
                key="results"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={contentTransition}
              >
                <motion.div
                  layout="position"
                  animate={{ opacity: loadingStale ? 0.62 : 1 }}
                  transition={{ duration: 0.15, ease: "easeOut", layout: { duration: 0.22 } }}
                >
                  <Stack gap={0}>{sections}</Stack>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {loadingStale ? (
              <motion.div
                key="stale-indicator"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                style={{
                  position: "absolute",
                  top: 10,
                  right: 12,
                  zIndex: 2,
                  pointerEvents: "none",
                }}
              >
                <Group
                  gap={6}
                  px="xs"
                  py={4}
                  style={{
                    borderRadius: 9999,
                    backgroundColor: "rgba(20, 21, 23, 0.88)",
                    border: "1px solid #3f424a",
                  }}
                >
                  <Loader size={12} color="gray" />
                  <Text size="xs" c="dimmed">
                    {tr("explore.searchUpdating")}
                  </Text>
                </Group>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </Paper>
      </motion.div>
    </Box>
  );
}
