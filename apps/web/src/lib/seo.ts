import seoPages from "./seo-pages.json";
import { tr } from "../i18n";

const SITE_ORIGIN = "https://uoplan.party";
const SITE_NAME = "uoplan";
const DEFAULT_OG_IMAGE = `${SITE_ORIGIN}/og-image.png`;

type SeoPageId = keyof typeof seoPages;

function pageUrl(canonicalPath: string): string {
  return canonicalPath === "/" ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}${canonicalPath}`;
}

function localized(pageId: SeoPageId, field: "title" | "description" | "keywords"): string {
  const fallback = seoPages[pageId][field];
  const translated = tr(`seo.${pageId}.${field}`);
  return translated !== `seo.${pageId}.${field}` ? translated : fallback;
}

function buildWebsiteJsonLd(): Record<string, unknown> {
  const hasPart = (Object.keys(seoPages) as SeoPageId[]).map((id) => {
    const page = seoPages[id];
    return {
      "@type": "WebPage",
      name: page.structuredName,
      url: pageUrl(page.canonicalPath),
      description: page.description,
    };
  });

  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: `${SITE_ORIGIN}/`,
    description: seoPages.schedule.description,
    hasPart,
  };
}

function buildWebApplicationJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: SITE_NAME,
    url: `${SITE_ORIGIN}/`,
    description: "Free course planner and timetable generator for University of Ottawa students.",
    applicationCategory: "EducationApplication",
    operatingSystem: "Web",
    offers: { "@type": "Offer", price: "0", priceCurrency: "CAD" },
    audience: {
      "@type": "EducationalAudience",
      educationalRole: "student",
    },
  };
}

export function buildRootHead() {
  return {
    meta: [
      { name: "robots", content: "index, follow" },
      { property: "og:site_name", content: SITE_NAME },
      { property: "og:image", content: DEFAULT_OG_IMAGE },
      { property: "twitter:card", content: "summary_large_image" },
      { property: "twitter:image", content: DEFAULT_OG_IMAGE },
      { "script:ld+json": buildWebsiteJsonLd() },
      { "script:ld+json": buildWebApplicationJsonLd() },
    ],
  };
}

export function buildPageHead(pageId: SeoPageId) {
  const page = seoPages[pageId];
  const canonical = pageUrl(page.canonicalPath);
  const title = localized(pageId, "title");
  const description = localized(pageId, "description");
  const keywords = localized(pageId, "keywords");

  return {
    meta: [
      { title },
      { name: "description", content: description },
      { name: "keywords", content: keywords },
      { property: "og:type", content: "website" },
      { property: "og:url", content: canonical },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "twitter:url", content: canonical },
      { property: "twitter:title", content: title },
      { property: "twitter:description", content: description },
    ],
    links: [{ rel: "canonical", href: canonical }],
  };
}
