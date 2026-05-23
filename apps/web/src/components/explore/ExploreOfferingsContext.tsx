import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Catalogue, Term } from "@uoplan/schedule";
import { normalizeCourseCode } from "@uoplan/schedule";
import { useCourseGradesPb } from "../../hooks/useCourseGradesPb";
import { useAllSchedulesData } from "../../hooks/useAllSchedulesData";
import {
  buildExploreOfferings,
  buildScheduleOfferings,
  mergeOfferingsWithSchedule,
  type ExploreOfferingFlat,
} from "../../lib/explore/gradesSearch";

type ExploreOfferingsCtx = {
  offerings: ExploreOfferingFlat[];
  loading: boolean;
};

const ExploreOfferingsContext = createContext<ExploreOfferingsCtx>({
  offerings: [],
  loading: true,
});

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

export function ExploreOfferingsProvider({
  catalogue,
  terms,
  children,
}: {
  catalogue: Catalogue | null;
  terms: Term[];
  children: ReactNode;
}) {
  const { loading, data: grades } = useCourseGradesPb();
  const allSchedules = useAllSchedulesData();

  const titleByCode = useMemo(() => buildTitleByCode(catalogue), [catalogue]);
  const termNameById = useMemo(() => buildTermNameById(terms), [terms]);

  const offerings = useMemo(() => {
    const gradeOfferings = grades ? buildExploreOfferings(grades, titleByCode, termNameById) : [];
    if (allSchedules.length === 0) return gradeOfferings;
    const scheduleOfferings = buildScheduleOfferings(allSchedules, termNameById, titleByCode);
    return mergeOfferingsWithSchedule(gradeOfferings, scheduleOfferings);
  }, [grades, allSchedules, titleByCode, termNameById]);

  const value = useMemo(() => ({ offerings, loading }), [offerings, loading]);

  return (
    <ExploreOfferingsContext.Provider value={value}>{children}</ExploreOfferingsContext.Provider>
  );
}

export function useExploreOfferings(): ExploreOfferingsCtx {
  return useContext(ExploreOfferingsContext);
}
