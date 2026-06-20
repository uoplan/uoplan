import { buildDataCache, type DataCache } from "@uoplan/core/dataCache";
import type { Catalogue, DisciplinesData, SchedulesData } from "@uoplan/core/dataTypes";
import { buildPrereqContext, canTakeCourse } from "@uoplan/core";

export type BasketPrerequisiteStatus = "met" | "not_met" | "unknown";
export type BasketOfferingStatus = "offered" | "not_offered" | "unknown";
export type BasketStatusBadgeKind = "prerequisite" | "offering";
export type BasketStatusTone = "warning" | "neutral";

export interface BasketStatusCourse {
  code: string;
  termIds?: readonly string[] | null;
}

export interface BasketStatusBadge {
  kind: BasketStatusBadgeKind;
  label: string;
  tone: BasketStatusTone;
}

export interface BasketCourseStatus {
  prerequisite: BasketPrerequisiteStatus;
  offering: BasketOfferingStatus;
  badges: BasketStatusBadge[];
}

export interface BasketCourseStatusInput {
  course: BasketStatusCourse;
  /**
   * The user's completed-course context (transcript + personalize "completed
   * courses"). This is what prerequisites are checked against — NOT the other
   * courses in the generation cart. The cart and the completed set are separate.
   */
  completedCodes: readonly string[];
  cache?: DataCache | null;
  selectedTermId?: string | null;
  termNameById?: ReadonlyMap<string, string> | null;
  /**
   * Whether the user has given the planner any academic grounding — a program
   * uploaded/selected or a start year picked. Without it (and with no completed
   * courses recorded), we can't meaningfully say a prerequisite is "not met", so
   * we treat the prerequisite status as `"unknown"` and assume the user knows
   * what they're doing rather than blocking them. A non-empty completed set is
   * itself enough context even when this is `false`.
   */
  hasProfileContext?: boolean;
}

const EMPTY_SCHEDULES: SchedulesData = { termId: "0", schedules: [] };

export function buildBasketStatusCache(
  catalogue: Catalogue,
  schedules?: SchedulesData | null,
  disciplines?: DisciplinesData,
): DataCache {
  return buildDataCache(catalogue, schedules ?? EMPTY_SCHEDULES, disciplines);
}

function prerequisiteStatus(
  courseCode: string,
  completedCodes: readonly string[],
  cache: DataCache | null | undefined,
  hasProfileContext: boolean,
): BasketPrerequisiteStatus {
  if (!cache) return "unknown";

  try {
    const canonical = cache.resolveToCanonical(courseCode);
    const course = cache.getCourse(canonical);
    if (!course) return "unknown";
    if (!course.prerequisites) return "met";

    const completedCourses = completedCodes.filter(
      (code) => cache.resolveToCanonical(code) !== canonical,
    );
    // No academic context at all (no program / year, and no completed courses to
    // check against): assume the user knows what they're doing and don't claim
    // the prerequisites are unmet — leave the status "unknown" so it never blocks
    // adding, badges the cart, or skips the course in generation.
    if (!hasProfileContext && completedCourses.length === 0) return "unknown";
    const context = buildPrereqContext(completedCourses, cache);
    return canTakeCourse(canonical, cache, context) ? "met" : "not_met";
  } catch {
    return "unknown";
  }
}

function offeringStatus(
  course: BasketStatusCourse,
  selectedTermId: string | null | undefined,
): BasketOfferingStatus {
  if (!selectedTermId) return "unknown";
  if (!course.termIds || course.termIds.length === 0) return "unknown";
  return course.termIds.includes(selectedTermId) ? "offered" : "not_offered";
}

function termLabel(
  termId: string,
  termNameById: ReadonlyMap<string, string> | null | undefined,
): string {
  return termNameById?.get(termId) ?? termId;
}

export function getBasketCourseStatus({
  course,
  completedCodes,
  cache,
  selectedTermId,
  termNameById,
  hasProfileContext = false,
}: BasketCourseStatusInput): BasketCourseStatus {
  const prerequisite = prerequisiteStatus(course.code, completedCodes, cache, hasProfileContext);
  const offering = offeringStatus(course, selectedTermId);
  const badges: BasketStatusBadge[] = [];

  if (prerequisite === "not_met") {
    badges.push({ kind: "prerequisite", label: "Prerequisites not met", tone: "warning" });
  }

  if (offering === "not_offered" && selectedTermId) {
    badges.push({
      kind: "offering",
      label: `Not offered in ${termLabel(selectedTermId, termNameById)}`,
      tone: "neutral",
    });
  }

  return { prerequisite, offering, badges };
}
