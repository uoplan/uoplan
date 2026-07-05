import type { SchedulesData } from "@uoplan/core/dataTypes";
import { type AliasGroups, buildAliasGroups } from "@uoplan/core/courseAlias";
import { buildFeedbackIndex, type FeedbackIndex } from "@uoplan/core/feedback";
import type { FetchBytes } from "@uoplan/data/transport";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { planDataAssets } from "./asset-plan";
import { BUNDLED_DATA_MANIFEST, createBundledDataTransport } from "./bundled-data";
import { type DataAssetManifest } from "./manifest";
import {
  createTransportForManifest,
  loadAssetManifest,
  readKnownGoodManifest,
  writeKnownGoodManifest,
} from "./data-client";
import { loadAppDataWithFallback } from "./load-with-fallback";
import {
  decodeCatalogue,
  decodeCatalogueManifest,
  decodeCourseSearchIndex,
  decodeDisciplines,
  decodeFeedbackData,
  decodeGrades,
  decodeIndicesCourses,
  decodeProfessors,
  decodeProfessorRatings,
  decodeSchedules,
  decodeTerms,
} from "./decode";
import { type AppDataBundle, buildExploreIndex, type ExploreIndex } from "./explore-index";
import {
  buildOverview,
  buildRisers,
  courseGradeBandSeries,
  courseProfessorSpread,
  courseSeasonComparison,
  courseTermSeries,
  disciplineGpa,
  disciplineCourseScatter,
  type DisciplineHeatmap,
  disciplineHeatmap,
  disciplineLevelComparison,
  overallTermSeries,
  type Riser,
  seasonGpa,
  type SeriesPoint,
  type TrendsOverview,
} from "./trends-data";

/** Asset ids prefetched (bytes cached for offline) but not eagerly decoded. */
function deferredAssetIds(manifest: DataAssetManifest, eager: Set<string>): string[] {
  return Object.keys(manifest).filter((id) => !eager.has(id));
}

export interface AppData {
  bundle: AppDataBundle;
  index: ExploreIndex;
  schedulesByTerm: Map<string, SchedulesData>;
  feedback: FeedbackIndex;
  aliasGroups: AliasGroups;
  /** Every catalogue year published in the manifest (`catalogue.<year>.pb`). */
  catalogueYears: number[];
}

/**
 * Downloads + decodes every asset a manifest points at into the runtime {@link
 * AppData}, then kicks off a background prefetch of the remaining (deferred)
 * assets so their bytes are cached for offline use. Rejects if any eager asset
 * fails to decode (e.g. an incompatible proto format) — the caller
 * ({@link loadAppDataWithFallback}) turns that into a known-good fallback.
 */
async function buildAppData(manifest: DataAssetManifest, fetchBytes: FetchBytes): Promise<AppData> {
  const load = async <T,>(id: string, decode: (b: Uint8Array) => T): Promise<T> =>
    decode(await fetchBytes(id));

  const plan = planDataAssets(Object.keys(manifest));

  const [termsData, disciplinesData, grades, professors, ratings, catalogueManifest] =
    await Promise.all([
      load("terms.pb", decodeTerms),
      load("disciplines.pb", decodeDisciplines),
      load("grades.pb", decodeGrades),
      load("professors.pb", decodeProfessors),
      load("ratemyprofessors.pb", decodeProfessorRatings),
      load("catalogue.pb", decodeCatalogueManifest),
    ]);

  const latestYear =
    catalogueManifest.years.length > 0
      ? Math.max(...catalogueManifest.years)
      : plan.latestCatalogueYear;
  if (latestYear == null) throw new Error("No catalogue years available in the data manifest");

  const catalogueYears =
    catalogueManifest.years.length > 0 ? catalogueManifest.years : plan.catalogueYears;

  // The single union catalogue carries every course ever published with its
  // latest metadata (replacing the per-year `catalogue.<year>.pb` files). Native
  // always uses the latest prerequisites, so it never needs the history overlay.
  const catalogue = await load("catalogue.union.pb", decodeCatalogue);

  const [feedbackData, indicesCourses] = await Promise.all([
    load("feedback.pb", decodeFeedbackData),
    load("indices.pb", decodeIndicesCourses),
  ]);
  const feedback = buildFeedbackIndex(feedbackData, indicesCourses);

  // Best-effort: the compact BM25 description index is a secondary search signal,
  // so a missing/incompatible `catalogue.search.pb` disables description search
  // rather than failing the whole load.
  const descriptionIndexPromise = load("catalogue.search.pb", decodeCourseSearchIndex).catch(
    () => null,
  );

  const schedulesByTerm = new Map<string, SchedulesData>();
  await Promise.all(
    plan.scheduleTermIds.map(async (termId) => {
      schedulesByTerm.set(termId, await load(`schedules.${termId}.pb`, decodeSchedules));
    }),
  );

  const bundle: AppDataBundle = {
    terms: termsData.terms,
    disciplines: disciplinesData.disciplines,
    faculties: disciplinesData.faculties,
    grades,
    catalogue,
    professors,
    ratings,
  };
  const index = buildExploreIndex(bundle, schedulesByTerm, await descriptionIndexPromise);
  const aliasGroups = buildAliasGroups(catalogue);

  // Background: cache remaining catalogue-year + feedback bytes for offline.
  const eager = new Set<string>([
    "terms.pb",
    "disciplines.pb",
    "grades.pb",
    "professors.pb",
    "ratemyprofessors.pb",
    "catalogue.pb",
    "feedback.pb",
    "indices.pb",
    "catalogue.union.pb",
    "catalogue.search.pb",
    ...plan.scheduleTermIds.map((t) => `schedules.${t}.pb`),
  ]);
  void Promise.allSettled(deferredAssetIds(manifest, eager).map((id) => fetchBytes(id)));

  return { bundle, index, schedulesByTerm, feedback, aliasGroups, catalogueYears };
}

type AppDataState =
  | { status: "loading" }
  | { status: "error"; error: Error }
  | { status: "ready"; data: AppData };

interface AppDataContextValue {
  state: AppDataState;
  reload: () => void;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

/**
 * Loads ALL `.pb` data up front (terms, disciplines, grades, professors,
 * ratings, the newest catalogue, and every schedule term), builds the explore
 * search index, and exposes it to the app. Older catalogue years + feedback are
 * prefetched in the background so their bytes are cached for offline use. The
 * app renders a pulsating-logo loading screen until `status === "ready"`.
 *
 * If the freshest published dataset fails to decode (typically a proto-format
 * change shipped ahead of an app update), the provider falls back to the last
 * **known-good** snapshot rather than erroring out — better to show slightly
 * stale data than nothing (see {@link loadAppDataWithFallback}).
 */
export function AppDataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppDataState>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => {
    setState({ status: "loading" });
    setReloadKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    loadAppDataWithFallback<DataAssetManifest, AppData>({
      loadManifest: () => loadAssetManifest(),
      build: (manifest) => buildAppData(manifest, createTransportForManifest(manifest)),
      buildBundled: () => buildAppData(BUNDLED_DATA_MANIFEST, createBundledDataTransport()),
      readKnownGood: readKnownGoodManifest,
      writeKnownGood: writeKnownGoodManifest,
      sameManifest: (a, b) => JSON.stringify(a) === JSON.stringify(b),
      onFallback: (err) => {
        console.warn("[data] fresh dataset failed to decode; serving last known-good data", err);
      },
      onBundledFallback: (err) => {
        console.warn("[data] live and known-good data failed; serving bundled fallback data", err);
      },
    })
      .then((data) => {
        if (cancelled) return;
        setState({ status: "ready", data });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({ status: "error", error: err instanceof Error ? err : new Error(String(err)) });
      });

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const value = useMemo<AppDataContextValue>(() => ({ state, reload }), [state, reload]);

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

/** Full provider state (status + data/error) and a reload trigger. */
export function useAppDataState(): AppDataContextValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppDataState must be used within <AppDataProvider>");
  return ctx;
}

/**
 * The loaded app data. Throws if called before `status === "ready"` — only use
 * it from screens that render under the provider's ready gate.
 */
export function useAppData(): AppData {
  const { state } = useAppDataState();
  if (state.status !== "ready") {
    throw new Error("useAppData called before data finished loading");
  }
  return state.data;
}

/** Convenience accessor for the explore search index. */
export function useExploreIndex(): ExploreIndex {
  return useAppData().index;
}

/** Convenience accessor for the course-feedback (student-evaluation) index. */
export function useFeedback(): FeedbackIndex {
  return useAppData().feedback;
}

export interface TrendsData {
  overview: TrendsOverview;
  overallTermSeries: SeriesPoint[];
  disciplineGpa: SeriesPoint[];
  seasonGpa: ReturnType<typeof seasonGpa>;
  risers: Riser[];
  /** Discipline × year GPA heatmap (cross-discipline drift over time). */
  disciplineHeatmap: DisciplineHeatmap;
  /** Real graded courses (code/title/distribution) for leaderboard + chips. */
  courses: { code: string; title: string; distribution: Record<string, number>; graded: number }[];
  termSeriesFor: (code: string) => SeriesPoint[];
  gradeBandFor: (code: string) => ReturnType<typeof courseGradeBandSeries>;
  seasonComparisonFor: (code: string) => ReturnType<typeof courseSeasonComparison>;
  levelComparisonFor: (code: string) => ReturnType<typeof disciplineLevelComparison>;
  volumeGpaScatterFor: (code: string) => ReturnType<typeof disciplineCourseScatter>;
  professorSpreadFor: (code: string) => ReturnType<typeof courseProfessorSpread>;
}

/**
 * Trends dashboard view-models derived from the live grades dataset via the
 * shared `@uoplan/core/gradeTrends` analytics. Memoised over the loaded bundle.
 */
export function useTrends(): TrendsData {
  const { bundle, index } = useAppData();
  return useMemo(() => {
    const grades = bundle.grades;
    const nameByDiscipline = new Map(bundle.disciplines.map((d) => [d.code, d.name] as const));
    const courses = index.courses
      .filter((c) => c.graded > 0)
      .map((c) => ({
        code: c.code,
        title: c.title,
        distribution: c.distribution,
        graded: c.graded,
      }));
    return {
      overview: buildOverview(grades),
      overallTermSeries: overallTermSeries(grades),
      disciplineGpa: disciplineGpa(grades),
      seasonGpa: seasonGpa(grades),
      risers: buildRisers(grades, nameByDiscipline),
      disciplineHeatmap: disciplineHeatmap(grades),
      courses,
      termSeriesFor: (code: string) => courseTermSeries(grades, code),
      gradeBandFor: (code: string) => courseGradeBandSeries(grades, code),
      seasonComparisonFor: (code: string) => courseSeasonComparison(grades, code),
      levelComparisonFor: (code: string) => disciplineLevelComparison(grades, code),
      volumeGpaScatterFor: (code: string) => disciplineCourseScatter(grades, code),
      professorSpreadFor: (code: string) => courseProfessorSpread(grades, code),
    };
  }, [bundle, index]);
}
