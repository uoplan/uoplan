/**
 * Course-alias grouping shared by the web and native explore detail pages.
 *
 * Catalogue courses can list `aliases` (cross-listed / renamed codes). The
 * transitive closure of those relations forms a connected component that is
 * treated as a single course: offerings, grades and professors are pooled, and
 * the page surfaces the other member codes as an "also known as" note.
 *
 * This module is the single source of truth for that grouping so both platforms
 * resolve aliases identically (no per-platform re-implementation).
 */
import type { NormalizedCourseCode } from "./brand";
import type { Catalogue } from "./dataTypes/domain";
import { normalizeCourseCode } from "./utils/courseUtils";

/** Connected-component grouping of course codes linked by catalogue aliases. */
export type AliasGroups = {
  /** Maps each member's normalized code to its component id. Standalone courses are absent. */
  componentByNorm: Map<NormalizedCourseCode, NormalizedCourseCode>;
  /** Maps a component id to its sorted member normalized codes (size >= 2). */
  membersByComponent: Map<NormalizedCourseCode, NormalizedCourseCode[]>;
};

/**
 * Build connected components over the undirected alias graph. Each course is linked to
 * every code in its `aliases` list; the transitive closure forms a component that is
 * treated as one course. The component id is the lexicographically smallest member code
 * (deterministic). Courses with no alias relation are omitted (callers treat a missing
 * lookup as a standalone component keyed by the code itself).
 */
export function buildAliasGroups(catalogue: Catalogue | null): AliasGroups {
  const parent = new Map<NormalizedCourseCode, NormalizedCourseCode>();
  const add = (x: NormalizedCourseCode) => {
    if (!parent.has(x)) parent.set(x, x);
  };
  const find = (x: NormalizedCourseCode): NormalizedCourseCode => {
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root) as NormalizedCourseCode;
    let cur = x;
    while (parent.get(cur) !== root) {
      const next = parent.get(cur) as NormalizedCourseCode;
      parent.set(cur, root);
      cur = next;
    }
    return root;
  };
  const union = (a: NormalizedCourseCode, b: NormalizedCourseCode) => {
    add(a);
    add(b);
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(rb, ra);
  };

  if (catalogue) {
    for (const c of catalogue.courses) {
      const own = c.code;
      add(own);
      for (const a of c.aliases ?? []) {
        const aliasNorm = normalizeCourseCode(a);
        if (aliasNorm && aliasNorm !== own) union(own, aliasNorm);
      }
    }
  }

  const membersByRoot = new Map<NormalizedCourseCode, NormalizedCourseCode[]>();
  for (const node of parent.keys()) {
    const root = find(node);
    let list = membersByRoot.get(root);
    if (!list) {
      list = [];
      membersByRoot.set(root, list);
    }
    list.push(node);
  }

  const componentByNorm = new Map<NormalizedCourseCode, NormalizedCourseCode>();
  const membersByComponent = new Map<NormalizedCourseCode, NormalizedCourseCode[]>();
  for (const members of membersByRoot.values()) {
    if (members.length < 2) continue;
    members.sort((a, b) => a.localeCompare(b, "en"));
    const id = members[0];
    membersByComponent.set(id, members);
    for (const m of members) componentByNorm.set(m, id);
  }
  return { componentByNorm, membersByComponent };
}

/** Resolve a normalized code to its alias-component id (the code itself when standalone). */
export function resolveComponentId(
  norm: NormalizedCourseCode,
  componentByNorm: Map<NormalizedCourseCode, NormalizedCourseCode>,
): NormalizedCourseCode {
  return componentByNorm.get(norm) ?? norm;
}

/**
 * The other member codes of `norm`'s alias group (excluding `norm` itself).
 * Empty when the course is standalone. Useful for an "also known as" note.
 */
export function aliasSiblings(
  norm: NormalizedCourseCode,
  groups: AliasGroups,
): NormalizedCourseCode[] {
  const componentId = resolveComponentId(norm, groups.componentByNorm);
  const members = groups.membersByComponent.get(componentId);
  if (!members) return [];
  return members.filter((m) => m !== norm);
}
