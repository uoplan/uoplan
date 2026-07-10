import type { Program, ProgramRequirement } from "@uoplan/domain/dataTypes";
import type { DataCache } from "@uoplan/domain/dataCache";
import type { NormalizedCourseCode } from "@uoplan/domain/brand";
import { getLanguageVariant, isRepeatableCourse } from "@uoplan/domain/utils/courseUtils";
import type { RemainingRequirement, RequirementWithStatus } from "./types";

export class RequirementContext {
  public remaining: RemainingRequirement[] = [];
  /**
   * Multiset of available completed courses keyed by canonical code → remaining count.
   * Non-repeatable courses are capped at one instance (so a stray duplicate can never
   * over-satisfy), while repeatable courses (e.g. accompanying FLS companions) keep every
   * instance so each can satisfy a different requirement slot.
   */
  public pool: Map<NormalizedCourseCode, number>;

  constructor(
    public program: Program,
    completedCourses: string[],
    public cache: DataCache,
    public selectedOptionsPerRequirement: Record<string, number> = {},
  ) {
    this.pool = new Map();
    for (const c of completedCourses) {
      const canonical = cache.resolveToCanonical(c);
      const current = this.pool.get(canonical) ?? 0;
      if (current > 0 && !isRepeatableCourse(canonical)) continue;
      this.pool.set(canonical, current + 1);
    }
  }

  reqId(path: string): string {
    return `req-${path}`;
  }

  private consume(canonical: NormalizedCourseCode, dryRun: boolean): void {
    if (dryRun) return;
    const remaining = (this.pool.get(canonical) ?? 0) - 1;
    if (remaining > 0) this.pool.set(canonical, remaining);
    else this.pool.delete(canonical);
  }

  takeFromPool(
    codes: NormalizedCourseCode[],
    dryRun: boolean,
  ): { displayCode: string; norm: NormalizedCourseCode } | null {
    for (const c of codes) {
      const canonical = this.cache.resolveToCanonical(c);
      if ((this.pool.get(canonical) ?? 0) > 0) {
        this.consume(canonical, dryRun);
        const displayCode = this.cache.getCourse(canonical)?.code ?? canonical;
        return { displayCode, norm: canonical };
      }
      // Also accept the language variant (English ↔ French equivalence)
      const variant = getLanguageVariant(canonical);
      if (variant) {
        const variantCanonical = this.cache.resolveToCanonical(variant);
        if ((this.pool.get(variantCanonical) ?? 0) > 0) {
          this.consume(variantCanonical, dryRun);
          const displayCode = this.cache.getCourse(variantCanonical)?.code ?? variantCanonical;
          return { displayCode, norm: variantCanonical };
        }
      }
    }
    return null;
  }

  toStatusBase(
    req: ProgramRequirement,
  ): Omit<
    RequirementWithStatus,
    | "complete"
    | "satisfiedBy"
    | "options"
    | "satisfiedOptionIndex"
    | "requirementId"
    | "candidateCourses"
    | "creditsNeeded"
    | "pickedCount"
  > {
    return {
      type: req.type ?? "unknown",
      title: req.title,
      code: req.code,
      credits: req.credits,
      disciplineLevels: req.disciplineLevels,
      excluded_disciplines: req.excluded_disciplines,
      faculty: req.faculty,
    };
  }
}
