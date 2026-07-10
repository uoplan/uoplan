import { createContext, useContext } from "react";
import { EMPTY_EXPLORE_DELIVERY_PRESENCE } from "../../lib/explore/deliveryMode";
import type { ExploreOfferingsValue } from "./useExploreOfferingsValue";

type ExploreOfferingsCtx = ExploreOfferingsValue;

const NOOP_RETRY = () => {};

export const ExploreOfferingsContext = createContext<ExploreOfferingsCtx>({
  offerings: [],
  loading: true,
  schedulesLoading: true,
  schedulesError: null,
  retrySchedules: NOOP_RETRY,
  deliveryPresence: EMPTY_EXPLORE_DELIVERY_PRESENCE,
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
