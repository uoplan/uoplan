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
 * filter as the rest of the timetable.
 */
export function buildGenerationConstraints(
  options: ScheduleOptions,
  ratings: ProfessorRatingsMap | null,
): GenerationConstraints {
  const useRatingFilter = options.minProfessorRating != null && ratings != null;
  return {
    minStartMinutes: options.minStartMinutes,
    maxEndMinutes: options.maxEndMinutes,
    compressedSchedule: options.compressedSchedule,
    blockedTimes: blockedTimesForScheduleOptions(options),
    ...(useRatingFilter
      ? {
          minProfessorRating: options.minProfessorRating ?? undefined,
          professorRatings: ratings,
        }
      : {}),
  };
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
 * Generate conflict-free weekly schedules pinning every basket course, using the
 * real Rust engine (the native binding — the same crate the web app runs as
 * WASM). Seeds 0..N-1 produce distinct arrangements; identical results are
 * de-duplicated.
 */
export async function generateScheduleVariants(
  input: GenerateScheduleInput,
): Promise<GenerateScheduleResult> {
  const { catalogue, disciplines, ratings, sentiment, basketCodes, engine } = input;
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

  // RateMyProfessors rating filtering needs the ratings map alongside the
  // threshold; only attach it when the user set a minimum (web parity).
  const constraints: GenerationConstraints = buildGenerationConstraints(options, ratings);

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

  if (schedulableBasket.length === 0 && !advancedRequirements) {
    return { variants: [], skippedCourses };
  }

  await engine.loadDataset(input.datasetKey, catalogueBytes(catalogue), schedulesBytes(schedules));

  const variantCount = Math.max(1, input.variantCount ?? 6);
  const seen = new Set<string>();
  const variants: ScheduleVariant[] = [];

  for (let seed = 0; seed < variantCount; seed++) {
    const courseSentimentByNorm = options.preferHigherSentiment
      ? ((sentiment?.courseByNorm ?? null) as Map<NormalizedCourseCode, number> | null)
      : null;
    const request = advancedRequirementsForRequest
      ? buildAdvancedRequest(
          buildAdvancedRequestInputFromPersonalize({
            requirements: advancedRequirementsForRequest,
            constraints,
            includeClosedComponents: options.includeClosedComponents,
            virtualSectionsOnly: options.virtualSectionsOnly,
            generationPreferEasier: options.preferEasier,
            generationPreferHigherSentiment: options.preferHigherSentiment,
            courseSentimentByNorm,
            blacklistedCourses: [],
            currentSeed: seed,
            firstSeed: 0,
          }),
          cache,
        )
      : buildBasicRequest(
          {
            basketCourses: schedulableBasket,
            basicElectivesCount: 0,
            basicExcludedCategories: [],
            studentPrograms: [],
            frenchImmersionStream: false,
            constraints,
            completedCourses: [],
            levelBuckets: [],
            languageBuckets: [],
            electiveLevelBuckets: options.electiveLevelBuckets,
            includeClosedComponents: options.includeClosedComponents,
            virtualSectionsOnly: options.virtualSectionsOnly,
            generationPreferEasier: options.preferEasier,
            generationPreferHigherSentiment: options.preferHigherSentiment,
            courseSentimentByNorm,
            blacklistedCourses: [],
            currentSeed: seed,
            firstSeed: 0,
          },
          cache,
        );

    const respBytes = await engine.generate(GenerationRequest.encode(request).finish());
    const mapped = mapGenerationResponse(GenerationResponse.decode(respBytes), cache);
    if (!mapped.schedule) continue;

    const events = scheduleToEvents(mapped.schedule, ratings, sentiment ?? null);
    const fingerprint = fingerprintSchedule(events);
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    variants.push({
      events,
      schedule: mapped.schedule,
      courseCount: mapped.schedule.enrollments.length,
      fingerprint,
    });
  }

  return { variants, skippedCourses };
}
