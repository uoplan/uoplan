import { CATEGORIES, FEATURES } from "./features";
import { COMPETITORS, UOPLAN_PRODUCT } from "./products";
import type {
  Feature,
  FeatureCategory,
  Product,
  ProductId,
  SupportLevel,
  VsPairing,
} from "./types";

export type {
  Feature,
  FeatureCategory,
  FeatureSupport,
  Product,
  ProductId,
  SupportLevel,
  VsPairing,
} from "./types";
export { CATEGORIES, FEATURES } from "./features";
export { COMPETITORS, PRODUCTS } from "./products";

/** Rank used to compare two support levels ("more supported" = higher). */
const SUPPORT_RANK: Record<SupportLevel, number> = { no: 0, partial: 1, yes: 2 };

export interface CategoryFeatures {
  category: FeatureCategory;
  features: Feature[];
}

/** All features grouped by category, in category + declaration order. */
export function featuresByCategory(features: readonly Feature[] = FEATURES): CategoryFeatures[] {
  return CATEGORIES.map((category) => ({
    category,
    features: features.filter((feature) => feature.categoryId === category.id),
  })).filter((group) => group.features.length > 0);
}

/** Features uoPlan actually offers (level yes or partial) — powers `/features`. */
export function uoplanFeatures(): Feature[] {
  return FEATURES.filter((feature) => feature.support.uoplan.level !== "no");
}

/** Look up a competitor by its `/vs/<slug>` segment. */
export function getCompetitorBySlug(slug: string): Product | undefined {
  return COMPETITORS.find((product) => product.vsSlug === slug);
}

/** Count of features at a given support level for a product. */
export function countSupport(productId: ProductId, level: SupportLevel): number {
  return FEATURES.filter((feature) => feature.support[productId].level === level).length;
}

/**
 * Build the uoPlan-vs-competitor split used by the `/vs/<slug>` pages: which
 * features uoPlan wins, which tie, and which the competitor wins (honest gaps).
 * Features where both are "no" are omitted (irrelevant to either).
 */
export function vsPairing(competitor: Product): VsPairing {
  const uoplanWins: Feature[] = [];
  const ties: Feature[] = [];
  const competitorWins: Feature[] = [];

  for (const feature of FEATURES) {
    const uoplanRank = SUPPORT_RANK[feature.support.uoplan.level];
    const competitorRank = SUPPORT_RANK[feature.support[competitor.id].level];
    if (uoplanRank === 0 && competitorRank === 0) continue;

    if (uoplanRank > competitorRank) uoplanWins.push(feature);
    else if (uoplanRank < competitorRank) competitorWins.push(feature);
    else ties.push(feature);
  }

  return { competitor, uoplanWins, ties, competitorWins };
}

export const UOPLAN: Product = UOPLAN_PRODUCT;
