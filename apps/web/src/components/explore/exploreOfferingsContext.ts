import { createContext, useContext } from "react";
import type { ExploreOfferingsValue } from "./useExploreOfferingsValue";

type ExploreOfferingsCtx = ExploreOfferingsValue;

export const ExploreOfferingsContext = createContext<ExploreOfferingsCtx>({
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

export function useExploreOfferings(): ExploreOfferingsCtx {
  return useContext(ExploreOfferingsContext);
}
