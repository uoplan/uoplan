/**
 * Builds the canonical professor registry: one entry per real person, merging
 * the name/diacritic/middle-name variants that the same professor accumulates
 * across RateMyProfessors, grades, schedules and feedback. The result is written
 * to the committed `data/professors.json` (diffable) and later encoded to
 * `professors.pb`; every other dataset references a professor by his INDEX into
 * this registry instead of repeating a name string.
 *
 * Merge model — uses the shared identity primitives from `@uoplan/core`
 * (`professorIdentity`), so registry build, runtime lookup, and URL slug
 * generation all compute identity the same way:
 *   - group by `professorMatchKey` (first token + last token, diacritics
 *     stripped, middle names dropped);
 *   - the canonical display name is the fullest variant in the group;
 *   - all RateMyProfessors reviews in the group are combined (summed counts,
 *     response-weighted average rating);
 *   - `professors.overrides.json` can force-merge distinct keys or force-split a
 *     key whose first+last is shared by genuinely different people.
 */

import {
  cleanDisplayName,
  pickCanonicalProfessorName,
  professorMatchKey,
  slugifyProfessor,
} from "@uoplan/core/professorIdentity";

/** Placeholder names that are NOT real people and must never enter the registry. */
function isUnassignedName(name: string): boolean {
  const key = professorMatchKey(name);
  return key === "" || key === "staff";
}

/** ---- inputs / outputs ---- */

export interface RmpInput {
  name: string;
  legacyId?: number;
  rating?: number | null;
  numRatings?: number;
}

export interface NamedInput {
  name: string;
  legacyId?: number;
}

export interface RegistryOverrides {
  /** Each list of match keys is force-merged into a single professor. */
  merge?: string[][];
  /**
   * Force-split a shared first+last key: each listed legacyId group becomes its
   * own professor. Names in the key without a listed legacyId stay on the first
   * (primary) entry.
   */
  split?: Array<{ key: string; groups: number[][] }>;
}

export interface RegistryInputs {
  rmp: RmpInput[];
  grades: NamedInput[];
  schedules: string[];
  feedback: string[];
  overrides?: RegistryOverrides;
}

export interface ProfessorRegistryEntry {
  slug: string;
  name: string;
  legacyIds: number[];
  rating?: number;
  numRatings?: number;
  aliases: string[];
}

/** ---- registry build ---- */

interface Group {
  keys: Set<string>;
  names: Set<string>;
  legacyIds: Set<number>;
  /** Names recorded against a specific legacyId, so force-splits keep their names. */
  namesByLegacyId: Map<number, Set<string>>;
  /** RMP review parts (rating, count) for response-weighted averaging. */
  reviews: Array<{ rating: number; count: number }>;
}

class UnionFind {
  private parent = new Map<string, string>();
  find(x: string): string {
    if (!this.parent.has(x)) {
      this.parent.set(x, x);
      return x;
    }
    let root = x;
    let p = this.parent.get(root)!;
    while (p !== root) {
      root = p;
      p = this.parent.get(root)!;
    }
    // Path compression.
    let cur = x;
    while (this.parent.get(cur)! !== root) {
      const next = this.parent.get(cur)!;
      this.parent.set(cur, root);
      cur = next;
    }
    return root;
  }
  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
}

function combineReviews(reviews: Array<{ rating: number; count: number }>): {
  rating?: number;
  numRatings?: number;
} {
  let totalCount = 0;
  let weighted = 0;
  for (const r of reviews) {
    if (!Number.isFinite(r.rating) || r.rating <= 0 || !Number.isFinite(r.count) || r.count <= 0) {
      continue;
    }
    totalCount += r.count;
    weighted += r.rating * r.count;
  }
  if (totalCount <= 0) return {};
  return { rating: Math.round((weighted / totalCount) * 10) / 10, numRatings: totalCount };
}

/**
 * Build the canonical registry from the union of every professor-name source.
 * Returns entries sorted by slug (stable, diffable order); the array index is
 * the professor's registry id.
 */
export function buildProfessorRegistry(inputs: RegistryInputs): ProfessorRegistryEntry[] {
  const groups = new Map<string, Group>();
  const ensure = (key: string): Group => {
    let g = groups.get(key);
    if (!g) {
      g = {
        keys: new Set([key]),
        names: new Set(),
        legacyIds: new Set(),
        namesByLegacyId: new Map(),
        reviews: [],
      };
      groups.set(key, g);
    }
    return g;
  };

  const recordNameForLegacyId = (g: Group, name: string, legacyId: number): void => {
    let set = g.namesByLegacyId.get(legacyId);
    if (!set) {
      set = new Set();
      g.namesByLegacyId.set(legacyId, set);
    }
    set.add(name);
  };

  const addName = (name: string, legacyId?: number): void => {
    if (isUnassignedName(name)) return;
    const key = professorMatchKey(name);
    if (!key) return;
    const g = ensure(key);
    const clean = cleanDisplayName(name);
    g.names.add(clean);
    if (legacyId != null && Number.isFinite(legacyId)) {
      g.legacyIds.add(legacyId);
      recordNameForLegacyId(g, clean, legacyId);
    }
  };

  for (const p of inputs.rmp) {
    if (isUnassignedName(p.name)) continue;
    const key = professorMatchKey(p.name);
    if (!key) continue;
    const g = ensure(key);
    const clean = cleanDisplayName(p.name);
    g.names.add(clean);
    if (p.legacyId != null && Number.isFinite(p.legacyId)) {
      g.legacyIds.add(p.legacyId);
      recordNameForLegacyId(g, clean, p.legacyId);
    }
    const rating = typeof p.rating === "number" ? p.rating : Number(p.rating);
    g.reviews.push({ rating, count: p.numRatings ?? 0 });
  }
  for (const g of inputs.grades) addName(g.name, g.legacyId);
  for (const name of inputs.schedules) addName(name);
  for (const name of inputs.feedback) addName(name);

  // Apply force-merge overrides via union-find over match keys.
  const uf = new UnionFind();
  for (const key of groups.keys()) uf.find(key);
  for (const cluster of inputs.overrides?.merge ?? []) {
    for (let i = 1; i < cluster.length; i++) uf.union(cluster[0], cluster[i]);
  }
  const merged = new Map<string, Group>();
  for (const [key, g] of groups) {
    const root = uf.find(key);
    const target = merged.get(root);
    if (!target) {
      merged.set(root, g);
    } else {
      for (const k of g.keys) target.keys.add(k);
      for (const n of g.names) target.names.add(n);
      for (const id of g.legacyIds) target.legacyIds.add(id);
      for (const [id, names] of g.namesByLegacyId) {
        const set = target.namesByLegacyId.get(id) ?? new Set();
        for (const n of names) set.add(n);
        target.namesByLegacyId.set(id, set);
      }
      target.reviews.push(...g.reviews);
    }
  }

  // Apply force-split overrides: carve listed legacyId groups out of a key.
  const finalGroups: Group[] = [];
  const splitByKey = new Map<string, number[][]>();
  for (const s of inputs.overrides?.split ?? []) splitByKey.set(s.key, s.groups);
  for (const g of merged.values()) {
    const splitKey = [...g.keys].find((k) => splitByKey.has(k));
    const groupsSpec = splitKey ? splitByKey.get(splitKey) : undefined;
    if (!groupsSpec) {
      finalGroups.push(g);
      continue;
    }
    finalGroups.push(...splitGroup(g, groupsSpec));
  }

  const entries = finalGroups
    .filter((g) => g.names.size > 0)
    .map<ProfessorRegistryEntry>((g) => {
      const name = pickCanonicalProfessorName(g.names);
      const aliases = [...g.names].filter((n) => n !== name).sort((a, b) => a.localeCompare(b));
      return {
        slug: slugifyProfessor(name),
        name,
        legacyIds: [...g.legacyIds].sort((a, b) => a - b),
        ...combineReviews(g.reviews),
        aliases,
      };
    })
    .sort((a, b) => a.slug.localeCompare(b.slug) || a.name.localeCompare(b.name));

  return dedupeSlugs(entries);
}

/** Split a group: each legacyId set becomes its own entry; leftovers stay primary. */
function splitGroup(group: Group, groupsSpec: number[][]): Group[] {
  const assigned = new Set<number>();
  const carvedNames = new Set<string>();
  const carved: Group[] = [];
  for (const ids of groupsSpec) {
    const sub: Group = {
      keys: new Set(group.keys),
      names: new Set(),
      legacyIds: new Set(),
      namesByLegacyId: new Map(),
      reviews: [],
    };
    for (const id of ids) {
      if (!group.legacyIds.has(id)) continue;
      sub.legacyIds.add(id);
      assigned.add(id);
      const names = group.namesByLegacyId.get(id);
      if (names) {
        sub.namesByLegacyId.set(id, new Set(names));
        for (const n of names) {
          sub.names.add(n);
          carvedNames.add(n);
        }
      }
    }
    if (sub.legacyIds.size > 0) carved.push(sub);
  }
  const primaryNames = new Set([...group.names].filter((n) => !carvedNames.has(n)));
  const primary: Group = {
    keys: new Set(group.keys),
    names: primaryNames.size > 0 ? primaryNames : new Set(group.names),
    legacyIds: new Set([...group.legacyIds].filter((id) => !assigned.has(id))),
    namesByLegacyId: new Map([...group.namesByLegacyId].filter(([id]) => !assigned.has(id))),
    reviews: [...group.reviews],
  };
  return [primary, ...carved.filter((c) => c.names.size > 0)];
}

/** Ensure slugs are unique across the registry by suffixing collisions (-2, -3, …). */
function dedupeSlugs(entries: ProfessorRegistryEntry[]): ProfessorRegistryEntry[] {
  const seen = new Map<string, number>();
  for (const e of entries) {
    const base = e.slug || "professor";
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    e.slug = n === 0 ? base : `${base}-${n + 1}`;
  }
  return entries;
}

/** ---- resolver (registry index lookup, used by the proto builders) ---- */

export interface ProfessorResolver {
  /** Registry index for a professor name (+ optional legacyId), or null. */
  index(name: string, legacyId?: number): number | null;
  /** Registry index for a known legacyId, or null. */
  indexForLegacyId(legacyId: number): number | null;
}

/**
 * Build a resolver from a committed registry so the proto encoders can map each
 * source's professor reference to its registry index deterministically.
 */
export function createResolverFromRegistry(
  entries: ReadonlyArray<ProfessorRegistryEntry>,
): ProfessorResolver {
  const byLegacyId = new Map<number, number>();
  // A match key shared by a split pair resolves to its primary (first) entry.
  const byKey = new Map<string, number>();
  entries.forEach((entry, idx) => {
    for (const id of entry.legacyIds) {
      if (!byLegacyId.has(id)) byLegacyId.set(id, idx);
    }
    for (const name of [entry.name, ...entry.aliases]) {
      const key = professorMatchKey(name);
      if (key && !byKey.has(key)) byKey.set(key, idx);
    }
  });

  return {
    indexForLegacyId(legacyId: number): number | null {
      return byLegacyId.get(legacyId) ?? null;
    },
    index(name: string, legacyId?: number): number | null {
      if (legacyId != null && byLegacyId.has(legacyId)) return byLegacyId.get(legacyId)!;
      if (isUnassignedName(name)) return null;
      const key = professorMatchKey(name);
      if (!key) return null;
      return byKey.get(key) ?? null;
    },
  };
}
