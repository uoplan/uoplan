import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.join(__dirname, "..");
const repoRoot = path.join(webRoot, "..", "..");
const distDir = path.join(webRoot, "dist", "client");
const dataRoot = path.join(repoRoot, "apps", "scraper", "data");
const catalogueDir = path.join(dataRoot, "catalogue");
const seoPagesPath = path.join(webRoot, "src", "lib", "seo-pages.json");
const professorsPath = path.join(dataRoot, "professors.json");
const disciplinesPath = path.join(dataRoot, "disciplines.json");

const SITE_ORIGIN = "https://uoplan.party";
const SITEMAP_DIR = "sitemap";
const SITEMAPS = [
  `${SITEMAP_DIR}/courses.xml`,
  `${SITEMAP_DIR}/professors.xml`,
  `${SITEMAP_DIR}/programs.xml`,
  `${SITEMAP_DIR}/misc.xml`,
];

interface Catalogue {
  courses?: { code?: unknown }[];
  programs?: { slug?: unknown }[];
}
interface ProfessorsData {
  professors?: { slug?: unknown }[];
}
interface DisciplinesData {
  disciplines?: { code?: unknown }[];
  faculties?: { id?: unknown }[];
}
interface SeoPage {
  canonicalPath?: unknown;
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function decodePathValue(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function encodePathSegment(value: string): string {
  return encodeURIComponent(decodePathValue(value));
}

function encodePath(pathValue: string): string {
  return pathValue.split("/").filter(Boolean).map(encodePathSegment).join("/");
}

function absoluteUrl(pathname: string): string {
  return pathname === "/" ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}${pathname}`;
}

function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, "en"));
}

function normalizeCourseCode(rawCode: unknown): string | null {
  if (typeof rawCode !== "string") return null;
  const trimmed = rawCode.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/^([A-Z]{3,4})\s*(\d{4,5}[A-Z]?)$/i);
  if (!match?.[1] || !match[2]) return trimmed;
  return `${match[1].toUpperCase()} ${match[2]}`;
}

function courseNormToPathParam(courseCode: string): string {
  return courseCode.replaceAll(/\s+/g, "").toLowerCase();
}

function normalizeProgramSlug(rawSlug: unknown): string | null {
  if (typeof rawSlug !== "string") return null;
  const slug = rawSlug.trim().replace(/^\/+/, "").replace(/\/+$/, "");
  return slug || null;
}

function readCatalogueCollections(): {
  catalogueFiles: string[];
  courseCodes: string[];
  programSlugs: string[];
} {
  const catalogueFiles = fs
    .readdirSync(catalogueDir)
    .filter((name) => /^catalogue\.\d{4}\.json$/.test(name))
    .sort((a, b) => b.localeCompare(a, "en"));

  const courseCodes = new Set<string>();
  const programSlugs = new Set<string>();

  for (const fileName of catalogueFiles) {
    const catalogue = readJson<Catalogue>(path.join(catalogueDir, fileName));

    for (const course of catalogue.courses ?? []) {
      const courseCode = normalizeCourseCode(course?.code);
      if (courseCode) courseCodes.add(courseCode);
    }

    for (const program of catalogue.programs ?? []) {
      const slug = normalizeProgramSlug(program?.slug);
      if (slug) programSlugs.add(slug);
    }
  }

  return {
    catalogueFiles,
    courseCodes: uniqueSorted(courseCodes),
    programSlugs: uniqueSorted(programSlugs),
  };
}

function readProfessorSlugs(): string[] {
  const data = readJson<ProfessorsData>(professorsPath);
  const slugs: string[] = [];

  for (const professor of data.professors ?? []) {
    if (typeof professor?.slug === "string" && professor.slug.trim()) {
      slugs.push(professor.slug.trim());
    }
  }

  return uniqueSorted(slugs);
}

function readDisciplineAndFacultyPaths(): string[] {
  const data = readJson<DisciplinesData>(disciplinesPath);
  const paths: string[] = [];

  for (const discipline of data.disciplines ?? []) {
    if (typeof discipline?.code === "string" && discipline.code.trim()) {
      paths.push(`/explore/discipline/${encodePathSegment(discipline.code.trim().toLowerCase())}`);
    }
  }

  for (const faculty of data.faculties ?? []) {
    if (typeof faculty?.id === "string" && faculty.id.trim()) {
      paths.push(`/explore/faculty/${encodePathSegment(faculty.id.trim())}`);
    }
  }

  return uniqueSorted(paths);
}

function readStaticPaths(): string[] {
  const seoPages = readJson<Record<string, SeoPage>>(seoPagesPath);
  const paths: string[] = [];

  for (const page of Object.values(seoPages)) {
    if (typeof page?.canonicalPath === "string" && page.canonicalPath.trim()) {
      paths.push(page.canonicalPath.trim());
    }
  }

  return uniqueSorted(paths);
}

function urlsetXml(paths: string[]): string {
  const urls = paths
    .map((pathname) => `  <url>\n    <loc>${escapeXml(absoluteUrl(pathname))}</loc>\n  </url>`)
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function sitemapIndexXml(fileNames: string[]): string {
  const entries = fileNames
    .map(
      (fileName) =>
        `  <sitemap>\n    <loc>${escapeXml(`${SITE_ORIGIN}/${fileName}`)}</loc>\n  </sitemap>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</sitemapindex>\n`;
}

function writeFile(fileName: string, content: string): void {
  const outPath = path.join(distDir, fileName);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, content, "utf8");
  console.log(`generate-sitemap: wrote ${path.relative(webRoot, outPath)}`);
}

fs.mkdirSync(distDir, { recursive: true });

const { catalogueFiles, courseCodes, programSlugs } = readCatalogueCollections();
const professorSlugs = readProfessorSlugs();
const miscPaths = uniqueSorted([...readStaticPaths(), ...readDisciplineAndFacultyPaths()]);

const coursePaths = courseCodes.map(
  (courseCode) => `/explore/course/${courseNormToPathParam(courseCode)}`,
);
const professorPaths = professorSlugs.map(
  (slug) => `/explore/professor/${encodePathSegment(slug)}`,
);
const programPaths = programSlugs.map((slug) => `/explore/program/${encodePath(slug)}`);

writeFile(`${SITEMAP_DIR}/courses.xml`, urlsetXml(coursePaths));
writeFile(`${SITEMAP_DIR}/professors.xml`, urlsetXml(professorPaths));
writeFile(`${SITEMAP_DIR}/programs.xml`, urlsetXml(programPaths));
writeFile(`${SITEMAP_DIR}/misc.xml`, urlsetXml(miscPaths));
writeFile("sitemap.xml", sitemapIndexXml(SITEMAPS));

console.log(
  [
    `generate-sitemap: catalogues=${catalogueFiles.length}`,
    `courses=${coursePaths.length}`,
    `professors=${professorPaths.length}`,
    `programs=${programPaths.length}`,
    `misc=${miscPaths.length}`,
  ].join(" "),
);
