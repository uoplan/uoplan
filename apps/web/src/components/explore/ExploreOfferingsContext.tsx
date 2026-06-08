import { createContext, useContext, type ReactNode } from "react";
import type { Catalogue, ProfessorRatingsMap } from "@uoplan/core";
import { useExploreOfferingsValue, type ExploreOfferingsValue } from "./useExploreOfferingsValue";

type ExploreOfferingsCtx = ExploreOfferingsValue;

const ExploreOfferingsContext = createContext<ExploreOfferingsCtx>({
  offerings: [],
  loading: true,
  offeringsByCourseNorm: new Map(),
  aliasGroups: { componentByNorm: new Map(), membersByComponent: new Map() },
  offeringsByComponent: new Map(),
  getCourseEntries: () => [],
  getCourseEntryByNorm: () => new Map(),
  getProfessorEntries: () => [],
  getTermPresence: () => ({ courseComponentsByTerm: new Map(), profGroupsByTerm: new Map() }),
  getCourseFuse: () => null,
});

export function ExploreOfferingsProvider({
  catalogue,
  professorRatings,
  children,
}: {
  catalogue: Catalogue | null;
  professorRatings: ProfessorRatingsMap | null;
  children: ReactNode;
}) {
  const value = useExploreOfferingsValue(catalogue, professorRatings);

  return (
    <ExploreOfferingsContext.Provider value={value}>{children}</ExploreOfferingsContext.Provider>
  );
}

export function useExploreOfferings(): ExploreOfferingsCtx {
  return useContext(ExploreOfferingsContext);
}
