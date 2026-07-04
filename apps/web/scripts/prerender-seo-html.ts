import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.join(__dirname, "..");
const distDir = path.join(webRoot, "dist", "client");
const templatePath = path.join(distDir, "index.html");
const seoPagesPath = path.join(webRoot, "src/lib/seo-pages.json");

const SITE_ORIGIN = "https://uoplan.party";
const SITE_NAME = "uoPlan";
const OG_IMAGE = `${SITE_ORIGIN}/og-image.png`;

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

function pageUrl(canonicalPath: string): string {
  return canonicalPath === "/" ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}${canonicalPath}`;
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

function breadcrumbLd(trail: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: pageUrl(crumb.path),
    })),
  };
}

/**
 * Static BreadcrumbList JSON-LD for the marketing / comparison pages so crawlers
 * see the trail in the prerendered HTML (the client route heads emit the same
 * structure at runtime). Returns null for pages that don't need a breadcrumb.
 */
function breadcrumbForPage(pageId: string, page: SeoPage) {
  if (pageId === "features") {
    return breadcrumbLd([
      { name: SITE_NAME, path: "/" },
      { name: "Features", path: "/features" },
    ]);
  }
  if (pageId === "compare") {
    return breadcrumbLd([
      { name: SITE_NAME, path: "/" },
      { name: "Compare", path: "/compare" },
    ]);
  }
  if (pageId.startsWith("vs")) {
    return breadcrumbLd([
      { name: SITE_NAME, path: "/" },
      { name: "Compare", path: "/compare" },
      { name: page.tabTitle, path: page.canonicalPath },
    ]);
  }
  return null;
}

function buildHeadInjection(page: SeoPage, pageId: string): string {
  const canonical = pageUrl(page.canonicalPath);
  const title = escapeHtml(page.title);
  const description = escapeAttr(page.description);
  const keywords = escapeAttr(page.keywords);

  const websiteLd = JSON.stringify(buildWebsiteJsonLd(), null, 2);
  const appLd = JSON.stringify(buildWebApplicationJsonLd(), null, 2);
  const breadcrumb = breadcrumbForPage(pageId, page);
  const breadcrumbScript = breadcrumb
    ? `
    <script type="application/ld+json">
${JSON.stringify(breadcrumb, null, 2)}
    </script>`
    : "";

  return `
    <meta name="keywords" content="${keywords}" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="${canonical}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${SITE_NAME}" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${OG_IMAGE}" />
    <meta property="twitter:card" content="summary_large_image" />
    <meta property="twitter:url" content="${canonical}" />
    <meta property="twitter:title" content="${title}" />
    <meta property="twitter:description" content="${description}" />
    <meta property="twitter:image" content="${OG_IMAGE}" />
    <script type="application/ld+json">
${websiteLd}
    </script>
    <script type="application/ld+json">
${appLd}
    </script>${breadcrumbScript}`;
}

function injectPageMeta(html: string, page: SeoPage, pageId: string): string {
  const tabTitle = escapeHtml(page.tabTitle);
  const description = escapeAttr(page.description);
  const headInjection = buildHeadInjection(page, pageId);

  const out = html
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

function writePrerenderedPage(template: string, pageId: string, outFile: string): void {
  const page = seoPages[pageId];
  if (!page) {
    throw new Error(`Unknown SEO page id: ${pageId}`);
  }
  const html = injectPageMeta(template, page, pageId);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, html, "utf8");
  console.log(`prerender-seo: wrote ${path.relative(webRoot, outFile)}`);
}

if (!fs.existsSync(templatePath)) {
  console.error(`prerender-seo: missing ${templatePath} — run vite build first`);
  process.exit(1);
}

const template = fs.readFileSync(templatePath, "utf8");

writePrerenderedPage(template, "home", path.join(distDir, "index.html"));
writePrerenderedPage(template, "features", path.join(distDir, "features", "index.html"));
writePrerenderedPage(template, "compare", path.join(distDir, "compare", "index.html"));
writePrerenderedPage(template, "vsUenroll", path.join(distDir, "vs", "uenroll", "index.html"));
writePrerenderedPage(template, "vsUschedule", path.join(distDir, "vs", "uschedule", "index.html"));
writePrerenderedPage(template, "vsUoGrades", path.join(distDir, "vs", "uo-grades", "index.html"));
writePrerenderedPage(
  template,
  "vsCoursemapper",
  path.join(distDir, "vs", "coursemapper", "index.html"),
);
writePrerenderedPage(template, "explore", path.join(distDir, "explore", "index.html"));
writePrerenderedPage(template, "graph", path.join(distDir, "graph", "index.html"));
writePrerenderedPage(template, "trends", path.join(distDir, "trends", "index.html"));
writePrerenderedPage(
  template,
  "trendsDisciplines",
  path.join(distDir, "trends", "disciplines", "index.html"),
);
writePrerenderedPage(
  template,
  "trendsCourses",
  path.join(distDir, "trends", "courses", "index.html"),
);
writePrerenderedPage(
  template,
  "trendsFeedback",
  path.join(distDir, "trends", "feedback", "index.html"),
);
writePrerenderedPage(
  template,
  "trendsLeaderboard",
  path.join(distDir, "trends", "leaderboard", "index.html"),
);
writePrerenderedPage(template, "schedule", path.join(distDir, "schedule", "index.html"));
writePrerenderedPage(template, "personalize", path.join(distDir, "personalize", "index.html"));
writePrerenderedPage(template, "changelog", path.join(distDir, "changelog", "index.html"));
writePrerenderedPage(template, "donate", path.join(distDir, "donate", "index.html"));
writePrerenderedPage(template, "privacy", path.join(distDir, "privacy", "index.html"));
writePrerenderedPage(template, "terms", path.join(distDir, "terms", "index.html"));
