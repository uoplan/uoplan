import { useNavigate } from "@tanstack/react-router";
import { useLingui } from "@lingui/react";
import { useMemo, useState } from "react";
import type { Catalogue } from "@uoplan/core";
import { normalizeCourseCode } from "@uoplan/core";
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

function buildTitleByCode(catalogue: Catalogue | null): Map<string, string> {
  const m = new Map<string, string>();
  if (!catalogue) return m;
  for (const c of catalogue.courses) m.set(normalizeCourseCode(c.code), c.title);
  return m;
}

export function ExploreSearchPage({
  catalogue,
  searchParams,
}: {
  catalogue: Catalogue | null;
  searchParams: ExploreSearchParams;
}) {
  useLingui();
  const { loading, offerings } = useExploreOfferings();
  const navigate = useNavigate();
  const [spotlightVariants] = useState(() => pickSpotlightVariants(3));

  const titleByCode = useMemo(() => buildTitleByCode(catalogue), [catalogue]);

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
