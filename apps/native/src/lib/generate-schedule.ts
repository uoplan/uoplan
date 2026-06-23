import { scheduleToEvents, type ScheduleSentiment } from "@uoplan/calendar/events";
import type { CalendarEvent } from "@uoplan/calendar/types";
import { buildDataCache, type DataCache } from "@uoplan/core/dataCache";
import type {
  Catalogue,
  CourseGradesData,
  DisciplinesData,
  SchedulesData,
} from "@uoplan/core/dataTypes";
import { enrichSchedulesDataWithGrades, getGradeLookups } from "@uoplan/core/gradeLookup";
import { toProtoCatalogue, toProtoSchedulesData } from "@uoplan/core/dataTypes/schedules";
import {
  buildAdvancedRequest,
  buildBasicRequest,
  mapGenerationResponse,
} from "@uoplan/core/engineBridge";
import { countValidCombosForCourse } from "@uoplan/core/generationDiagnostics";
import { normalizeCourseCode } from "@uoplan/core/utils/courseUtils";
import type { NormalizedCourseCode } from "@uoplan/core/brand";
import { isOptimizationEnabled } from "@uoplan/core";
import type { GeneratedSchedule, GenerationConstraints } from "@uoplan/core";
import type { ProfessorRatingsMap } from "@uoplan/core/professorRatings";
import {
  Catalogue as ProtoCatalogue,
  SchedulesData as ProtoSchedulesData,
} from "@uoplan/proto/data";
import { GenerationRequest, GenerationResponse } from "@uoplan/proto/engine";

import {
  blockedTimesForScheduleOptions,
  DEFAULT_SCHEDULE_OPTIONS,
  type ScheduleOptions,
} from "@/lib/schedule-options";
import {
  buildAdvancedRequestInputFromPersonalize,
  buildPersonalizeAdvancedRequirements,
  getActiveScheduleRequirementContext,
  type NativeScheduleRequirementContext,
} from "@/lib/personalize-requirements";
import { getBasketCourseStatus } from "@/lib/basket-status";

/** A single generated, conflict-free weekly arrangement of the basket. */
export interface ScheduleVariant {
  events: CalendarEvent[];
  /**
   * The underlying schedule (course → section enrollments). Retained so the
   * calendar-event drawer can compute swap candidates that fit the rest of the
   * timetable without re-deriving sections from the rendered events.
   */
  schedule: GeneratedSchedule;
  courseCount: number;
  fingerprint: string;
}

/** Why a basket course was automatically excluded from generation. */
export type SkippedCourseReason = "prerequisite" | "offering";

/** A basket course excluded from generation, with the reason it was left out. */
export interface SkippedCourse {
  /** The course's display code (e.g. "CSI 2101"). */
  code: string;
  /**
   * `"prerequisite"` — the student doesn't meet the prerequisites yet (given
   * their completed courses: transcript import + personalize "completed
   * courses"). `"offering"` — no schedulable section this term (not offered, all
   * sections filtered out, or outside the time window).
   */
  reason: SkippedCourseReason;
}

/** The result of a generation run: the conflict-free arrangements plus any
 * basket courses that were automatically excluded because they're ineligible
 * (prerequisites unmet) or have no schedulable section this term. */
export interface GenerateScheduleResult {
  variants: ScheduleVariant[];
  /** Basket courses skipped, each with the reason it was left out. */
  skippedCourses: SkippedCourse[];
}

/** The async engine bridge (the native Rust engine module); injected for testability. */
export interface EngineBridge {
  loadDataset(datasetKey: string, catalogue: Uint8Array, schedules: Uint8Array): Promise<void>;
  generate(request: Uint8Array): Promise<Uint8Array>;
}

export interface GenerateScheduleInput {
  /** Stable key identifying the (term) dataset so the engine memoises its load. */
  datasetKey: string;
  catalogue: Catalogue;
  schedules: SchedulesData;
  disciplines: DisciplinesData;
  ratings: ProfessorRatingsMap | null;
  /**
   * Course grades dataset. When provided, sections are enriched with their grade
   * distribution (the runtime equivalent of the build-time enricher) so calendar
   * events carry `gradeViz` — matching the web. Without it events still generate,
   * just with no grade strip.
   */
  grades?: CourseGradesData | null;
  /** Per-course / per-professor satisfaction maps (1-5) for calendar events. */
  sentiment?: ScheduleSentiment | null;
  /** Course codes pinned into every schedule (the basket). */
  basketCodes: string[];
  /**
   * The user's completed courses (transcript + personalize "completed
   * courses"). Used as the prerequisite context when deciding which basket
   * courses to skip, and as the completed-course set for advanced requirements.
   * Separate from {@link basketCodes} — the cart and the completed set are
   * distinct.
   */
  completedCourses?: readonly string[];
  /**
   * Whether the user has given the planner academic grounding — a program
   * selected or a start year picked. Gates prerequisite-based skipping the same
   * way the cart "!" badge does: with no profile context (and no completed
   * courses), a basket course is never skipped for unmet prerequisites — we
   * assume the user knows what they're doing.
   */
  hasProfileContext?: boolean;
  /** Program requirement state from the Personalize wizard. Enables advanced generation. */
  requirements?: NativeScheduleRequirementContext;
  /** User-tunable generation options (time window, avoided days, preferences, …). */
  options?: ScheduleOptions;
  /** Number of distinct arrangements to attempt (seeds 0..N-1). */
  variantCount?: number;
  /**
   * Aborts generation between seeds. The native engine call already in flight
   * can't be interrupted, but a superseded run stops issuing further seeds
   * instead of grinding through all of them (so changing options/basket
   * mid-generation cancels promptly rather than blocking ~20s).
   */
  signal?: AbortSignal;
  /**
   * Called with the running list of unique variants as each new one is found,
   * so the UI can show the first conflict-free timetable immediately instead of
   * waiting for every seed (8 sequential native calls) to finish.
   */
  onVariant?: (variants: ScheduleVariant[], skippedCourses: SkippedCourse[]) => void;
  engine: EngineBridge;
}

// Encoding the full catalogue (~2.6 MB) and building the DataCache are expensive;
// memoise both by object identity so repeated generations from the same loaded
// dataset are cheap.
const cacheMemo = new WeakMap<Catalogue, { schedules: SchedulesData; cache: DataCache }>();
const catalogueBytesMemo = new WeakMap<Catalogue, Uint8Array>();
const schedulesBytesMemo = new WeakMap<SchedulesData, Uint8Array>();
// Enriching schedules with grade distributions is also expensive; memoise the
// result by the raw schedules identity (grades are loaded once per session).
const enrichedMemo = new WeakMap<SchedulesData, SchedulesData>();

/**
 * Enrich the schedules with per-section grade distributions from `grades` (the
 * runtime equivalent of the build-time enricher — see {@link
 * enrichSchedulesDataWithGrades}). Memoised by the raw schedules identity. Used
 * for BOTH the engine dataset and the calendar events so the generated sections
 * carry `gradeViz`. Returns the input unchanged when no grades are supplied.
 */
function enrichedSchedulesFor(
  schedules: SchedulesData,
  grades: CourseGradesData | null | undefined,
): SchedulesData {
  if (!grades) return schedules;
  const hit = enrichedMemo.get(schedules);
  if (hit) return hit;
  const enriched = enrichSchedulesDataWithGrades(
    schedules,
    getGradeLookups(grades),
    Number(schedules.termId),
  );
  enrichedMemo.set(schedules, enriched);
  return enriched;
}

/**
 * Enrich the schedules (memoised) and build/reuse the {@link DataCache} for a
 * term in one call. Exported so the swap-candidate computation reuses the exact
 * dataset (and cache) the generator ran on, instead of rebuilding it.
 */
export function buildScheduleDataCache(
  catalogue: Catalogue,
  rawSchedules: SchedulesData,
  disciplines: DisciplinesData,
  grades: CourseGradesData | null | undefined,
): { schedules: SchedulesData; cache: DataCache } {
  const schedules = enrichedSchedulesFor(rawSchedules, grades);
  return { schedules, cache: dataCacheFor(catalogue, schedules, disciplines) };
}

/**
 * Build the engine {@link GenerationConstraints} from the user's schedule
 * options. Shared by generation and the swap-candidate feasibility check so a
 * swapped-in course honours the same time window / blocked times / rating
 * filter as the rest of the timetable. `maxFirstYearCredits` caps the first-year
 * (1xxx) credit budget when the user keeps the first-year limit on (web parity).
 */
export function buildGenerationConstraints(
  options: ScheduleOptions,
  ratings: ProfessorRatingsMap | null,
  maxFirstYearCredits?: number,
): GenerationConstraints {
  return {
    minStartMinutes: options.minStartMinutes,
    maxEndMinutes: options.maxEndMinutes,
    blockedTimes: blockedTimesForScheduleOptions(options),
    ...(maxFirstYearCredits != null ? { maxFirstYearCredits } : {}),
    ...(ratings != null ? { professorRatings: ratings } : {}),
  };
}

/**
 * The first-year (1xxx) credit cap to apply, or `undefined` when the limit is
 * off. Mirrors the web `sumCompletedFirstYearCredits` math: 48 minus the
 * first-year credits the student has already completed.
 */
export function firstYearCreditCapFor(
  options: ScheduleOptions,
  completedCourses: readonly string[],
  cache: DataCache,
): number | undefined {
  if (!options.limitFirstYearCredits) return undefined;
  let completed = 0;
  for (const code of completedCourses) {
    const m = code.match(/\d{4}/);
    if (!m || Number(m[0]) >= 2000) continue;
    completed += cache.getCourse(code)?.credits ?? 3;
  }
  return Math.max(0, 48 - completed);
}

function dataCacheFor(
  catalogue: Catalogue,
  schedules: SchedulesData,
  disciplines: DisciplinesData,
): DataCache {
  const hit = cacheMemo.get(catalogue);
  if (hit && hit.schedules === schedules) return hit.cache;
  const cache = buildDataCache(catalogue, schedules, disciplines);
  cacheMemo.set(catalogue, { schedules, cache });
  return cache;
}

function catalogueBytes(catalogue: Catalogue): Uint8Array {
  let bytes = catalogueBytesMemo.get(catalogue);
  if (!bytes) {
    bytes = ProtoCatalogue.encode(toProtoCatalogue(catalogue)).finish();
    catalogueBytesMemo.set(catalogue, bytes);
  }
  return bytes;
}

function schedulesBytes(schedules: SchedulesData): Uint8Array {
  let bytes = schedulesBytesMemo.get(schedules);
  if (!bytes) {
    bytes = ProtoSchedulesData.encode(toProtoSchedulesData(schedules)).finish();
    schedulesBytesMemo.set(schedules, bytes);
  }
  return bytes;
}

/** A stable signature of a schedule's course→section selections (for dedup). */
function fingerprintSchedule(events: CalendarEvent[]): string {
  return events
    .map((e) => `${e.courseCode}:${e.componentSection}`)
    .sort()
    .join("|");
}

/**
 * Prepare everything generation needs that is *independent of the seed*: the
 * enriched schedules + data cache, the advanced-requirement request payload, the
 * generation constraints, and the schedulable/skipped basket split. Shared by
 * the batch {@link generateScheduleVariants} and the lazy
 * {@link createScheduleGenerator} so a single code path decides what's
 * schedulable and how each per-seed request is built.
 */
function prepareGeneration(input: GenerateScheduleInput) {
  const { catalogue, disciplines, ratings, sentiment, basketCodes } = input;
  const hasProfileContext = input.hasProfileContext ?? false;
  const completedCourses = input.completedCourses ?? [];

  const options = input.options ?? DEFAULT_SCHEDULE_OPTIONS;
  // Enrich sections with grade distributions so calendar events carry gradeViz
  // (matches the web); the enriched schedules drive both the cache and the
  // engine dataset.
  const schedules = enrichedSchedulesFor(input.schedules, input.grades);
  const cache = dataCacheFor(catalogue, schedules, disciplines);
  const requirementContext = input.requirements ?? getActiveScheduleRequirementContext();
  const advancedRequirements = requirementContext
    ? buildPersonalizeAdvancedRequirements({
        catalogue,
        cache,
        programUrl: requirementContext.programUrl,
        completedCourses: requirementContext.completedCourses ?? completedCourses,
        selections: requirementContext.selections,
      })
    : null;
  const advancedRequirementsForRequest = advancedRequirements
    ? Object.assign({}, advancedRequirements, {
        electiveLevelBuckets: options.electiveLevelBuckets,
      })
    : null;

  // The professor-rating preference biases section selection toward higher-rated
  // instructors; attach the ratings map whenever we have it so the engine can
  // weight by it (web parity).
  const constraints: GenerationConstraints = buildGenerationConstraints(
    options,
    ratings,
    firstYearCreditCapFor(options, completedCourses, cache),
  );

  // Intelligently drop basket courses we can't actually put on a timetable so
  // pinning them doesn't fail the whole generation. Two reasons:
  //   • prerequisite — the student doesn't meet the prereqs yet (evaluated the
  //     same way as the basket "!" badge: against the user's completed courses).
  //   • offering — no schedulable section under the current filters this term
  //     (not offered, all sections filtered out, or outside the time window).
  // We surface every skip (with its reason) so the UI can explain what was left
  // out and how to fix it, while the rest of the basket still schedules.
  const schedulableBasket: string[] = [];
  const skippedCourses: SkippedCourse[] = [];
  for (const code of basketCodes) {
    const displayCode = cache.getCourse(normalizeCourseCode(code))?.code ?? code;
    const prerequisite = getBasketCourseStatus({
      course: { code },
      completedCodes: completedCourses,
      cache,
      hasProfileContext,
    }).prerequisite;
    if (prerequisite === "not_met") {
      skippedCourses.push({ code: displayCode, reason: "prerequisite" });
    } else if (countValidCombosForCourse(code, cache, constraints) > 0) {
      schedulableBasket.push(code);
    } else {
      skippedCourses.push({ code: displayCode, reason: "offering" });
    }
  }

  const courseSentimentByNorm = isOptimizationEnabled(
    options.optimizationPriorities,
    "prefer_sentiment",
  )
    ? ((sentiment?.courseByNorm ?? null) as Map<NormalizedCourseCode, number> | null)
    : null;

  return {
    catalogue,
    schedules,
    cache,
    options,
    ratings,
    sentiment: sentiment ?? null,
    completedCourses,
    advancedRequirementsForRequest,
    constraints,
    schedulableBasket,
    skippedCourses,
    courseSentimentByNorm,
    datasetKey: input.datasetKey,
    // Nothing to schedule (no pinnable basket course and no advanced
    // requirements) means we never touch the engine — matching the early return.
    canGenerate: schedulableBasket.length > 0 || Boolean(advancedRequirementsForRequest),
  };
}

type GenerationPrep = ReturnType<typeof prepareGeneration>;

/** Build the engine request for a single seed from the shared prep. */
function buildSeedRequest(prep: GenerationPrep, seed: number) {
  const o = prep.options;
  if (prep.advancedRequirementsForRequest) {
    return buildAdvancedRequest(
      buildAdvancedRequestInputFromPersonalize({
        requirements: prep.advancedRequirementsForRequest,
        constraints: prep.constraints,
        includeClosedComponents: o.includeClosedComponents,
        virtualSectionsOnly: o.virtualSectionsOnly,
        optimizationPriorities: o.optimizationPriorities,
        courseSentimentByNorm: prep.courseSentimentByNorm,
        levelBuckets: o.levelBuckets,
        languageBuckets: o.languageBuckets,
        basicExcludedCategories: o.basicExcludedCategories,
        frenchImmersionStream: o.frenchImmersionStream,
        blacklistedCourses: o.blacklistedCourses,
        currentSeed: seed,
        firstSeed: 0,
      }),
      prep.cache,
    );
  }
  return buildBasicRequest(
    {
      basketCourses: prep.schedulableBasket,
      basicElectivesCount: o.basicElectivesCount,
      basicExcludedCategories: o.basicExcludedCategories,
      studentPrograms: [],
      frenchImmersionStream: o.frenchImmersionStream,
      constraints: prep.constraints,
      completedCourses: [...prep.completedCourses],
      levelBuckets: o.levelBuckets,
      languageBuckets: o.languageBuckets,
      electiveLevelBuckets: o.electiveLevelBuckets,
      includeClosedComponents: o.includeClosedComponents,
      virtualSectionsOnly: o.virtualSectionsOnly,
      optimizationPriorities: o.optimizationPriorities,
      courseSentimentByNorm: prep.courseSentimentByNorm,
      blacklistedCourses: o.blacklistedCourses,
      currentSeed: seed,
      firstSeed: 0,
    },
    prep.cache,
  );
}

/** Run one seed through the engine, returning its variant (or null if no schedule). */
async function runSeed(
  engine: EngineBridge,
  prep: GenerationPrep,
  seed: number,
): Promise<ScheduleVariant | null> {
  const request = buildSeedRequest(prep, seed);
  const respBytes = await engine.generate(GenerationRequest.encode(request).finish());
  const mapped = mapGenerationResponse(GenerationResponse.decode(respBytes), prep.cache);
  if (!mapped.schedule) return null;
  const events = scheduleToEvents(mapped.schedule, prep.ratings, prep.sentiment);
  return {
    events,
    schedule: mapped.schedule,
    courseCount: mapped.schedule.enrollments.length,
    fingerprint: fingerprintSchedule(events),
  };
}

function loadDatasetFor(engine: EngineBridge, prep: GenerationPrep): Promise<void> {
  return engine.loadDataset(
    prep.datasetKey,
    catalogueBytes(prep.catalogue),
    schedulesBytes(prep.schedules),
  );
}

/**
 * Generate conflict-free weekly schedules pinning every basket course, using the
 * real Rust engine (the native binding — the same crate the web app runs as
 * WASM). Seeds 0..N-1 produce distinct arrangements; identical results are
 * de-duplicated. Prefer {@link createScheduleGenerator} for the interactive
 * (lazy, unbounded) pager; this eager batch form backs tests and one-shot use.
 */
export async function generateScheduleVariants(
  input: GenerateScheduleInput,
): Promise<GenerateScheduleResult> {
  const prep = prepareGeneration(input);
  if (!prep.canGenerate) return { variants: [], skippedCourses: prep.skippedCourses };

  await loadDatasetFor(input.engine, prep);

  const variantCount = Math.max(1, input.variantCount ?? 6);
  const seen = new Set<string>();
  const variants: ScheduleVariant[] = [];

  for (let seed = 0; seed < variantCount; seed++) {
    if (input.signal?.aborted) break;
    const variant = await runSeed(input.engine, prep, seed);
    if (input.signal?.aborted) break;
    if (!variant || seen.has(variant.fingerprint)) continue;
    seen.add(variant.fingerprint);
    variants.push(variant);
    input.onVariant?.([...variants], prep.skippedCourses);
  }

  return { variants, skippedCourses: prep.skippedCourses };
}

/** A lazy, unbounded source of unique schedule variants (one seed at a time). */
export interface ScheduleGenerator {
  /** Basket courses excluded before generation (prereq/offering), known upfront. */
  skippedCourses: SkippedCourse[];
  /**
   * Resolve the next *unique* conflict-free arrangement, or `null` once
   * generation is exhausted (no further distinct schedule). Advances the seed
   * lazily and de-duplicates against everything returned so far, so the caller
   * can keep pressing "next" until this yields null.
   */
  next(signal?: AbortSignal): Promise<ScheduleVariant | null>;
}

/** Consecutive fruitless seeds (empty or duplicate) before we declare exhaustion. */
const NEXT_VARIANT_MISS_BUDGET = 16;
/** Hard ceiling on total seeds attempted by a generator (safety net). */
const MAX_SEED_ATTEMPTS = 240;

/**
 * Create a lazy generator that produces unique schedule variants on demand. The
 * dataset load + basket prep run once; each {@link ScheduleGenerator.next} call
 * advances the seed cursor until it finds a not-yet-seen arrangement, giving up
 * (returning null, permanently) after {@link NEXT_VARIANT_MISS_BUDGET}
 * consecutive misses or {@link MAX_SEED_ATTEMPTS} total seeds. This backs the
 * schedule pager's unbounded "next" without pre-computing a fixed batch.
 */
export async function createScheduleGenerator(
  input: GenerateScheduleInput,
): Promise<ScheduleGenerator> {
  const prep = prepareGeneration(input);
  if (prep.canGenerate) await loadDatasetFor(input.engine, prep);

  const seen = new Set<string>();
  let seed = 0;
  let exhausted = !prep.canGenerate;

  const next = async (signal?: AbortSignal): Promise<ScheduleVariant | null> => {
    if (exhausted) return null;
    let misses = 0;
    while (seed < MAX_SEED_ATTEMPTS && misses < NEXT_VARIANT_MISS_BUDGET) {
      if (signal?.aborted) return null;
      const variant = await runSeed(input.engine, prep, seed++);
      if (signal?.aborted) return null;
      if (!variant || seen.has(variant.fingerprint)) {
        misses++;
        continue;
      }
      seen.add(variant.fingerprint);
      return variant;
    }
    exhausted = true;
    return null;
  };

  return { skippedCourses: prep.skippedCourses, next };
}
