//! Shared compare-selection model — the single source of truth for the
//! "add to compare" tray, consumed by BOTH the web app (`packages/store` slice)
//! and the native app (a small React context provider). It backs the transient,
//! session-only selection of resources the user wants to compare side-by-side
//! (courses first; the model is generic so professors / disciplines / faculties
//! can slot in later).
//!
//! The selection is intentionally *homogeneous*: every ref in a comparison
//! shares one `kind` (the compare route is keyed by resource kind), so adding a
//! ref of a different kind starts a fresh comparison. It is capped at
//! `MAX_COMPARE_ITEMS` and never persisted to share-state — compare ids travel in
//! the URL for shareability instead.

/** Every comparable resource kind. Course ships first; the rest are drop-ins. */
export const COMPARE_KINDS = ["course", "professor", "discipline", "faculty"] as const;

export type CompareKind = (typeof COMPARE_KINDS)[number];

export interface CompareRef {
  kind: CompareKind;
  id: string;
}

/** Need at least two entities for a comparison to be meaningful. */
export const MIN_COMPARE_ITEMS = 2;
/** Upper bound so the side-by-side grid stays readable. */
export const MAX_COMPARE_ITEMS = 4;

export function isCompareKind(value?: unknown): value is CompareKind {
  return typeof value === "string" && (COMPARE_KINDS as readonly string[]).includes(value);
}

export function compareRefsEqual(a: CompareRef, b: CompareRef): boolean {
  return a.kind === b.kind && a.id === b.id;
}

export function isInCompare(list: readonly CompareRef[], ref: CompareRef): boolean {
  return list.some((r) => compareRefsEqual(r, ref));
}

/**
 * Add `ref` to the comparison. No-op if already present. If `ref` is a different
 * `kind` than the current (homogeneous) selection, the selection resets to just
 * `[ref]`. When the selection is already at `MAX_COMPARE_ITEMS`, the add is
 * ignored (caller can surface a "limit reached" hint).
 */
export function addToCompare(list: readonly CompareRef[], ref: CompareRef): CompareRef[] {
  if (list.length > 0 && list[0].kind !== ref.kind) return [ref];
  if (isInCompare(list, ref)) return [...list];
  if (list.length >= MAX_COMPARE_ITEMS) return [...list];
  return [...list, ref];
}

export function removeFromCompare(list: readonly CompareRef[], ref: CompareRef): CompareRef[] {
  return list.filter((r) => !compareRefsEqual(r, ref));
}

/** Toggle `ref`'s membership, honouring the same kind-reset + cap rules as add. */
export function toggleCompare(list: readonly CompareRef[], ref: CompareRef): CompareRef[] {
  return isInCompare(list, ref) ? removeFromCompare(list, ref) : addToCompare(list, ref);
}

export function clearCompare(): CompareRef[] {
  return [];
}

/** The ids of all selected refs of `kind`, in selection order (for the URL). */
export function compareIdsForKind(list: readonly CompareRef[], kind: CompareKind): string[] {
  return list.filter((r) => r.kind === kind).map((r) => r.id);
}

/** Rebuild a homogeneous ref list from a `kind` + ids (e.g. decoded from a URL). */
export function compareRefsFromIds(kind: CompareKind, ids: readonly string[]): CompareRef[] {
  const seen = new Set<string>();
  const refs: CompareRef[] = [];
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    refs.push({ kind, id });
    if (refs.length >= MAX_COMPARE_ITEMS) break;
  }
  return refs;
}
