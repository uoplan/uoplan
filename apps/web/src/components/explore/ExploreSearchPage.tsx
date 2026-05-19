import { useNavigate } from "@tanstack/react-router";
import { useLingui } from "@lingui/react";
import { useMemo, useState } from "react";
import type { Catalogue, Term } from "schedule";
import { normalizeCourseCode } from "schedule";
import { useCourseGradesPb } from "../../hooks/useCourseGradesPb";
import {
  buildCourseSpotlightIndex,
  pickSpotlightVariants,
  rankCoursesForSpotlight,
  SPOTLIGHT_MIN_GALLERY_ITEMS,
  SPOTLIGHT_ROW_DURATIONS_SEC,
} from "../../lib/explore/courseSpotlight";
import {
  buildExploreOfferings,
  type ExploreCourseSearchEntry,
} from "../../lib/explore/gradesSearch";
import { courseNormToPathParam } from "../../lib/explore/courseSearchParams";
import { ExploreCourseSpotlightGallery } from "./ExploreCourseSpotlightGallery";

function buildTitleByCode(catalogue: Catalogue | null): Map<string, string> {
  const m = new Map<string, string>();
  if (!catalogue) return m;
  for (const c of catalogue.courses) m.set(normalizeCourseCode(c.code), c.title);
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

export function ExploreSearchPage({
  catalogue,
  terms,
}: {
  catalogue: Catalogue | null;
  terms: Term[];
}) {
  useLingui();
  const { loading, data: grades } = useCourseGradesPb();
  const navigate = useNavigate();
  const [spotlightVariants] = useState(() => pickSpotlightVariants(3));

  const titleByCode = useMemo(() => buildTitleByCode(catalogue), [catalogue]);
  const termNameById = useMemo(() => buildTermNameById(terms), [terms]);

  const offerings = useMemo(() => {
    if (!grades) return [];
    return buildExploreOfferings(grades, titleByCode, termNameById);
  }, [grades, titleByCode, termNameById]);

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
      search: { q: undefined },
    });
  };

  return !loading && spotlightRows.length > 0 ? (
    <div style={{ marginTop: "auto", paddingBottom: 32 }}>
      <ExploreCourseSpotlightGallery rows={spotlightRows} onSelectCourse={onSelectCourse} />
    </div>
  ) : null;
}
