import type { StateCreator } from "zustand";
import type { AppStore } from "../types";
import {
  type Catalogue,
  type Course,
  DataProto,
  fromProtoCatalogue,
  fromProtoCatalogueManifest,
  fromProtoCourseGradesData,
  fromProtoDisciplinesData,
  fromProtoIndices,
  fromProtoRateMyProfessorsData,
  fromProtoSchedulesData,
  fromProtoTermsData,
  type Discipline,
  type Indices,
  type Program,
  type SchedulesData,
} from "schedule";
import { buildDataCache, normalizeCourseCode, withExtraCourses, isOptCourse } from "schedule";
import { getMergedCatalogue } from "./catalogueUtils";
import { buildProfessorRatingsMap } from "schedule";
import {
  parseStateFromUrl,
  peekTermAndYear,
  peekTermAndYearFromBase64,
  decodeState,
  decodeStateFromBase64,
  urlToSlug,
  defaultUpcomingTermId,
} from "schedule";
import { recomputeStateForProgram } from "../requirementCompute";
import { LOCAL_STORAGE_KEY } from "../constants";
import { applyHydrationNavigation } from "../../lib/hydrateNavigation";

/** Build a DataCache and inject fake entries for any OPT transfer credit codes in completedCourses. */
function buildCacheWithOpt(
  catalogue: Catalogue,
  schedulesData: SchedulesData,
  completedCourses: string[],
) {
  const base = buildDataCache(catalogue, schedulesData);
  const optCodes = completedCourses.map(normalizeCourseCode).filter(isOptCourse);
  if (optCodes.length === 0) return base;
  return withExtraCourses(
    base,
    optCodes.map((code): Course => ({ code, title: code, credits: 3, description: "" })),
  );
}

async function fetchProtoBytes(path: string): Promise<Uint8Array> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  return new Uint8Array(await res.arrayBuffer());
}

interface DataSlice {
  loadData: AppStore["loadData"];
  setSelectedTermId: AppStore["setSelectedTermId"];
  setFirstYear: AppStore["setFirstYear"];
}

export const createDataSlice: StateCreator<AppStore, [], [], DataSlice> = (set, get) => ({
  setSelectedTermId: async (termId: string) => {
    set({ loading: true, error: null });
    try {
      const { catalogue, yearCatalogueCourses, completedCourses } = get();
      if (!catalogue) throw new Error("Catalogue not loaded");

      const schedulesBytes = await fetchProtoBytes(`/data/schedules.${termId}.pb`);
      const parsedSchedules = fromProtoSchedulesData(
        DataProto.SchedulesData.decode(schedulesBytes),
      );
      const effectiveCatalogue = getMergedCatalogue(
        catalogue,
        yearCatalogueCourses,
        completedCourses,
      );
      const cache = buildCacheWithOpt(
        effectiveCatalogue ?? catalogue,
        parsedSchedules,
        completedCourses,
      );

      const s = get();
      const full = recomputeStateForProgram(
        s.program,
        s.minorProgram,
        s.completedCourses,
        cache,
        s.selectedPerRequirement,
        s.selectedOptionsPerRequirement,
        s.levelBuckets,
        s.languageBuckets,
        s.includeClosedComponents,
        s.studentPrograms,
        s.requirementSlotsUserTouched,
      );

      set({
        selectedTermId: termId,
        schedulesData: parsedSchedules,
        cache,
        currentSchedule: null,
        generationError: null,
        currentSwaps: [],
        ...full,
        loading: false,
        error: null,
      });
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : "Failed to load data",
      });
    }
  },

  setFirstYear: async (year) => {
    const { catalogue } = get();
    set({ firstYear: year, yearCatalogueLoading: true });
    try {
      if (year === null) {
        set({
          yearCataloguePrograms: null,
          yearCatalogueCourses: null,
          yearCatalogueLoading: false,
        });
        const { schedulesData, completedCourses: cc } = get();
        if (catalogue && schedulesData) {
          const cache = buildCacheWithOpt(catalogue, schedulesData, cc);
          set({ cache });
        }
      } else {
        const bytes = await fetchProtoBytes(`/data/catalogue.${year}.pb`);
        const parsed = fromProtoCatalogue(DataProto.Catalogue.decode(bytes));
        set({
          yearCataloguePrograms: parsed.programs,
          yearCatalogueCourses: parsed.courses,
          yearCatalogueLoading: false,
        });
        const { schedulesData, completedCourses } = get();
        const effectiveCatalogue = getMergedCatalogue(catalogue, parsed.courses, completedCourses);
        if (effectiveCatalogue && schedulesData) {
          const cache = buildCacheWithOpt(effectiveCatalogue, schedulesData, completedCourses);
          set({ cache });
        }
      }
    } catch (err) {
      set({ yearCatalogueLoading: false });
      console.error("Failed to load year catalogue:", err);
    }
    get().setProgram(null);
  },

  loadData: async () => {
    const LOAD_STEPS = 6;
    let loadStep = 0;
    const bumpLoadProgress = () => {
      loadStep += 1;
      set({ loadProgress: Math.round((loadStep / LOAD_STEPS) * 100) });
    };

    set({ loading: true, error: null, loadProgress: 0 });
    try {
      const [manifestRes, termsRes, indicesRes, rmpRes, gradesRes, disciplinesRes] =
        await Promise.all([
          fetch("/data/catalogue.pb"),
          fetch("/data/terms.pb"),
          fetch("/data/indices.pb").catch(() => null),
          fetch("/data/ratemyprofessors.pb").catch(() => null),
          fetch("/data/grades.pb").catch(() => null),
          fetch("/data/disciplines.pb").catch(() => null),
        ]);
      if (!manifestRes.ok || !termsRes.ok) throw new Error("Failed to load data");
      bumpLoadProgress();

      const manifestBytes = new Uint8Array(await manifestRes.arrayBuffer());
      const availableYears = fromProtoCatalogueManifest(
        DataProto.CatalogueManifest.decode(manifestBytes),
      ).years;
      const latestYear = availableYears[0];
      if (!latestYear) throw new Error("Catalogue manifest has no years");

      const catalogueBytes = await fetchProtoBytes(`/data/catalogue.${latestYear}.pb`);
      bumpLoadProgress();
      const termsBytes = new Uint8Array(await termsRes.arrayBuffer());

      const parsedCatalogue = fromProtoCatalogue(DataProto.Catalogue.decode(catalogueBytes));
      const parsedTerms = fromProtoTermsData(DataProto.TermsData.decode(termsBytes));

      let professorRatings = null;
      if (rmpRes?.ok) {
        try {
          const rmpBytes = new Uint8Array(await rmpRes.arrayBuffer());
          const rmpData = fromProtoRateMyProfessorsData(
            DataProto.RateMyProfessorsData.decode(rmpBytes),
          );
          professorRatings = buildProfessorRatingsMap(rmpData);
        } catch {
          professorRatings = null;
        }
      }

      let courseGrades = null;
      let courseGradesError: string | null = null;
      if (gradesRes?.ok) {
        try {
          const gradesBytes = new Uint8Array(await gradesRes.arrayBuffer());
          courseGrades = fromProtoCourseGradesData(DataProto.GradesData.decode(gradesBytes));
        } catch (err) {
          courseGradesError = err instanceof Error ? err.message : "Failed to parse grade history";
        }
      } else {
        courseGradesError = gradesRes ? `HTTP ${gradesRes.status}` : "Failed to load grade history";
      }
      bumpLoadProgress();

      let disciplines: Discipline[] | null = null;
      if (disciplinesRes?.ok) {
        try {
          const disciplinesBytes = new Uint8Array(await disciplinesRes.arrayBuffer());
          disciplines = fromProtoDisciplinesData(
            DataProto.DisciplinesData.decode(disciplinesBytes),
          ).disciplines;
        } catch {
          disciplines = null;
        }
      }
      bumpLoadProgress();

      let indices: Indices | null = null;
      if (indicesRes?.ok) {
        const indicesBytes = new Uint8Array(await indicesRes.arrayBuffer());
        indices = fromProtoIndices(DataProto.Indices.decode(indicesBytes));
      } else {
        indices = {
          courses: parsedCatalogue.courses.map((c) => c.code),
          programs: parsedCatalogue.programs.map((p) => urlToSlug(p.url)),
        };
      }

      let peekedTermId: string | null = null;
      let peekedFirstYear: number | null = null;
      if (typeof window !== "undefined") {
        const urlBytes = parseStateFromUrl(window.location.search);
        if (urlBytes && urlBytes.length > 0) {
          const peeked = peekTermAndYear(urlBytes);
          if (peeked) {
            peekedTermId = peeked.termId;
            peekedFirstYear = peeked.firstYear;
          }
        } else {
          try {
            const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (stored) {
              const peeked = peekTermAndYearFromBase64(stored);
              if (peeked) {
                peekedTermId = peeked.termId;
                peekedFirstYear = peeked.firstYear;
              }
            }
          } catch {
            // ignore
          }
        }
      }

      const initialTermId =
        peekedTermId ??
        defaultUpcomingTermId(parsedTerms.terms) ??
        parsedTerms.terms[0]?.termId ??
        null;
      if (!initialTermId) throw new Error("No terms available");
      const initialFirstYear = peekedFirstYear;
      bumpLoadProgress();

      let yearCataloguePrograms: Program[] | null = null;
      let yearCatalogueCourses: Course[] | null = null;
      if (initialFirstYear !== null) {
        try {
          const yearRes = await fetch(`/data/catalogue.${initialFirstYear}.pb`);
          if (yearRes.ok) {
            const yearBytes = new Uint8Array(await yearRes.arrayBuffer());
            const parsedYear = fromProtoCatalogue(DataProto.Catalogue.decode(yearBytes));
            yearCataloguePrograms = parsedYear.programs;
            yearCatalogueCourses = parsedYear.courses;
          }
        } catch {
          // ignore
        }
      }

      const schedulesBytes = await fetchProtoBytes(`/data/schedules.${initialTermId}.pb`);
      const parsedSchedules = fromProtoSchedulesData(
        DataProto.SchedulesData.decode(schedulesBytes),
      );
      const effectiveCatalogue = getMergedCatalogue(parsedCatalogue, yearCatalogueCourses, []);
      const cache = buildDataCache(effectiveCatalogue ?? parsedCatalogue, parsedSchedules);

      bumpLoadProgress();
      set({
        catalogue: parsedCatalogue,
        indices,
        schedulesData: parsedSchedules,
        cache,
        courseGrades,
        courseGradesError,
        disciplines,
        professorRatings,
        terms: parsedTerms.terms,
        selectedTermId: initialTermId,
        firstYear: initialFirstYear,
        yearCataloguePrograms,
        yearCatalogueCourses,
        availableYears,
        loading: false,
        loadProgress: 100,
        error: null,
      });

      if (indices && typeof window !== "undefined") {
        const urlBytes = parseStateFromUrl(window.location.search);
        if (urlBytes && urlBytes.length > 0) {
          const decoded = decodeState(urlBytes, parsedCatalogue, indices);
          if ("error" in decoded) {
            set({ error: decoded.error });
          } else {
            get().loadEncodedState(decoded);
            const u = new URL(window.location.href);
            u.searchParams.delete("s");
            u.searchParams.delete("t");
            u.searchParams.delete("f");
            window.history.replaceState({}, "", u.toString());
            applyHydrationNavigation(decoded, get);
          }
        } else {
          const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
          if (stored) {
            const decoded = decodeStateFromBase64(stored, parsedCatalogue, indices);
            if (!("error" in decoded)) {
              get().loadEncodedState(decoded);
              window.history.replaceState({}, "");
              applyHydrationNavigation(decoded, get);
            } else {
              get().resetToDefault();
            }
          }
        }
      }
    } catch (err) {
      set({
        loading: false,
        loadProgress: 0,
        error: err instanceof Error ? err.message : "Failed to load data",
      });
    }
  },
});
