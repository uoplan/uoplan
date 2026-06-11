import type { StateCreator } from "zustand";
import { notifications } from "@mantine/notifications";
import type { AppStore } from "../types";
import {
  buildDataCache,
  buildProfessorRatingsMap,
  buildProfessorRegistry,
  DataProto,
  decodeState,
  decodeStateFromBase64,
  defaultUpcomingTermId,
  enrichSchedulesDataWithGrades,
  fromProtoCatalogue,
  fromProtoCatalogueManifest,
  fromProtoCourseGradesData,
  fromProtoDisciplinesData,
  fromProtoIndices,
  fromProtoProfessorsData,
  fromProtoRateMyProfessorsData,
  fromProtoSchedulesData,
  fromProtoTermsData,
  getGradeLookups,
  parseStateFromUrl,
  peekTermAndYear,
  peekTermAndYearFromBase64,
  urlToSlug,
} from "@uoplan/core";
import type { DataCache, Indices } from "@uoplan/core";
import { getMergedCatalogue } from "./catalogueUtils";
import { fetchProtoBytes, optionalProtoBytes } from "../../lib/protoFetch";
import { dataAssetIds } from "@uoplan/data";
import { buildCacheWithOpt } from "../../lib/dataCacheLoader";
import { recomputeStateForProgram } from "../requirementCompute";
import { LOCAL_STORAGE_KEY } from "../constants";
import { applyHydrationNavigation } from "../../lib/hydrateNavigation";
import { hasPersistedGeneratedSchedule } from "../../lib/seedNavigation";
import { tr } from "../../i18n";
import type { AppServices } from "../services";

const YEAR_CATALOGUE_LOAD_FAILED_TITLE_ID = "notifications.yearCatalogueLoadFailed.title";
const YEAR_CATALOGUE_LOAD_FAILED_MESSAGE_ID = "notifications.yearCatalogueLoadFailed.message";

interface DataSlice {
  loadData: AppStore["loadData"];
  ensureCourseGrades: AppStore["ensureCourseGrades"];
  ensureProfessorRatings: AppStore["ensureProfessorRatings"];
  ensureDisciplines: AppStore["ensureDisciplines"];
  ensureProfessors: AppStore["ensureProfessors"];
  ensureYearCatalogue: AppStore["ensureYearCatalogue"];
  setSelectedTermId: AppStore["setSelectedTermId"];
  setFirstYear: AppStore["setFirstYear"];
  acceptSharedState: AppStore["acceptSharedState"];
  dismissSharedState: AppStore["dismissSharedState"];
}

export const createDataSlice =
  (services: AppServices): StateCreator<AppStore, [], [], DataSlice> =>
  (set, get) => {
    // Closure-scoped in-flight guards so each lazily-loaded asset is fetched at
    // most once even when several routes/hooks request it concurrently. A
    // rejection clears the guard so a transient failure can be retried.
    let bootPromise: Promise<void> | null = null;
    let gradesPromise: Promise<void> | null = null;
    let ratingsPromise: Promise<void> | null = null;
    let disciplinesPromise: Promise<void> | null = null;
    let professorsPromise: Promise<void> | null = null;
    let yearCataloguePromise: Promise<void> | null = null;

    /** Rebuild the effective merged catalogue for the current store state. */
    const effectiveCatalogueFromState = () => {
      const { catalogue, yearCatalogueCourses, completedCourses } = get();
      if (!catalogue) return null;
      return getMergedCatalogue(catalogue, yearCatalogueCourses, completedCourses) ?? catalogue;
    };

    const recomputeCurrentProgramState = (cache: DataCache) => {
      const s = get();
      return recomputeStateForProgram(
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
    };

    return {
      setSelectedTermId: async (termId: string) => {
        set({ loading: true, error: null });
        try {
          const { catalogue, yearCatalogueCourses, completedCourses } = get();
          if (!catalogue) throw new Error("Catalogue not loaded");

          const schedulesBytes = await fetchProtoBytes(dataAssetIds.schedules(termId));
          const parsedSchedulesRaw = fromProtoSchedulesData(
            DataProto.SchedulesData.decode(schedulesBytes),
          );
          const { courseGrades } = get();
          const parsedSchedules = courseGrades
            ? enrichSchedulesDataWithGrades(
                parsedSchedulesRaw,
                getGradeLookups(courseGrades),
                Number(termId),
              )
            : parsedSchedulesRaw;
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

          const full = recomputeCurrentProgramState(cache);

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
            const bytes = await fetchProtoBytes(dataAssetIds.catalogue(year));
            const parsed = fromProtoCatalogue(DataProto.Catalogue.decode(bytes));
            set({
              yearCataloguePrograms: parsed.programs,
              yearCatalogueCourses: parsed.courses,
              yearCatalogueLoading: false,
            });
            const { schedulesData, completedCourses } = get();
            const effectiveCatalogue = getMergedCatalogue(
              catalogue,
              parsed.courses,
              completedCourses,
            );
            if (effectiveCatalogue && schedulesData) {
              const cache = buildCacheWithOpt(effectiveCatalogue, schedulesData, completedCourses);
              set({ cache });
            }
          }
        } catch (err) {
          set({ yearCatalogueLoading: false });
          // oxlint-disable-next-line no-console -- intentional error logging for catalogue load failures
          console.error("Failed to load year catalogue:", err);
          notifications.show({
            color: "red",
            title: tr(YEAR_CATALOGUE_LOAD_FAILED_TITLE_ID),
            message: tr(YEAR_CATALOGUE_LOAD_FAILED_MESSAGE_ID),
          });
        }
        get().setProgram(null);
      },

      loadData: async () => {
        if (get().cache) return;
        if (bootPromise) return bootPromise;

        bootPromise = (async () => {
          const LOAD_STEPS = 4;
          let loadStep = 0;
          const bumpLoadProgress = () => {
            loadStep += 1;
            set({ loadProgress: Math.round((loadStep / LOAD_STEPS) * 100) });
          };

          set({ loading: true, error: null, loadProgress: 0 });
          try {
            const [manifestBytes, termsBytes, indicesBytes] = await Promise.all([
              fetchProtoBytes(dataAssetIds.manifest),
              fetchProtoBytes(dataAssetIds.terms),
              optionalProtoBytes(dataAssetIds.indices),
            ]);
            bumpLoadProgress();

            const availableYears = fromProtoCatalogueManifest(
              DataProto.CatalogueManifest.decode(manifestBytes),
            ).years;
            const latestYear = availableYears[0];
            if (!latestYear) throw new Error("Catalogue manifest has no years");

            const catalogueBytes = await fetchProtoBytes(dataAssetIds.catalogue(latestYear));
            bumpLoadProgress();

            const parsedCatalogue = fromProtoCatalogue(DataProto.Catalogue.decode(catalogueBytes));
            const parsedTerms = fromProtoTermsData(DataProto.TermsData.decode(termsBytes));

            let indices: Indices | null = null;
            if (indicesBytes) {
              indices = fromProtoIndices(DataProto.Indices.decode(indicesBytes));
            } else {
              indices = {
                courses: parsedCatalogue.courses.map((c) => c.code),
                programs: parsedCatalogue.programs.map((p) => urlToSlug(p.url)),
                disciplines: [],
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

            // The year-specific catalogue and the optional grade/rating/discipline
            // datasets are loaded lazily by `ensureX` actions — only when a route
            // that needs them mounts. Boot stays lean so the landing page (which
            // never triggers boot) and the planner's first paint are fast.
            const schedulesBytes = await fetchProtoBytes(dataAssetIds.schedules(initialTermId));
            const parsedSchedules = fromProtoSchedulesData(
              DataProto.SchedulesData.decode(schedulesBytes),
            );
            const cache = buildDataCache(parsedCatalogue, parsedSchedules);

            bumpLoadProgress();
            set({
              catalogue: parsedCatalogue,
              indices,
              schedulesData: parsedSchedules,
              cache,
              terms: parsedTerms.terms,
              selectedTermId: initialTermId,
              firstYear: initialFirstYear,
              availableYears,
              loading: false,
              loadProgress: 100,
              error: null,
            });

            if (indices && typeof window !== "undefined") {
              const urlBytes = parseStateFromUrl(window.location.search);
              if (urlBytes && urlBytes.length > 0) {
                const decoded = decodeState(urlBytes, parsedCatalogue, indices);
                // Always strip the ?s= param so a refresh doesn't re-trigger this
                const u = new URL(window.location.href);
                u.searchParams.delete("s");
                u.searchParams.delete("t");
                u.searchParams.delete("f");
                window.history.replaceState({}, "", u.toString());

                if ("error" in decoded) {
                  set({ error: decoded.error });
                } else {
                  const loadSharedState = () => {
                    // Fully replace any existing state first so a leftover program or
                    // requirement selection can't linger and make generation fail for the
                    // shared schedule (it would otherwise generate nothing and error out).
                    get().resetToDefault();
                    get().loadEncodedState(decoded);
                    applyHydrationNavigation(decoded, services.navigation);
                  };

                  const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
                  if (stored) {
                    const existing = decodeStateFromBase64(stored, parsedCatalogue, indices);
                    if (
                      !("error" in existing) &&
                      hasPersistedGeneratedSchedule(existing.firstSeed, existing.currentSeed)
                    ) {
                      // User has an existing generated schedule — ask before replacing it.
                      get().loadEncodedState(existing);
                      applyHydrationNavigation(existing, services.navigation);
                      set({ pendingSharedState: decoded });
                    } else {
                      loadSharedState();
                    }
                  } else {
                    loadSharedState();
                  }
                }
              } else {
                const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
                if (stored) {
                  const decoded = decodeStateFromBase64(stored, parsedCatalogue, indices);
                  if (!("error" in decoded)) {
                    get().loadEncodedState(decoded);
                    window.history.replaceState({}, "");
                    applyHydrationNavigation(decoded, services.navigation);
                  } else {
                    get().resetToDefault();
                  }
                }
              }
            }

            // Now that the restored `firstYear` is known, lazily pull in the
            // year-specific catalogue and recompute requirements against it.
            if (get().firstYear !== null) {
              void get().ensureYearCatalogue();
            }
          } catch (err) {
            bootPromise = null;
            set({
              loading: false,
              loadProgress: 0,
              error: err instanceof Error ? err.message : "Failed to load data",
            });
          }
        })();

        return bootPromise;
      },

      acceptSharedState: () => {
        const pending = get().pendingSharedState;
        if (!pending) return;
        set({ pendingSharedState: null });
        get().loadEncodedState(pending);
        services.navigation.toCalendar({ replace: false });
        const isBasic = pending.wizardMode === "basic";
        set({ calendarMode: isBasic ? "basic" : "advanced" });
        void (isBasic ? get().generateBasicSchedules() : get().generateSchedules());
      },

      dismissSharedState: () => {
        set({ pendingSharedState: null });
      },

      ensureCourseGrades: async () => {
        if (get().courseGrades) return;
        if (gradesPromise) return gradesPromise;
        gradesPromise = (async () => {
          try {
            set({ courseGradesLoading: true });
            const bytes = await optionalProtoBytes(dataAssetIds.grades);
            if (!bytes) {
              set({
                courseGradesLoading: false,
                courseGradesError: "Failed to load grade history",
              });
              return;
            }
            let courseGrades = null;
            let courseGradesError: string | null = null;
            try {
              courseGrades = fromProtoCourseGradesData(DataProto.GradesData.decode(bytes));
            } catch (err) {
              courseGradesError =
                err instanceof Error ? err.message : "Failed to parse grade history";
            }

            // Re-enrich the current term's schedules with the freshly loaded grade
            // distributions and rebuild the cache so the calendar shows them.
            const { schedulesData, selectedTermId } = get();
            if (courseGrades && schedulesData && selectedTermId) {
              const enriched = enrichSchedulesDataWithGrades(
                schedulesData,
                getGradeLookups(courseGrades),
                Number(selectedTermId),
              );
              const effectiveCatalogue = effectiveCatalogueFromState();
              set({
                courseGrades,
                courseGradesError,
                courseGradesLoading: false,
                schedulesData: enriched,
                cache: effectiveCatalogue
                  ? buildCacheWithOpt(effectiveCatalogue, enriched, get().completedCourses)
                  : get().cache,
              });
            } else {
              set({ courseGrades, courseGradesError, courseGradesLoading: false });
            }
          } catch (err) {
            gradesPromise = null;
            set({
              courseGradesLoading: false,
              courseGradesError:
                err instanceof Error ? err.message : "Failed to load grade history",
            });
          }
        })();
        return gradesPromise;
      },

      ensureProfessorRatings: async () => {
        if (get().professorRatings) return;
        if (ratingsPromise) return ratingsPromise;
        ratingsPromise = (async () => {
          try {
            const bytes = await optionalProtoBytes(dataAssetIds.rateMyProfessors);
            if (!bytes) return;
            try {
              const rmpData = fromProtoRateMyProfessorsData(
                DataProto.RateMyProfessorsData.decode(bytes),
              );
              set({ professorRatings: buildProfessorRatingsMap(rmpData) });
            } catch {
              // Ratings are optional; leave them null on a decode failure.
            }
          } catch (err) {
            ratingsPromise = null;
            throw err;
          }
        })();
        return ratingsPromise;
      },

      ensureDisciplines: async () => {
        if (get().disciplines) return;
        if (disciplinesPromise) return disciplinesPromise;
        disciplinesPromise = (async () => {
          try {
            const bytes = await optionalProtoBytes(dataAssetIds.disciplines);
            if (!bytes) return;
            try {
              set({
                disciplines: fromProtoDisciplinesData(DataProto.DisciplinesData.decode(bytes))
                  .disciplines,
              });
            } catch {
              // Disciplines are optional; leave them null on a decode failure.
            }
          } catch (err) {
            disciplinesPromise = null;
            throw err;
          }
        })();
        return disciplinesPromise;
      },

      ensureProfessors: async () => {
        if (get().professors) return;
        if (professorsPromise) return professorsPromise;
        professorsPromise = (async () => {
          try {
            const bytes = await optionalProtoBytes(dataAssetIds.professors);
            if (!bytes) return;
            try {
              set({
                professors: buildProfessorRegistry(
                  fromProtoProfessorsData(DataProto.ProfessorsData.decode(bytes)),
                ),
              });
            } catch {
              // Registry is optional; leave it null on a decode failure.
            }
          } catch (err) {
            professorsPromise = null;
            throw err;
          }
        })();
        return professorsPromise;
      },

      ensureYearCatalogue: async () => {
        const { firstYear, catalogue } = get();
        if (firstYear === null || !catalogue) return;
        if (get().yearCatalogueCourses) return;
        if (yearCataloguePromise) return yearCataloguePromise;
        yearCataloguePromise = (async () => {
          try {
            set({ yearCatalogueLoading: true });
            const bytes = await fetchProtoBytes(dataAssetIds.catalogue(firstYear));
            const parsed = fromProtoCatalogue(DataProto.Catalogue.decode(bytes));
            set({
              yearCataloguePrograms: parsed.programs,
              yearCatalogueCourses: parsed.courses,
              yearCatalogueLoading: false,
            });
            // Rebuild the cache + recompute requirement state with the year-specific
            // courses merged in, without clearing the user's program selection.
            const s = get();
            const effectiveCatalogue = getMergedCatalogue(
              s.catalogue ?? catalogue,
              parsed.courses,
              s.completedCourses,
            );
            if (effectiveCatalogue && s.schedulesData) {
              const cache = buildCacheWithOpt(
                effectiveCatalogue,
                s.schedulesData,
                s.completedCourses,
              );
              const full = recomputeCurrentProgramState(cache);
              set({ cache, ...full });
            }
          } catch (err) {
            yearCataloguePromise = null;
            set({ yearCatalogueLoading: false });
            throw err;
          }
        })();
        return yearCataloguePromise;
      },
    };
  };
