import { useNavigate } from "@tanstack/react-router";
import { useLingui } from "@lingui/react";
import { useEffect, useMemo, useState } from "react";
import {
  buildCourseSpotlightIndex,
  pickSpotlightVariants,
  rankCoursesForSpotlight,
  SPOTLIGHT_MIN_GALLERY_ITEMS,
  SPOTLIGHT_ROW_DURATIONS_SEC,
} from "../../lib/explore/courseSpotlight";
import { type ExploreCourseSearchEntry } from "../../lib/explore/gradesSearch";
import { courseNormToPathParam } from "../../lib/explore/courseSearchParams";
import type { ExploreSearchParams } from "../../lib/explore/exploreFilters";
import { ExploreCourseSpotlightGallery } from "./ExploreCourseSpotlightGallery";
import { useExploreOfferings } from "./ExploreOfferingsContext";

/** Defer the (synchronous, corpus-wide) spotlight build until after first paint. */
function useDeferredAfterPaint(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const ric = (
      window as unknown as {
        requestIdleCallback?: (cb: () => void) => number;
        cancelIdleCallback?: (id: number) => void;
      }
    ).requestIdleCallback;
    if (ric) {
      const id = ric(() => setReady(true));
      return () => {
        (window as unknown as { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback?.(
          id,
        );
      };
    }
    const id = window.setTimeout(() => setReady(true), 0);
    return () => window.clearTimeout(id);
  }, []);
  return ready;
}

export function ExploreSearchPage({ searchParams }: { searchParams: ExploreSearchParams }) {
  useLingui();
  const { loading, offeringsByCourseNorm, getCourseEntryByNorm } = useExploreOfferings();
  const navigate = useNavigate();
  const [spotlightVariants] = useState(() => pickSpotlightVariants(3));
  const ready = useDeferredAfterPaint();

  const spotlightRows = useMemo(() => {
    if (!ready || loading || offeringsByCourseNorm.size === 0) return [];
    const index = buildCourseSpotlightIndex(offeringsByCourseNorm, getCourseEntryByNorm());
    return spotlightVariants
      .map((variant, i) => ({
        variant,
        courses: rankCoursesForSpotlight(index, variant, 12),
        durationSec: SPOTLIGHT_ROW_DURATIONS_SEC[i] ?? 120,
        reverse: i === 1,
      }))
      .filter((row) => row.courses.length >= SPOTLIGHT_MIN_GALLERY_ITEMS);
  }, [ready, loading, offeringsByCourseNorm, getCourseEntryByNorm, spotlightVariants]);

  const onSelectCourse = (entry: ExploreCourseSearchEntry) => {
    void navigate({
      to: "/explore/course/$course",
      params: { course: courseNormToPathParam(entry.normCode) },
      search: searchParams,
    });
  };

  return !loading && spotlightRows.length > 0 ? (
    <div style={{ marginTop: "auto", paddingBottom: 32 }}>
      <ExploreCourseSpotlightGallery rows={spotlightRows} onSelectCourse={onSelectCourse} />
    </div>
  ) : null;
}
