import seoPages from "../../apps/web/src/lib/seo-pages.json" with { type: "json" };

const SEO_LOCALIZED_FIELDS = ["description", "keywords"] as const;

export const SEO_TR_IDS = Object.keys(seoPages).flatMap((pageId) =>
  SEO_LOCALIZED_FIELDS.map((field) => `seo.${pageId}.${field}`),
);
