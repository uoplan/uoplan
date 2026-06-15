import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "../appStore";

/** Terms list + the selected term id, with the (async) term switcher. */
export function useTermSelection() {
  const { terms, selectedTermId } = useAppStore(
    useShallow((s) => ({ terms: s.terms, selectedTermId: s.selectedTermId })),
  );
  const setSelectedTermId = useAppStore((s) => s.setSelectedTermId);
  return { terms, selectedTermId, setSelectedTermId };
}

/** Just the terms list — cheap single-field read. */
export function useTerms() {
  return useAppStore((s) => s.terms);
}

/**
 * Year-specific catalogue selection (first program year) plus its lazily-loaded
 * programs/courses and loading flag.
 */
export function useYearCatalogue() {
  const reads = useAppStore(
    useShallow((s) => ({
      availableYears: s.availableYears,
      firstYear: s.firstYear,
      yearCataloguePrograms: s.yearCataloguePrograms,
      yearCatalogueCourses: s.yearCatalogueCourses,
      yearCatalogueLoading: s.yearCatalogueLoading,
    })),
  );
  const setFirstYear = useAppStore((s) => s.setFirstYear);
  const ensureYearCatalogue = useAppStore((s) => s.ensureYearCatalogue);
  return { ...reads, setFirstYear, ensureYearCatalogue };
}
