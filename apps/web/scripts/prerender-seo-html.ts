import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_SCHOOL_ID, SCHOOLS, withSchoolPath } from "@uoplan/domain/school";
import { schoolsWithData } from "./school-data.ts";
import type { SchoolFeatures, SchoolId } from "@uoplan/domain/school";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.join(__dirname, "..");
const distDir = path.join(webRoot, "dist", "client");
const templatePath = path.join(distDir, "index.html");
const seoPagesPath = path.join(webRoot, "src/lib/seo-pages.json");

const SITE_ORIGIN = "https://uoplan.party";
const SITE_NAME = "uoPlan";

/** OG image URL for a given school. uOttawa serves from the root; others from `/<pathSlug>/`. */
function schoolOgImage(school: SchoolId): string {
  return `${SITE_ORIGIN}${withSchoolPath(school, "/og-image.png")}`;
}

interface SeoPage {
  canonicalPath: string;
  tabTitle: string;
  title: string;
  description: string;
  keywords: string;
  structuredName: string;
  noscriptTitle: string;
  noscriptBody: string;
}

const seoPages = JSON.parse(fs.readFileSync(seoPagesPath, "utf8")) as Record<string, SeoPage>;

/**
 * Absolute canonical URL for a page under one school.
 *
 * uOttawa is the unprefixed school, so `withSchoolPath` is a no-op for it and
 * every pre-existing canonical URL is byte-identical to what search engines
 * already have indexed.
 */
function pageUrl(canonicalPath: string, school: SchoolId = DEFAULT_SCHOOL_ID): string {
  const prefixed = withSchoolPath(school, canonicalPath);
  // `withSchoolPath(school, "/")` yields "/carleton" for prefixed schools. A school
  // home page is a directory, so keep its trailing slash (uOttawa's root is already
  // "/"). Non-root paths keep whatever slash convention they were declared with —
  // uOttawa's existing canonicals are mixed and must not change.
  const normalized = canonicalPath === "/" && !prefixed.endsWith("/") ? `${prefixed}/` : prefixed;
  return `${SITE_ORIGIN}${normalized}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttr(value: string): string {
  return escapeHtml(value);
}

function buildWebsiteJsonLd() {
  const hasPart = Object.values(seoPages).map((page) => ({
    "@type": "WebPage",
    name: page.structuredName,
    url: pageUrl(page.canonicalPath),
    description: page.description,
  }));

  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: `${SITE_ORIGIN}/`,
    description: seoPages.schedule.description,
    hasPart,
  };
}

function buildWebApplicationJsonLd() {
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

function breadcrumbLd(trail: { name: string; path: string }[], school: SchoolId) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: pageUrl(crumb.path, school),
    })),
  };
}

/**
 * Static BreadcrumbList JSON-LD for the marketing / comparison pages so crawlers
 * see the trail in the prerendered HTML (the client route heads emit the same
 * structure at runtime). Returns null for pages that don't need a breadcrumb.
 */
function breadcrumbForPage(pageId: string, page: SeoPage, school: SchoolId) {
  if (pageId === "features") {
    return breadcrumbLd(
      [
        { name: SITE_NAME, path: "/" },
        { name: "Features", path: "/features" },
      ],
      school,
    );
  }
  if (pageId === "compare") {
    return breadcrumbLd(
      [
        { name: SITE_NAME, path: "/" },
        { name: "Compare", path: "/compare" },
      ],
      school,
    );
  }
  if (pageId.startsWith("vs")) {
    return breadcrumbLd(
      [
        { name: SITE_NAME, path: "/" },
        { name: "Compare", path: "/compare" },
        { name: page.tabTitle, path: page.canonicalPath },
      ],
      school,
    );
  }
  return null;
}

const SEO_BLOCK_START = "<!-- prerender-seo:start -->";
const SEO_BLOCK_END = "<!-- prerender-seo:end -->";

function buildHeadInjection(
  page: SeoPage,
  pageId: string,
  school: SchoolId,
  ogImage: string,
): string {
  const canonical = pageUrl(page.canonicalPath, school);
  const title = escapeHtml(page.title);
  const description = escapeAttr(page.description);
  const keywords = escapeAttr(page.keywords);

  const websiteLd = JSON.stringify(buildWebsiteJsonLd(), null, 2);
  const appLd = JSON.stringify(buildWebApplicationJsonLd(), null, 2);
  const breadcrumb = breadcrumbForPage(pageId, page, school);
  const breadcrumbScript = breadcrumb
    ? `
    <script type="application/ld+json">
${JSON.stringify(breadcrumb, null, 2)}
    </script>`
    : "";

  return `
    ${SEO_BLOCK_START}
    <meta name="keywords" content="${keywords}" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="${canonical}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${SITE_NAME}" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${ogImage}" />
    <meta property="twitter:card" content="summary_large_image" />
    <meta property="twitter:url" content="${canonical}" />
    <meta property="twitter:title" content="${title}" />
    <meta property="twitter:description" content="${description}" />
    <meta property="twitter:image" content="${ogImage}" />
    <script type="application/ld+json">
${websiteLd}
    </script>
    <script type="application/ld+json">
${appLd}
    </script>${breadcrumbScript}
    ${SEO_BLOCK_END}`;
}

function injectPageMeta(
  html: string,
  page: SeoPage,
  pageId: string,
  school: SchoolId,
  ogImage: string,
): string {
  const tabTitle = escapeHtml(page.tabTitle);
  const description = escapeAttr(page.description);
  const headInjection = buildHeadInjection(page, pageId, school, ogImage);

  // Strip any previously injected block first. A normal build always starts from a
  // fresh Vite `index.html`, but re-running this script over its own output (a local
  // re-run, or a retried CI step) would otherwise append a second copy of every meta
  // tag — including a duplicate <link rel="canonical">, which search engines treat as
  // a conflicting signal. Making the injection idempotent removes that failure mode.
  const stripped = html.replaceAll(
    new RegExp(`\\s*${SEO_BLOCK_START}[\\s\\S]*?${SEO_BLOCK_END}`, "g"),
    "",
  );

  const out = stripped
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${tabTitle}</title>`)
    .replace(
      /<meta\s+name="description"\s+content="[^"]*"\s*\/>/,
      `<meta name="description" content="${description}" />`,
    )
    .replace("</head>", `${headInjection}\n  </head>`)
    .replace(
      /<noscript>[\s\S]*?<\/noscript>/,
      `<noscript>
      <h1>${escapeHtml(page.noscriptTitle)}</h1>
      <p>${escapeHtml(page.noscriptBody)}</p>
    </noscript>`,
    );

  return out;
}

function writePrerenderedPage(
  template: string,
  pageId: string,
  outFile: string,
  school: SchoolId,
  ogImage: string,
): void {
  const page = seoPages[pageId];
  if (!page) {
    throw new Error(`Unknown SEO page id: ${pageId}`);
  }
  const html = injectPageMeta(template, page, pageId, school, ogImage);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, html, "utf8");
  console.log(`prerender-seo: wrote ${path.relative(webRoot, outFile)}`);
}

if (!fs.existsSync(templatePath)) {
  console.error(`prerender-seo: missing ${templatePath} — run vite build first`);
  process.exit(1);
}

const template = fs.readFileSync(templatePath, "utf8");

/**
 * Every prerendered page, as `[seo-pages.json id, output directory segments]`.
 * The directory mirrors the page's canonical path.
 */
const PRERENDERED_PAGES: [pageId: string, segments: string[]][] = [
  ["home", []],
  ["features", ["features"]],
  ["compare", ["compare"]],
  ["vsUenroll", ["vs", "uenroll"]],
  ["vsUschedule", ["vs", "uschedule"]],
  ["vsUoGrades", ["vs", "uo-grades"]],
  ["explore", ["explore"]],
  ["graph", ["professor-graph"]],
  ["trends", ["trends"]],
  ["trendsDisciplines", ["trends", "disciplines"]],
  ["trendsCourses", ["trends", "courses"]],
  ["trendsFeedback", ["trends", "feedback"]],
  ["trendsLeaderboard", ["trends", "leaderboard"]],
  ["schedule", ["schedule"]],
  ["personalize", ["personalize"]],
  ["changelog", ["changelog"]],
  ["donate", ["donate"]],
  ["privacy", ["privacy"]],
  ["terms", ["terms"]],
  ["importantDates", ["important-dates-and-deadlines"]],
];

/**
 * Pages that only make sense for a school publishing the underlying data.
 * Every `trends` surface and the uOttawa-grades comparison page are built
 * entirely from registrar grade distributions, so a school without grades would
 * otherwise get indexable pages that render empty.
 */
const PAGE_REQUIRED_FEATURE: Record<string, keyof SchoolFeatures> = {
  vsUoGrades: "grades",
  trends: "grades",
  trendsDisciplines: "grades",
  trendsCourses: "grades",
  trendsFeedback: "feedback",
  trendsLeaderboard: "grades",
};

// Only schools whose scraped data is present, matching `generate-sitemap` and
// `build-data-proto`. Prerendering `/carleton/*` shells for a school whose `.pb`
// assets were never built would publish crawlable pages that cannot load a
// catalogue — and the client-side picker hides that school for the same reason.
for (const school of schoolsWithData()) {
  const { features, pathSlug } = SCHOOLS[school];
  const schoolDir = pathSlug ? path.join(distDir, pathSlug) : distDir;
  const ogImage = schoolOgImage(school);

  for (const [pageId, segments] of PRERENDERED_PAGES) {
    const required = PAGE_REQUIRED_FEATURE[pageId];
    if (required !== undefined && !features[required]) continue;
    writePrerenderedPage(
      template,
      pageId,
      path.join(schoolDir, ...segments, "index.html"),
      school,
      ogImage,
    );
  }
}
