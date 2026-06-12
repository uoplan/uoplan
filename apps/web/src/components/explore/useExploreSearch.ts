import { useNavigate, useSearch } from "@tanstack/react-router";
import { useDebouncedValue } from "@mantine/hooks";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  hasActiveFilters,
  parseExploreFiltersSearch,
  serializeExploreFiltersSearch,
} from "../../lib/explore/exploreFilters";
import type { ExploreFilterState, ExploreSearchParams } from "../../lib/explore/exploreFilters";

/** Stable value-signature of a filter state, used to detect when the URL params
 * have caught up to a navigation we initiated ourselves. */
function filterStateKey(filters: ExploreFilterState): string {
  return JSON.stringify(serializeExploreFiltersSearch(filters));
}

function buildSearchParams(
  nextFilters: ExploreFilterState,
  nextQuery: string,
): ExploreSearchParams {
  const params = serializeExploreFiltersSearch(nextFilters);
  const trimmed = nextQuery.trim();
  return {
    q: trimmed.length > 0 ? trimmed : undefined,
    levels: params.levels ?? undefined,
    langs: params.langs ?? undefined,
    disc: params.disc ?? undefined,
    difficulty: params.difficulty ?? undefined,
    rating: params.rating ?? undefined,
    feedback: params.feedback ?? undefined,
    term: params.term ?? undefined,
    sort: params.sort ?? undefined,
    dir: params.dir ?? undefined,
  };
}

export function useExploreSearch(onIndex: boolean) {
  const navigate = useNavigate();
  const searchParams = useSearch({ from: "/explore" });
  const parsedFilters = useMemo(
    () => parseExploreFiltersSearch(searchParams ?? {}),
    [searchParams],
  );
  const [query, setQueryState] = useState(searchParams.q ?? "");
  const [debouncedQuery] = useDebouncedValue(query, 120);
  const [filters, setFilters] = useState<ExploreFilterState>(parsedFilters);
  const [searchEngaged, setSearchEngaged] = useState(onIndex);

  // Latest intended filter state, updated synchronously on every change so
  // rapid successive edits merge against fresh values rather than the lagging
  // `filters` state / URL params.
  const filtersRef = useRef(filters);
  // Navigations update the URL params asynchronously. Record the filter
  // signature we just pushed and ignore param-driven re-syncs until the params
  // catch up to it, so a lagging or intermediate URL state can't clobber newer
  // local edits when the user taps filters in quick succession (the race).
  const pendingFilterKeyRef = useRef<string | null>(null);

  useEffect(() => {
    setQueryState(searchParams.q ?? "");
  }, [searchParams.q]);

  useEffect(() => {
    const incomingKey = filterStateKey(parsedFilters);
    if (pendingFilterKeyRef.current !== null) {
      // Still waiting for our own navigation to land; ignore stale echoes.
      if (incomingKey === pendingFilterKeyRef.current) pendingFilterKeyRef.current = null;
      return;
    }
    filtersRef.current = parsedFilters;
    setFilters(parsedFilters);
  }, [parsedFilters]);

  const handleQueryChange = (value: string) => {
    setQueryState(value);
    setSearchEngaged(true);
    void navigate({
      to: "/explore",
      search: buildSearchParams(filtersRef.current, value),
      replace: onIndex,
    });
  };

  const handleFilterChange = (next: Partial<ExploreFilterState>) => {
    setSearchEngaged(true);
    const updated = { ...filtersRef.current, ...next };
    filtersRef.current = updated;
    pendingFilterKeyRef.current = filterStateKey(updated);
    setFilters(updated);
    void navigate({
      to: "/explore",
      search: buildSearchParams(updated, query),
      replace: onIndex,
    });
  };

  const activeFilters = hasActiveFilters(filters) || filters.sortKey !== "relevance";
  const currentSearchParams = useMemo(() => buildSearchParams(filters, query), [filters, query]);

  return {
    query,
    debouncedQuery,
    filters,
    activeFilters,
    searchEngaged,
    setSearchEngaged,
    currentSearchParams,
    handleQueryChange,
    handleFilterChange,
  };
}
