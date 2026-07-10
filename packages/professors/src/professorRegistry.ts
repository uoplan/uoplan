import type { ProfessorsData, ProfessorEntry as ProtoProfessorEntry } from "@uoplan/proto/data";
import { unsafeBrand } from "@uoplan/domain/brand";
import type {
  CanonicalProfessorName,
  ProfessorMatchKey,
  ProfessorSlug,
} from "@uoplan/domain/brand";
import { professorMatchKey, slugifyProfessor } from "./professorIdentity";

/**
 * Runtime view of the canonical professor registry (`professors.pb`). Datasets
 * reference a professor by his 1-based registry ref (`professorRef` on schedule
 * meeting times / grade offerings / feedback's `professorRefs`); this module
 * resolves those refs — and URL slugs — to a single canonical entry per person.
 *
 * See `professorIdentity` for the shared name/slug/match primitives the scraper
 * uses to build the registry.
 */

export interface ProfessorRegistryEntry {
  /** URL-safe public id, unique across the registry. */
  slug: ProfessorSlug;
  /** Canonical display name (fullest variant; keeps accents and middle names). */
  name: CanonicalProfessorName;
  /** Every RateMyProfessors legacyId merged into this person. */
  legacyIds: number[];
  /** Response-weighted average RMP rating across merged profiles, when rated. */
  rating?: number;
  numRatings?: number;
  /** Other observed spellings of this person's name (excluding `name`). */
  aliases: string[];
}

export interface ProfessorRegistry {
  /** Registry entries; array position is the professor's registry index. */
  entries: ProfessorRegistryEntry[];
  bySlug: Map<ProfessorSlug, number>;
  byLegacyId: Map<number, number>;
  /** First+last match key (see {@link professorMatchKey}) → registry index, for name lookups. */
  byMatchKey: Map<ProfessorMatchKey, number>;
}

/** Map a stored 1-based professor ref to a 0-based registry index (null = none). */
export function professorIndexFromRef(ref: number | null | undefined): number | null {
  return ref != null && ref > 0 ? ref - 1 : null;
}

/** Convert decoded `professors.pb` entries to the runtime registry shape. */
export function fromProtoProfessorsData(data: ProfessorsData): ProfessorRegistryEntry[] {
  return (data.professors ?? []).map((p: ProtoProfessorEntry) => ({
    // `slug` is no longer stored in professors.pb; recompute it from the name.
    slug: slugifyProfessor(p.name),
    name: unsafeBrand<CanonicalProfessorName>(p.name),
    legacyIds: (p.legacyIds ?? []).map((n) => Number(n)),
    ...(p.rating != null ? { rating: Number(p.rating) } : {}),
    ...(p.numRatings != null ? { numRatings: Number(p.numRatings) } : {}),
    aliases: p.aliases ?? [],
  }));
}

/** Build the lookup tables (slug → index, legacyId → index, matchKey → index). */
export function buildProfessorRegistry(entries: ProfessorRegistryEntry[]): ProfessorRegistry {
  const bySlug = new Map<ProfessorSlug, number>();
  const byLegacyId = new Map<number, number>();
  const byMatchKey = new Map<ProfessorMatchKey, number>();
  for (const [idx, entry] of entries.entries()) {
    if (entry.slug && !bySlug.has(entry.slug)) bySlug.set(entry.slug, idx);
    for (const id of entry.legacyIds) {
      if (!byLegacyId.has(id)) byLegacyId.set(id, idx);
    }
    for (const variant of [entry.name, ...entry.aliases]) {
      const key = professorMatchKey(variant);
      if (key && !byMatchKey.has(key)) byMatchKey.set(key, idx);
    }
  }
  return { entries, bySlug, byLegacyId, byMatchKey };
}

/** Resolve a registry entry by 0-based index. */
export function professorAt(
  registry: ProfessorRegistry | null | undefined,
  index: number | null | undefined,
): ProfessorRegistryEntry | null {
  if (!registry || index == null || index < 0) return null;
  return registry.entries[index] ?? null;
}

/** Resolve a registry entry (and its index) by URL slug. */
export function professorBySlug(
  registry: ProfessorRegistry | null | undefined,
  slug: ProfessorSlug,
): { index: number; entry: ProfessorRegistryEntry } | null {
  if (!registry) return null;
  const index = registry.bySlug.get(slug);
  if (index == null) return null;
  const entry = registry.entries[index];
  return entry ? { index, entry } : null;
}

/** Resolve a registry entry by RateMyProfessors legacyId. */
export function professorByLegacyId(
  registry: ProfessorRegistry | null | undefined,
  legacyId: number,
): { index: number; entry: ProfessorRegistryEntry } | null {
  if (!registry) return null;
  const index = registry.byLegacyId.get(legacyId);
  if (index == null) return null;
  const entry = registry.entries[index];
  return entry ? { index, entry } : null;
}

/** Resolve a registry index by professor name via the first+last match key. */
export function professorIndexByName(
  registry: ProfessorRegistry | null | undefined,
  name: string,
): number | null {
  if (!registry) return null;
  const key = professorMatchKey(name);
  if (!key) return null;
  return registry.byMatchKey.get(key) ?? null;
}

/** Resolve a registry entry (and its index) by professor name. */
export function professorByName(
  registry: ProfessorRegistry | null | undefined,
  name: string,
): { index: number; entry: ProfessorRegistryEntry } | null {
  const index = professorIndexByName(registry, name);
  if (index == null || !registry) return null;
  const entry = registry.entries[index];
  return entry ? { index, entry } : null;
}

/** The external RateMyProfessors link target for an entry (first merged id). */
export function professorLegacyId(entry: ProfessorRegistryEntry | null | undefined): number | null {
  return entry?.legacyIds[0] ?? null;
}
