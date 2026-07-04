/**
 * Types for the competitor-comparison "single source of truth".
 *
 * The same `PRODUCTS` + `CATEGORIES` + `FEATURES` data drives three surfaces:
 *   - `/features`  — the full uoPlan feature set (rows where uoPlan is yes/partial)
 *   - `/compare`   — the master matrix (all products × all features)
 *   - `/vs/<slug>` — a 1-on-1 comparison (uoPlan vs one competitor)
 *
 * User-visible strings are referenced by translation id (`tr(id)`); brand names
 * (uEnroll, CourseMapper, …) are proper nouns and stay untranslated literals.
 */

/** Stable ids for every product in the comparison. `uoplan` is always us. */
export type ProductId = "uoplan" | "uenroll" | "uschedule" | "uo-grades" | "coursemapper";

/** How well a product supports a given feature. */
export type SupportLevel = "yes" | "partial" | "no";

export interface Product {
  id: ProductId;
  /** Brand name, shown verbatim (never translated). */
  name: string;
  /** Public URL (used for outbound links + structured data). */
  url: string;
  /** Bare host label for compact chrome, e.g. "uenroll.ca". */
  host: string;
  /** Translation id for the one-line positioning tagline. */
  taglineId: string;
  /** `/vs/<slug>` path segment. Absent for uoPlan itself. */
  vsSlug?: string;
  /** True only for uoPlan. */
  isUoplan?: boolean;
}

export interface FeatureCategory {
  id: string;
  /** Translation id for the category heading. */
  labelId: string;
}

export interface FeatureSupport {
  level: SupportLevel;
  /** Optional translation id for a short clarifying note on this cell. */
  noteId?: string;
}

export interface Feature {
  id: string;
  categoryId: string;
  /** Translation id for the short feature name. */
  nameId: string;
  /** Translation id for the one-line description (used on `/features`). */
  descId: string;
  /** Per-product support. Every `ProductId` must be present. */
  support: Record<ProductId, FeatureSupport>;
}

/** A uoPlan-vs-competitor pairing, pre-split for the `/vs` pages. */
export interface VsPairing {
  competitor: Product;
  /** Features uoPlan supports more fully than the competitor. */
  uoplanWins: Feature[];
  /** Features both support at the same level. */
  ties: Feature[];
  /** Features the competitor supports more fully than uoPlan (honest gaps). */
  competitorWins: Feature[];
}
