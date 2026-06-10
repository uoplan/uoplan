import type { ReactNode } from "react";
import type { Catalogue, ProfessorRatingsMap, ProfessorRegistry } from "@uoplan/core";
import { useExploreOfferingsValue } from "./useExploreOfferingsValue";
import { ExploreOfferingsContext } from "./exploreOfferingsContext";

export function ExploreOfferingsProvider({
  catalogue,
  professorRatings,
  registry,
  children,
}: {
  catalogue: Catalogue | null;
  professorRatings: ProfessorRatingsMap | null;
  registry: ProfessorRegistry | null;
  children: ReactNode;
}) {
  const value = useExploreOfferingsValue(catalogue, professorRatings, registry);

  return (
    <ExploreOfferingsContext.Provider value={value}>{children}</ExploreOfferingsContext.Provider>
  );
}
