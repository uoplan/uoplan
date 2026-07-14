import { describe, expect, it } from "vitest";
import seoPages from "../seo-pages.json";
import {
  CATEGORIES,
  COMPETITORS,
  countSupport,
  FEATURES,
  featuresByCategory,
  getCompetitorBySlug,
  PRODUCTS,
  uoplanFeatures,
  vsPairing,
} from "./index";
import type { ProductId } from "./types";

const PRODUCT_IDS = PRODUCTS.map((product) => product.id);
const CATEGORY_IDS = new Set(CATEGORIES.map((category) => category.id));

describe("comparison data integrity", () => {
  it("has uoPlan first and unique product ids/slugs", () => {
    expect(PRODUCTS[0]?.id).toBe("uoplan");
    expect(PRODUCTS[0]?.isUoplan).toBe(true);
    expect(new Set(PRODUCT_IDS).size).toBe(PRODUCT_IDS.length);

    const slugs = COMPETITORS.map((product) => product.vsSlug);
    expect(slugs.every(Boolean)).toBe(true);
    expect(new Set(slugs).size).toBe(slugs.length);
    // uoPlan itself never has a /vs slug.
    expect(PRODUCTS.find((product) => product.isUoplan)?.vsSlug).toBeUndefined();
  });

  it("gives every feature a known category and full per-product support", () => {
    const ids = new Set<string>();
    for (const feature of FEATURES) {
      expect(ids.has(feature.id), `duplicate feature id ${feature.id}`).toBe(false);
      ids.add(feature.id);
      expect(CATEGORY_IDS.has(feature.categoryId)).toBe(true);
      for (const productId of PRODUCT_IDS) {
        const support = feature.support[productId as ProductId];
        expect(support, `${feature.id} missing ${productId}`).toBeTruthy();
        expect(["yes", "partial", "no"]).toContain(support.level);
      }
    }
  });

  it("models quick course-first scheduling across every product", () => {
    const feature = FEATURES.find(({ id }) => id === "quick-schedule");

    expect(feature).toMatchObject({
      categoryId: "scheduling",
      support: {
        uoplan: { level: "yes" },
        uenroll: { level: "yes" },
        uschedule: { level: "yes" },
        "uo-grades": { level: "no" },
      },
    });
    expect(uoplanFeatures().some(({ id }) => id === "quick-schedule")).toBe(true);
  });

  it("derives translation ids consistently", () => {
    for (const feature of FEATURES) {
      expect(feature.nameId).toBe(`compare.feature.${feature.id}.name`);
      expect(feature.descId).toBe(`compare.feature.${feature.id}.desc`);
      for (const productId of PRODUCT_IDS) {
        const { noteId } = feature.support[productId as ProductId];
        if (noteId) {
          expect(noteId).toBe(`compare.feature.${feature.id}.note.${productId}`);
        }
      }
    }
  });

  it("only groups features that exist and covers all non-empty categories", () => {
    const grouped = featuresByCategory();
    const total = grouped.reduce((sum, group) => sum + group.features.length, 0);
    expect(total).toBe(FEATURES.length);
  });

  it("exposes uoPlan's own feature set for /features", () => {
    const own = uoplanFeatures();
    expect(own.length).toBeGreaterThan(0);
    expect(own.every((feature) => feature.support.uoplan.level !== "no")).toBe(true);
  });

  it("splits vs pairings without double-counting and keeps honest gaps", () => {
    for (const competitor of COMPETITORS) {
      const pairing = vsPairing(competitor);
      const seen = new Set<string>();
      for (const feature of [...pairing.uoplanWins, ...pairing.ties, ...pairing.competitorWins]) {
        expect(seen.has(feature.id)).toBe(false);
        seen.add(feature.id);
      }
    }

    // Fairness: at least one competitor must genuinely beat uoPlan somewhere.
    const anyGap = COMPETITORS.some(
      (competitor) => vsPairing(competitor).competitorWins.length > 0,
    );
    expect(anyGap).toBe(true);
  });

  it("counts support levels", () => {
    expect(countSupport("uoplan", "yes")).toBeGreaterThan(0);
  });

  it("matches each competitor slug to a seo-pages.json entry", () => {
    const canonicalPaths = new Set(
      Object.values(seoPages).map((page) => (page as { canonicalPath?: string }).canonicalPath),
    );
    for (const competitor of COMPETITORS) {
      expect(getCompetitorBySlug(competitor.vsSlug as string)).toBe(competitor);
      expect(canonicalPaths.has(`/vs/${competitor.vsSlug}`)).toBe(true);
    }
    expect(canonicalPaths.has("/features")).toBe(true);
    expect(canonicalPaths.has("/compare")).toBe(true);
  });
});
