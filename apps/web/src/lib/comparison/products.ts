import type { Product, ProductId } from "./types";

/**
 * The products in the comparison, in display order. uoPlan is always first.
 *
 * `name`/`host`/`url` are factual brand metadata (not translated). Competitor
 * facts are as of 2026-07 (see the research behind `/compare`). Slugs feed the
 * dynamic `/vs/<slug>` route and `seo-pages.json` entries — keep them in sync.
 */
export const PRODUCTS: readonly Product[] = [
  {
    id: "uoplan",
    name: "uoPlan",
    url: "https://uoplan.party/",
    host: "uoplan.party",
    taglineId: "compare.product.uoplan.tagline",
    isUoplan: true,
  },
  {
    id: "uenroll",
    name: "uEnroll",
    url: "https://uenroll.ca",
    host: "uenroll.ca",
    taglineId: "compare.product.uenroll.tagline",
    vsSlug: "uenroll",
  },
  {
    id: "uschedule",
    name: "uSchedule",
    url: "https://uschedule.ca",
    host: "uschedule.ca",
    taglineId: "compare.product.uschedule.tagline",
    vsSlug: "uschedule",
  },
  {
    id: "uo-grades",
    name: "UO Grades",
    url: "https://uo.grades.zone",
    host: "uo.grades.zone",
    taglineId: "compare.product.uo-grades.tagline",
    vsSlug: "uo-grades",
  },
  {
    id: "coursemapper",
    name: "CourseMapper",
    url: "https://www.coursemapper.co/uottawa",
    host: "coursemapper.co",
    taglineId: "compare.product.coursemapper.tagline",
    vsSlug: "coursemapper",
  },
] as const;

const PRODUCT_BY_ID: Record<ProductId, Product> = Object.fromEntries(
  PRODUCTS.map((product) => [product.id, product]),
) as Record<ProductId, Product>;

export const UOPLAN_PRODUCT = PRODUCT_BY_ID.uoplan;

/** Competitors (everything except uoPlan), in display order. */
export const COMPETITORS: readonly Product[] = PRODUCTS.filter((product) => !product.isUoplan);
