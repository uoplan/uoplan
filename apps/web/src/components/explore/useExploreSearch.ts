import { useNavigate, useSearch } from "@tanstack/react-router";
import { useDebouncedValue } from "@mantine/hooks";
import { useEffect, useMemo, useState } from "react";
import {
  hasActiveFilters,
  parseExploreFiltersSearch,
  serializeExploreFiltersSearch,
  type ExploreFilterState,
  type ExploreSearchParams,
} from "../../lib/explore/exploreFilters";

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

  useEffect(() => {
    setQueryState(searchParams.q ?? "");
  }, [searchParams.q]);

  useEffect(() => {
    setFilters(parsedFilters);
  }, [parsedFilters]);

  const handleQueryChange = (value: string) => {
    setQueryState(value);
    setSearchEngaged(true);
    void navigate({
      to: "/explore",
      search: buildSearchParams(filters, value) as any,
      replace: onIndex,
    });
  };

  const handleFilterChange = (next: Partial<ExploreFilterState>) => {
    setSearchEngaged(true);
    setFilters((prev) => {
      const updated = { ...prev, ...next };
      void navigate({
        to: "/explore",
        search: buildSearchParams(updated, query) as any,
        replace: onIndex,
      });
      return updated;
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
