import { useCallback, useMemo, useState } from "react";
import { useDebouncedValue } from "@mantine/hooks";
import { courseNormToPathParam } from "../lib/explore/courseSearchParams";
import {
  createExploreCourseFuse,
  searchExplore,
  type ExploreCourseSearchEntry,
  type ExploreProfessorSearchEntry,
} from "../lib/explore/gradesSearch";
import { buildExploreSearchFlatItems } from "../components/explore/ExploreSearchResults";

export type ExploreSearchNavigate = (opts: {
  to: "/explore/" | "/explore/course/$course" | "/explore/professor/$legacyId";
  params?: { course: string } | { legacyId: string };
  replace?: boolean;
}) => void | Promise<void>;

const DEBOUNCE_MS = 100;

export function useExploreSearch({
  courseEntries,
  professorEntries,
  navigateExplore,
}: {
  courseEntries: ExploreCourseSearchEntry[];
  professorEntries: ExploreProfessorSearchEntry[];
  navigateExplore: ExploreSearchNavigate;
}) {
  const [draftQuery, setDraftQuery] = useState("");
  const [debouncedDraft] = useDebouncedValue(draftQuery, DEBOUNCE_MS);
  const draftTrimmed = draftQuery.trim();
  const debouncedTrimmed = debouncedDraft.trim();

  const [highlightFlatIndex, setHighlightFlatIndex] = useState(0);
  const [highlightSearchQuery, setHighlightSearchQuery] = useState(debouncedTrimmed);
  const [pendingEnterPickFirst, setPendingEnterPickFirst] = useState(false);
  const [prevResultsStale, setPrevResultsStale] = useState(false);

  const courseFuse = useMemo(
    () => (courseEntries.length === 0 ? null : createExploreCourseFuse(courseEntries)),
    [courseEntries],
  );

  const searchResults = useMemo(() => {
    if (debouncedTrimmed.length === 0) {
      return { professors: [], courses: [], professorsFirst: true };
    }
    return searchExplore(debouncedTrimmed, { courseFuse, courseEntries, professorEntries });
  }, [debouncedTrimmed, courseFuse, courseEntries, professorEntries]);

  const flatItems = useMemo(
    () =>
      buildExploreSearchFlatItems(
        searchResults.professors,
        searchResults.courses,
        searchResults.professorsFirst,
      ),
    [searchResults],
  );

  if (debouncedTrimmed !== highlightSearchQuery) {
    setHighlightSearchQuery(debouncedTrimmed);
    setHighlightFlatIndex(0);
  }

  const resultsStale = draftTrimmed.length > 0 && draftTrimmed !== debouncedTrimmed;

  const staleBecameFresh = prevResultsStale && !resultsStale;
  if (resultsStale !== prevResultsStale) setPrevResultsStale(resultsStale);

  const commitCourse = useCallback(
    (c: ExploreCourseSearchEntry) => {
      setPendingEnterPickFirst(false);
      setDraftQuery("");
      void navigateExplore({
        to: "/explore/course/$course",
        params: { course: courseNormToPathParam(c.normCode) },
      });
    },
    [navigateExplore],
  );

  const commitProfessor = useCallback(
    (p: ExploreProfessorSearchEntry) => {
      setPendingEnterPickFirst(false);
      setDraftQuery("");
      void navigateExplore({
        to: "/explore/professor/$legacyId",
        params: {
          legacyId: p.legacyId != null ? String(p.legacyId) : encodeURIComponent(p.displayName),
        },
      });
    },
    [navigateExplore],
  );

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
        if (item.kind === "professor") {
          commitProfessor(item.entry);
          return;
        }
      }
    },
    [flatItems, commitCourse, commitProfessor],
  );

  const pickHighlighted = useCallback(() => {
    if (clampedHighlight >= 0) pickSelectableItem(clampedHighlight);
  }, [clampedHighlight, pickSelectableItem]);

  if (pendingEnterPickFirst && staleBecameFresh) {
    if (flatItems.length > 0) {
      queueMicrotask(() => pickSelectableItem(highlightFlatIndex));
    } else if (debouncedTrimmed.length > 0) {
      setPendingEnterPickFirst(false);
    }
  }

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      const isEnter = e.nativeEvent.code === "Enter" || e.nativeEvent.code === "NumpadEnter";
      if (!isEnter) {
        if (e.key === "ArrowDown" && flatItems.length > 0) {
          e.preventDefault();
          setHighlightFlatIndex((i) => Math.min(flatItems.length - 1, Math.max(0, i) + 1));
        }
        if (e.key === "ArrowUp" && flatItems.length > 0) {
          e.preventDefault();
          setHighlightFlatIndex((i) => Math.max(0, i - 1));
        }
        return;
      }
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
    },
    [flatItems, debouncedTrimmed, resultsStale, pickHighlighted],
  );

  return {
    draftQuery,
    setDraftQuery,
    searchResults,
    flatItems,
    highlightFlatIndex,
    setHighlightFlatIndex,
    clampedHighlight,
    commitCourse,
    commitProfessor,
    resultsStale,
    handleKeyDown,
    showSearchResults: draftTrimmed.length > 0,
  };
}
