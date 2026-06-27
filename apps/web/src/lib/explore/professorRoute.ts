import type {
  CanonicalProfessorName,
  ProfessorRegistry,
  ProfessorRegistryEntry,
  ProfessorSlug,
} from "@uoplan/core";
import {
  pickCanonicalProfessorName,
  professorByLegacyId,
  professorByName,
  professorBySlug,
  slugifyProfessor,
  unsafeBrand,
} from "@uoplan/core";

/**
 * Build the URL path-segment used to link to a professor. Always a kebab-case
 * slug: the canonical registry slug when known, otherwise one derived from the
 * display name. `slugifyProfessor` is deterministic and matches the registry's
 * own slug (bar rare dedup suffixes), so a slug is always available — even
 * before the registry has loaded or for profs only present in schedule data —
 * and `resolveProfessorRoute` resolves it back via the first+last match key.
 */
export function professorRouteParam(entry: {
  slug?: string;
  displayName: CanonicalProfessorName;
}): string {
  return entry.slug ?? slugifyProfessor(entry.displayName);
}

interface ResolvedProfessorRoute {
  /** 0-based registry index, when the param resolves to a registry entry. */
  index: number | null;
  entry: ProfessorRegistryEntry | null;
  /** RateMyProfessors legacyId for external links, when known. */
  legacyId: number | null;
  /** Canonical (or best-effort) display name. */
  displayName: CanonicalProfessorName;
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
  const bySlug = professorBySlug(registry, unsafeBrand<ProfessorSlug>(param));
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
    return {
      index: null,
      entry: null,
      legacyId: numeric,
      displayName: pickCanonicalProfessorName([""]),
    };
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
  return {
    index: null,
    entry: null,
    legacyId: null,
    displayName: pickCanonicalProfessorName([name]),
  };
}
