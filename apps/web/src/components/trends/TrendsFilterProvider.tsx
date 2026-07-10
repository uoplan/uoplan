import { useCallback, useEffect, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import { useMediaQuery } from "@mantine/hooks";
import {
  availableDisciplines,
  availablePrograms,
  buildProgramCourseFilter,
  computeGradeTrends,
  programSlug,
} from "@uoplan/core";
import type { TermSeason } from "@uoplan/core";
import { i18n } from "@lingui/core";
import { tr } from "../../i18n";
import { useCourseGradesPb } from "../../hooks/useCourseGradesPb";
import { useCatalogue, useDisciplines } from "@uoplan/store/hooks";
import { createRankedOptionsFilter } from "../../lib/explore/optionRanking";
import { formatMetricValue } from "../../lib/trends/metrics";
import type { TrendsMetric, TrendsSearch } from "../../lib/trends/searchParams";
import type { TrendsCardContext } from "./cardContext";
import { TrendsContext } from "./trendsContext";
import type { TrendsContextValue } from "./trendsContext";

type TrendsFilterProviderProps = {
  search: TrendsSearch;
  onChange: (next: TrendsSearch) => void;
  children: ReactNode;
};

/**
 * Computes the data + filter state shared by every `/trends` page (hub and
 * sub-routes) and exposes it via {@link useTrends}. Centralising it here keeps
 * the filter bar, scope summary, and chart context consistent across routes.
 */
export function TrendsFilterProvider({ search, onChange, children }: TrendsFilterProviderProps) {
  const { data: grades, error: gradesError } = useCourseGradesPb();
  const disciplines = useDisciplines();
  const catalogue = useCatalogue();
  const isFr = i18n.locale.startsWith("fr");
  const isMobile = useMediaQuery("(max-width: 768px)", false, {
    getInitialValueInEffect: false,
  });

  const discipline = search.discipline ?? null;
  const level = search.level ?? null;
  const season = (search.season as TermSeason | undefined) ?? null;
  const programSlugValue = search.program ?? null;

  const metricOptions = useMemo(
    () => [
      { value: "gpa" as TrendsMetric, label: tr("trends.metric.gpa") },
      { value: "a-plus" as TrendsMetric, label: tr("trends.metric.aPlus") },
      { value: "a-range" as TrendsMetric, label: tr("trends.metric.aRange") },
      { value: "pass" as TrendsMetric, label: tr("trends.metric.pass") },
      { value: "volume" as TrendsMetric, label: tr("trends.metric.volume") },
    ],
    [],
  );

  const activeMetric: TrendsMetric =
    metricOptions.find((m) => m.value === search.metric)?.value ?? "gpa";
  const metricLabel = metricOptions.find((m) => m.value === activeMetric)?.label ?? "";

  const levelData = useMemo(
    () => [
      { value: "all", label: tr("trends.filter.all") },
      { value: "1000", label: "1000" },
      { value: "2000", label: "2000" },
      { value: "3000", label: "3000" },
      { value: "4000", label: "4000" },
    ],
    [],
  );
  const seasonData = useMemo(
    () => [
      { value: "all", label: tr("trends.filter.all") },
      { value: "fall", label: tr("trends.season.fall") },
      { value: "winter", label: tr("trends.season.winter") },
      { value: "springSummer", label: tr("trends.season.springSummer") },
    ],
    [],
  );

  const disciplineNameByCode = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of disciplines ?? []) {
      map.set(d.code, isFr ? (d.nameFr ?? d.name) : d.name);
    }
    return map;
  }, [disciplines, isFr]);

  const disciplineOptions = useMemo(() => {
    if (!grades) return [];
    return availableDisciplines(grades).map((entry) => {
      const name = disciplineNameByCode.get(entry.discipline);
      return {
        value: entry.discipline,
        label: name ? `${entry.discipline} · ${name}` : entry.discipline,
      };
    });
  }, [grades, disciplineNameByCode]);

  const disciplineOptionsFilter = useMemo(
    () =>
      createRankedOptionsFilter((option) => ({
        code: option.value,
        text: disciplineNameByCode.get(option.value) ?? "",
      })),
    [disciplineNameByCode],
  );

  const programOptions = useMemo(() => {
    if (!grades || !catalogue) return [];
    return availablePrograms(grades, catalogue.programs).map((p) => ({
      value: p.slug,
      label: p.title,
    }));
  }, [grades, catalogue]);

  const programFilter = useMemo(() => {
    if (!programSlugValue || !catalogue) return null;
    const program = catalogue.programs.find((p) => programSlug(p) === programSlugValue);
    return program ? buildProgramCourseFilter(program) : null;
  }, [programSlugValue, catalogue]);

  const points = useMemo(() => {
    if (!grades) return [];
    return computeGradeTrends(grades, { discipline, level, season, programFilter }).points;
  }, [grades, discipline, level, season, programFilter]);

  const filteredMode = programFilter != null || discipline != null;

  const cardContext = useMemo<TrendsCardContext | null>(() => {
    if (!grades) return null;
    return {
      grades,
      discipline,
      level,
      season,
      programFilter,
      metric: activeMetric,
      metricLabel,
    };
  }, [grades, discipline, level, season, programFilter, activeMetric, metricLabel]);

  // The `search` prop is derived from URL params, which update asynchronously
  // after a navigate. Merging patches against the prop drops changes when the
  // user toggles filters faster than the router commits each navigation (the
  // second patch reads stale params and overwrites the first). Track the latest
  // intended search in a ref so successive `update` calls accumulate, while
  // still adopting the prop when it changes externally (back/forward, route
  // changes).
  const searchRef = useRef<TrendsSearch>(search);
  useEffect(() => {
    searchRef.current = search;
  }, [search]);

  const update = useCallback(
    (patch: Partial<TrendsSearch>) => {
      const next: Record<string, unknown> = { ...searchRef.current, ...patch };
      for (const key of Object.keys(next)) {
        const value = next[key];
        if (value == null || value === "" || value === "all") delete next[key];
      }
      searchRef.current = next as TrendsSearch;
      onChange(next as TrendsSearch);
    },
    [onChange],
  );

  const scopeSummary = useMemo(() => {
    const parts: string[] = [];
    if (programSlugValue) {
      parts.push(
        programOptions.find((p) => p.value === programSlugValue)?.label ?? programSlugValue,
      );
    } else if (discipline) {
      parts.push(discipline);
    }
    if (level) parts.push(String(level));
    if (season) parts.push(seasonData.find((s) => s.value === season)?.label ?? season);
    return parts.length > 0 ? parts.join(" · ") : tr("trends.filter.allDisciplines");
  }, [programSlugValue, programOptions, discipline, level, season, seasonData]);

  const activeFilterCount =
    (programSlugValue || discipline ? 1 : 0) + (level ? 1 : 0) + (season ? 1 : 0);

  const value = useMemo<TrendsContextValue>(
    () => ({
      grades: grades ?? null,
      gradesError: gradesError ?? null,
      ready: Boolean(grades) && disciplineOptions.length > 0,
      isMobile,
      isFr,
      search,
      update,
      discipline,
      level,
      season,
      programSlugValue,
      programFilter,
      activeMetric,
      metricLabel,
      metricOptions,
      disciplineOptions,
      programOptions,
      disciplineOptionsFilter,
      disciplineNameByCode,
      levelData,
      seasonData,
      points,
      cardContext,
      filteredMode,
      scopeSummary,
      activeFilterCount,
      formatMetric: formatMetricValue,
    }),
    [
      grades,
      gradesError,
      disciplineOptions,
      isMobile,
      isFr,
      search,
      update,
      discipline,
      level,
      season,
      programSlugValue,
      programFilter,
      activeMetric,
      metricLabel,
      metricOptions,
      programOptions,
      disciplineOptionsFilter,
      disciplineNameByCode,
      levelData,
      seasonData,
      points,
      cardContext,
      filteredMode,
      scopeSummary,
      activeFilterCount,
    ],
  );

  return <TrendsContext.Provider value={value}>{children}</TrendsContext.Provider>;
}
