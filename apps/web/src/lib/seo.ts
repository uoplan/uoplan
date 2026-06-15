import seoPages from "./seo-pages.json";
import { tr } from "../i18n";

const SITE_ORIGIN = "https://uoplan.party";
const SITE_NAME = "uoplan";
const DEFAULT_OG_IMAGE = `${SITE_ORIGIN}/og-image.png`;

type SeoPageId = keyof typeof seoPages;

interface DynamicHeadInput {
  title: string;
  description: string;
  canonicalPath: string;
  keywords?: string;
}

interface CourseHeadInput {
  courseCode: string;
  pathParam: string;
}

interface ProgramHeadInput {
  slug: string;
  pathParam: string;
}

const FACULTY_NAME_BY_ID: Record<string, string> = {
  arts: "Faculty of Arts",
  education: "Faculty of Education",
  engineering: "Faculty of Engineering",
  "health-sciences": "Faculty of Health Sciences",
  law: "Faculty of Law",
  "law-civil-law": "Faculty of Law - Civil Law",
  "law-common-law": "Faculty of Law - Common Law",
  medicine: "Faculty of Medicine",
  science: "Faculty of Science",
  "social-sciences": "Faculty of Social Sciences",
  "telfer-school-of-management": "Telfer School of Management",
  "vice-rector-academic": "Vice Rector Academic",
};

function pageUrl(canonicalPath: string): string {
  return canonicalPath === "/" ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}${canonicalPath}`;
}

function decodePathValue(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function pathSegmentFromParam(value: string): string {
  return encodeURIComponent(decodePathValue(value.trim()));
}

function pathFromSplatParam(value: string): string {
  return value
    .trim()
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .split("/")
    .filter(Boolean)
    .map(pathSegmentFromParam)
    .join("/");
}

function toTitleCase(value: string): string {
  return value
    .replaceAll(/[-_]+/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((word) => {
      const lower = word.toLowerCase();
      if (["ba", "bcom", "bsc", "jd", "llm", "ma", "mba", "md", "msc", "phd"].includes(lower)) {
        return lower.toUpperCase();
      }
      return `${lower.slice(0, 1).toUpperCase()}${lower.slice(1)}`;
    })
    .join(" ");
}

function humanizeProfessorParam(param: string): string | null {
  const decoded = decodePathValue(param).trim();
  if (!decoded || /^\d+$/.test(decoded)) return null;
  return toTitleCase(decoded);
}

function humanizeProgramSlug(slug: string): string {
  const segments = slug.replace(/^\/+/, "").replace(/\/+$/, "").split("/").filter(Boolean);
  const programSegment = segments.at(-1) ?? slug;
  return toTitleCase(decodePathValue(programSegment)) || "Program";
}

function humanizeFacultyParam(param: string): string {
  const id = decodePathValue(param).trim().toLowerCase();
  const knownName = FACULTY_NAME_BY_ID[id];
  if (knownName) return knownName;

  const name = toTitleCase(id);
  if (/^(Faculty|School|Telfer|Vice Rector)\b/.test(name)) return name;
  return `Faculty of ${name}`;
}

function professorSeoTitle(name: string | null): string {
  return name
    ? `${name} — uOttawa professor ratings & grades | uoplan`
    : "uOttawa professor ratings & grades | uoplan";
}

function localized(pageId: SeoPageId, field: "title" | "description" | "keywords"): string {
  const fallback = seoPages[pageId][field];
  if (field === "title") return fallback;

  const id = `seo.${pageId}.${field}`;
  const translated = tr(id);
  return translated !== id ? translated : fallback;
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
  const tabTitle = page.tabTitle;
  const ogTitle = localized(pageId, "title");
  const description = localized(pageId, "description");
  const keywords = localized(pageId, "keywords");

  return {
    meta: [
      { title: tabTitle },
      { name: "description", content: description },
      { name: "keywords", content: keywords },
      { property: "og:type", content: "website" },
      { property: "og:url", content: canonical },
      { property: "og:title", content: ogTitle },
      { property: "og:description", content: description },
      { property: "twitter:url", content: canonical },
      { property: "twitter:title", content: ogTitle },
      { property: "twitter:description", content: description },
    ],
    links: [{ rel: "canonical", href: canonical }],
  };
}

function buildDynamicHead({ title, description, canonicalPath, keywords = "" }: DynamicHeadInput) {
  const canonical = pageUrl(canonicalPath);

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

export function buildCourseHead({ courseCode, pathParam }: CourseHeadInput) {
  const compactCode = courseCode.replaceAll(/\s+/g, "");

  return buildDynamicHead({
    title: `${courseCode} — uOttawa grades, sections & professor ratings | uoplan`,
    description: `Explore ${courseCode} grade distributions, sections, schedules, and professor ratings at the University of Ottawa.`,
    keywords: `${courseCode}, ${compactCode}, uOttawa course grades, uOttawa sections, uOttawa professor ratings`,
    canonicalPath: `/explore/course/${pathSegmentFromParam(pathParam)}`,
  });
}

export function buildProfessorHead(pathParam: string) {
  const name = humanizeProfessorParam(pathParam);
  const subject = name ? `${name} at uOttawa` : "uOttawa professors";

  return buildDynamicHead({
    title: professorSeoTitle(name),
    description: `Explore ${subject}: grade distributions, course history, professor ratings, and student feedback.`,
    keywords: name
      ? `${name}, uOttawa professor ratings, uOttawa grades, University of Ottawa professors`
      : "uOttawa professor ratings, uOttawa grades, University of Ottawa professors",
    canonicalPath: `/explore/professor/${pathSegmentFromParam(pathParam)}`,
  });
}

export function buildProfessorDocumentTitle(displayName: string) {
  return professorSeoTitle(displayName.trim() || null);
}

export function buildProgramHead({ slug, pathParam }: ProgramHeadInput) {
  const programName = humanizeProgramSlug(slug);

  return buildDynamicHead({
    title: `${programName} — uOttawa program requirements | uoplan`,
    description: `Explore ${programName} requirements, required courses, and grade data for University of Ottawa programs.`,
    keywords: `${programName}, uOttawa program requirements, University of Ottawa programs, uOttawa degree planner`,
    canonicalPath: `/explore/program/${pathFromSplatParam(pathParam)}`,
  });
}

export function buildDisciplineHead(disciplineParam: string) {
  const code = decodePathValue(disciplineParam).trim().toUpperCase();

  return buildDynamicHead({
    title: `${code} — uOttawa courses & grades by discipline | uoplan`,
    description: `Explore ${code} courses at the University of Ottawa with grade distributions, sections, schedules, and professor ratings.`,
    keywords: `${code}, uOttawa ${code} courses, uOttawa course grades, University of Ottawa disciplines`,
    canonicalPath: `/explore/discipline/${pathSegmentFromParam(code.toLowerCase())}`,
  });
}

export function buildFacultyHead(facultyParam: string) {
  const facultyName = humanizeFacultyParam(facultyParam);
  const facultyId = decodePathValue(facultyParam).trim().toLowerCase();

  return buildDynamicHead({
    title: `${facultyName} — uOttawa courses & grades | uoplan`,
    description: `Explore ${facultyName} courses, disciplines, grade distributions, and professor ratings at the University of Ottawa.`,
    keywords: `${facultyName}, uOttawa courses, uOttawa course grades, University of Ottawa faculties`,
    canonicalPath: `/explore/faculty/${pathSegmentFromParam(facultyId)}`,
  });
}

export function buildTabTitle(title: string) {
  return { meta: [{ title }] };
}
