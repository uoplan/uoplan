import type { ProfessorRegistry, ProfessorRegistryEntry } from "@uoplan/core";
import { professorBySlug, professorByLegacyId, professorByName } from "@uoplan/core";

/**
 * Build the URL path-segment used to link to a professor. Prefers the canonical
 * registry slug; falls back to a legacyId or the URL-encoded display name so
 * links still work before the registry has loaded or for unregistered profs.
 */
export function professorRouteParam(entry: {
  slug?: string;
  legacyId?: number;
  displayName: string;
}): string {
  if (entry.slug) return entry.slug;
  if (entry.legacyId != null) return String(entry.legacyId);
  return encodeURIComponent(entry.displayName);
}

export interface ResolvedProfessorRoute {
  /** 0-based registry index, when the param resolves to a registry entry. */
  index: number | null;
  entry: ProfessorRegistryEntry | null;
  /** RateMyProfessors legacyId for external links, when known. */
  legacyId: number | null;
  /** Canonical (or best-effort) display name. */
  displayName: string;
}

/**
 * Resolve a `/explore/professor/<param>` segment to a canonical professor.
 * Accepts a registry slug (preferred), a numeric RateMyProfessors legacyId, or a
 * URL-encoded professor name (legacy links), in that order.
 */
export function resolveProfessorRoute(
  registry: ProfessorRegistry | null | undefined,
  param: string,
): ResolvedProfessorRoute {
  const bySlug = professorBySlug(registry, param);
  if (bySlug) {
    return {
      index: bySlug.index,
      entry: bySlug.entry,
      legacyId: bySlug.entry.legacyIds[0] ?? null,
      displayName: bySlug.entry.name,
    };
  }

  const numeric = Number.parseInt(param, 10);
  const isNumeric = Number.isFinite(numeric) && numeric > 0 && String(numeric) === param;
  if (isNumeric) {
    const byId = professorByLegacyId(registry, numeric);
    if (byId) {
      return {
        index: byId.index,
        entry: byId.entry,
        legacyId: byId.entry.legacyIds[0] ?? numeric,
        displayName: byId.entry.name,
      };
    }
    return { index: null, entry: null, legacyId: numeric, displayName: "" };
  }

  const name = decodeURIComponent(param);
  const byName = professorByName(registry, name);
  if (byName) {
    return {
      index: byName.index,
      entry: byName.entry,
      legacyId: byName.entry.legacyIds[0] ?? null,
      displayName: byName.entry.name,
    };
  }
  return { index: null, entry: null, legacyId: null, displayName: name };
}
