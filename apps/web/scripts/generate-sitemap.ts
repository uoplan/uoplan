import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withSchoolPath } from "@uoplan/domain/school";
import { schoolDataPaths, schoolsWithData } from "./school-data.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.join(__dirname, "..");
const distDir = path.join(webRoot, "dist", "client");
const seoPagesPath = path.join(webRoot, "src", "lib", "seo-pages.json");

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

function readCatalogueCollections(catalogueDir: string): {
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

function readProfessorSlugs(professorsPath: string): string[] {
  if (!fs.existsSync(professorsPath)) return [];
  const data = readJson<ProfessorsData>(professorsPath);
  const slugs: string[] = [];

  for (const professor of data.professors ?? []) {
    if (typeof professor?.slug === "string" && professor.slug.trim()) {
      slugs.push(professor.slug.trim());
    }
  }

  return uniqueSorted(slugs);
}

function readDisciplineAndFacultyPaths(disciplinesPath: string): string[] {
  if (!fs.existsSync(disciplinesPath)) return [];
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

const schools = schoolsWithData();
if (schools.length === 0) {
  throw new Error("generate-sitemap: no school has catalogue data under apps/scraper/data.");
}

const coursePaths: string[] = [];
const professorPaths: string[] = [];
const programPaths: string[] = [];
const miscPaths: string[] = [];
const perSchoolCounts: string[] = [];

// Static SEO pages are school-neutral templates, so each school gets its own
// prefixed copy. uOttawa is the unprefixed school, so `withSchoolPath` leaves
// its URLs exactly as they were before Carleton existed — the sitemap that
// search engines have already indexed does not change.
const staticPaths = readStaticPaths();

for (const school of schools) {
  const paths = schoolDataPaths(school);
  // `withSchoolPath(school, "/")` yields "/carleton" for prefixed schools. A school
  // home page is a directory, so keep its trailing slash to match the canonical the
  // prerenderer emits (uOttawa's root is already "/", so it is untouched). Non-root
  // paths keep whatever slash convention they were declared with.
  const prefix = (pathname: string) => {
    const prefixed = withSchoolPath(school, pathname);
    return pathname === "/" && !prefixed.endsWith("/") ? `${prefixed}/` : prefixed;
  };

  const { catalogueFiles, courseCodes, programSlugs } = readCatalogueCollections(
    paths.catalogueDir,
  );
  const professorSlugs = readProfessorSlugs(paths.professorsPath);

  coursePaths.push(
    ...courseCodes.map((code) => prefix(`/explore/course/${courseNormToPathParam(code)}`)),
  );
  professorPaths.push(
    ...professorSlugs.map((slug) => prefix(`/explore/professor/${encodePathSegment(slug)}`)),
  );
  programPaths.push(...programSlugs.map((slug) => prefix(`/explore/program/${encodePath(slug)}`)));
  miscPaths.push(
    ...staticPaths.map(prefix),
    ...readDisciplineAndFacultyPaths(paths.disciplinesPath).map(prefix),
  );

  perSchoolCounts.push(
    `${school}(catalogues=${catalogueFiles.length} courses=${courseCodes.length} ` +
      `professors=${professorSlugs.length} programs=${programSlugs.length})`,
  );
}

writeFile(`${SITEMAP_DIR}/courses.xml`, urlsetXml(uniqueSorted(coursePaths)));
writeFile(`${SITEMAP_DIR}/professors.xml`, urlsetXml(uniqueSorted(professorPaths)));
writeFile(`${SITEMAP_DIR}/programs.xml`, urlsetXml(uniqueSorted(programPaths)));
writeFile(`${SITEMAP_DIR}/misc.xml`, urlsetXml(uniqueSorted(miscPaths)));
writeFile("sitemap.xml", sitemapIndexXml(SITEMAPS));

console.log(
  [
    `generate-sitemap: schools=${schools.length}`,
    ...perSchoolCounts,
    `total courses=${coursePaths.length}`,
    `professors=${professorPaths.length}`,
    `programs=${programPaths.length}`,
    `misc=${miscPaths.length}`,
  ].join(" "),
);
