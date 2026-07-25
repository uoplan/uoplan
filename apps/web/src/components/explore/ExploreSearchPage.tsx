import { useNavigate } from "@tanstack/react-router";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  buildCourseSpotlightIndex,
  pickSpotlightVariants,
  rankCoursesForSpotlight,
  SPOTLIGHT_MIN_GALLERY_ITEMS,
  SPOTLIGHT_ROW_DURATIONS_SEC,
} from "../../lib/explore/courseSpotlight";
import type { ExploreCourseSearchEntry } from "../../lib/explore/gradesSearch";
import { courseNormToPathParam } from "../../lib/explore/courseSearchParams";
import { EXPLORE_ACCORDION_PAD_INLINE } from "../../lib/explore/accordionPadding";
import type { ExploreSearchParams } from "../../lib/explore/exploreFilters";
import { ExploreCourseSpotlightGallery } from "./ExploreCourseSpotlightGallery";
import { ExploreDisciplineBrowse } from "./ExploreDisciplineBrowse";
import { ExploreFacultyBrowse } from "./ExploreFacultyBrowse";
import { useExploreOfferings } from "./exploreOfferingsContext";
import { useDeferredAfterPaint } from "../../hooks/useDeferredAfterPaint";
import { useSchoolFeature } from "../../hooks/useSchool";
import { useTr } from "../../i18n";

/**
 * Keeps a section exactly one viewport tall from wherever it starts, so the
 * spotlight gallery still fills the first screen even though the faculty index
 * now scrolls in below it. Measured from the element's own document offset
 * (the Explore header above it has no fixed height).
 */
function useFillFirstViewport(active: boolean) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [minHeight, setMinHeight] = useState("100dvh");

  useLayoutEffect(() => {
    const el = ref.current;
    if (!active || !el) return;
    const measure = () => {
      const top = el.getBoundingClientRect().top + window.scrollY;
      setMinHeight(`calc(100dvh - ${Math.max(0, Math.round(top))}px)`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(document.body);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [active]);

  return { ref, minHeight };
}

export function ExploreSearchPage({ searchParams }: { searchParams: ExploreSearchParams }) {
  useTr();
  // Every spotlight variant ranks by a grade statistic (GPA, fail rate, graded
  // count), so a school with no registrar grade data can never fill the gallery
  // and would land on a blank page. Those schools browse by discipline instead.
  const hasGrades = useSchoolFeature("grades");
  const { loading, offeringsByCourseNorm, getCourseEntryByNorm } = useExploreOfferings();
  const navigate = useNavigate();
  const [spotlightVariants] = useState(() => pickSpotlightVariants(3));
  const ready = useDeferredAfterPaint();

  const spotlightRows = useMemo(() => {
    if (!hasGrades || !ready || loading || offeringsByCourseNorm.size === 0) return [];
    const index = buildCourseSpotlightIndex(offeringsByCourseNorm, getCourseEntryByNorm());
    return spotlightVariants
      .map((variant, i) => ({
        variant,
        courses: rankCoursesForSpotlight(index, variant, 12),
        durationSec: SPOTLIGHT_ROW_DURATIONS_SEC[i] ?? 120,
        reverse: i === 1,
      }))
      .filter((row) => row.courses.length >= SPOTLIGHT_MIN_GALLERY_ITEMS);
  }, [hasGrades, ready, loading, offeringsByCourseNorm, getCourseEntryByNorm, spotlightVariants]);

  const showGallery = hasGrades && !loading && spotlightRows.length > 0;
  const { ref: galleryRef, minHeight: galleryMinHeight } = useFillFirstViewport(showGallery);

  const onSelectCourse = (entry: ExploreCourseSearchEntry) => {
    void navigate({
      to: "/explore/course/$course",
      params: { course: courseNormToPathParam(entry.normCode) },
      search: searchParams,
    });
  };

  if (!hasGrades) return <ExploreDisciplineBrowse searchParams={searchParams} />;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      {showGallery ? (
        // The gallery is bottom-anchored inside a one-viewport-tall block so it
        // keeps filling the first screen now that the faculty index scrolls in
        // below it. The block sits under the ~92px top banner, and the banner is
        // a fixed height (not viewport-relative), so a constant bottom offset
        // keeps the rows fully on-screen at every viewport.
        <div
          ref={galleryRef}
          style={{
            minHeight: galleryMinHeight,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            paddingBottom: 120,
          }}
        >
          <ExploreCourseSpotlightGallery rows={spotlightRows} onSelectCourse={onSelectCourse} />
        </div>
      ) : null}
      <div style={{ paddingInline: EXPLORE_ACCORDION_PAD_INLINE.xs, paddingBottom: 80 }}>
        <ExploreFacultyBrowse searchParams={searchParams} />
      </div>
    </div>
  );
}
