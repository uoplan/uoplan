import type { ReactNode } from "react";
import type { Catalogue, ProfessorRatingsMap } from "@uoplan/core";
import { useExploreOfferingsValue } from "./useExploreOfferingsValue";
import { ExploreOfferingsContext } from "./exploreOfferingsContext";

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
