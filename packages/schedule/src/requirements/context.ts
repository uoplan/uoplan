import type { Program, ProgramRequirement } from "../dataTypes";
import type { DataCache } from "../dataCache";
import { getLanguageVariant } from "../utils/courseUtils";
import type { RemainingRequirement, RequirementWithStatus } from "./types";

export class RequirementContext {
  public remaining: RemainingRequirement[] = [];
  public pool: Set<string>;

  constructor(
    public program: Program,
    completedCourses: string[],
    public cache: DataCache,
    public selectedOptionsPerRequirement: Record<string, number> = {},
  ) {
    this.pool = new Set(completedCourses.map((c) => cache.resolveToCanonical(c)));
  }

  reqId(path: string): string {
    return `req-${path}`;
  }

  takeFromPool(codes: string[], dryRun: boolean): { displayCode: string; norm: string } | null {
    for (const c of codes) {
      const canonical = this.cache.resolveToCanonical(c);
      if (this.pool.has(canonical)) {
        if (!dryRun) this.pool.delete(canonical);
        const displayCode = this.cache.getCourse(canonical)?.code ?? canonical;
        return { displayCode, norm: canonical };
      }
      // Also accept the language variant (English ↔ French equivalence)
      const variant = getLanguageVariant(canonical);
      if (variant) {
        const variantCanonical = this.cache.resolveToCanonical(variant);
        if (this.pool.has(variantCanonical)) {
          if (!dryRun) this.pool.delete(variantCanonical);
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
