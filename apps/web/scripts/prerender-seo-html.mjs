import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.join(__dirname, "..");
const distDir = path.join(webRoot, "dist", "client");
const templatePath = path.join(distDir, "index.html");
const seoPagesPath = path.join(webRoot, "src/lib/seo-pages.json");

const SITE_ORIGIN = "https://uoplan.party";
const SITE_NAME = "uoplan";
const OG_IMAGE = `${SITE_ORIGIN}/og-image.png`;

/** @type {Record<string, {
 *   canonicalPath: string;
 *   title: string;
 *   description: string;
 *   keywords: string;
 *   structuredName: string;
 *   noscriptTitle: string;
 *   noscriptBody: string;
 * }>} */
const seoPages = JSON.parse(fs.readFileSync(seoPagesPath, "utf8"));

function pageUrl(canonicalPath) {
  return canonicalPath === "/" ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}${canonicalPath}`;
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value) {
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

function buildHeadInjection(page) {
  const canonical = pageUrl(page.canonicalPath);
  const title = escapeHtml(page.title);
  const description = escapeAttr(page.description);
  const keywords = escapeAttr(page.keywords);

  const websiteLd = JSON.stringify(buildWebsiteJsonLd(), null, 2);
  const appLd = JSON.stringify(buildWebApplicationJsonLd(), null, 2);

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
    </script>`;
}

function injectPageMeta(html, page) {
  const title = escapeHtml(page.title);
  const description = escapeAttr(page.description);
  const headInjection = buildHeadInjection(page);

  let out = html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`)
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

function writePrerenderedPage(template, pageId, outFile) {
  const page = seoPages[pageId];
  if (!page) {
    throw new Error(`Unknown SEO page id: ${pageId}`);
  }
  const html = injectPageMeta(template, page);
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
writePrerenderedPage(template, "explore", path.join(distDir, "explore", "index.html"));
writePrerenderedPage(template, "graph", path.join(distDir, "graph", "index.html"));
writePrerenderedPage(template, "trends", path.join(distDir, "trends", "index.html"));
writePrerenderedPage(template, "schedule", path.join(distDir, "schedule", "index.html"));
writePrerenderedPage(template, "personalize", path.join(distDir, "personalize", "index.html"));
