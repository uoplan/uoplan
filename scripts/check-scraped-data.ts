/**
 * Sanity-check freshly scraped JSON before it is pushed to the `data` branch.
 *
 * A scraper that silently returns an empty result set — an upstream layout
 * change, an expired session, a rate-limit page rendered as HTML — otherwise
 * looks like a successful run and happily overwrites good data with nothing.
 * This asserts the shape and rough magnitude of each dataset instead.
 *
 * Thresholds are deliberately loose. The point is to catch "the scrape broke",
 * not to pin exact counts that legitimately drift term to term.
 *
 * Usage: node scripts/check-scraped-data.ts --school=carleton
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getSchool, isSchoolId } from "@uoplan/domain/school";
import type { SchoolId } from "@uoplan/domain/school";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Lower bounds below which a dataset is assumed to be a failed scrape. */
const MIN_COURSES = 500;
const MIN_PROGRAMS = 50;
const MIN_TERMS = 1;
const MIN_SCHEDULED_COURSES_PER_TERM = 100;

type Problem = string;

function parseSchool(argv: readonly string[]): SchoolId {
  for (const arg of argv) {
    if (!arg.startsWith("--school=")) continue;
    const value = arg.slice("--school=".length);
    if (!isSchoolId(value)) throw new Error(`check-scraped-data: unknown school ${value}.`);
    return value;
  }
  throw new Error("check-scraped-data: --school=<id> is required.");
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf-8")) as unknown;
}

function countArray(value: unknown, key: string): number {
  if (typeof value !== "object" || value === null) return 0;
  const field = (value as Record<string, unknown>)[key];
  return Array.isArray(field) ? field.length : 0;
}

function checkCatalogue(dataDir: string, problems: Problem[]): void {
  const catalogueDir = join(dataDir, "catalogue");
  const manifestPath = join(catalogueDir, "catalogue.json");
  if (!existsSync(manifestPath)) {
    problems.push("catalogue/catalogue.json is missing");
    return;
  }

  const years = countArray(readJson(manifestPath), "years");
  if (years === 0) problems.push("catalogue/catalogue.json lists no years");

  // The live year is the one re-scraped on every run, so it is the one that can
  // regress. Archived years are written once and then skipped.
  const yearFiles = readdirSync(catalogueDir)
    .filter((f) => /^catalogue\.\d{4}\.json$/.test(f))
    .sort();
  const latest = yearFiles.at(-1);
  if (latest === undefined) {
    problems.push("catalogue/ has no per-year files");
    return;
  }

  const catalogue = readJson(join(catalogueDir, latest));
  const courses = countArray(catalogue, "courses");
  const programs = countArray(catalogue, "programs");
  if (courses < MIN_COURSES) {
    problems.push(`${latest} has only ${courses} courses (expected >= ${MIN_COURSES})`);
  }
  if (programs < MIN_PROGRAMS) {
    problems.push(`${latest} has only ${programs} programs (expected >= ${MIN_PROGRAMS})`);
  }
}

function checkTerms(dataDir: string, problems: Problem[]): string[] {
  const path = join(dataDir, "terms.json");
  if (!existsSync(path)) {
    problems.push("terms.json is missing");
    return [];
  }

  const parsed = readJson(path);
  const terms =
    typeof parsed === "object" && parsed !== null
      ? (parsed as { terms?: unknown }).terms
      : undefined;
  if (!Array.isArray(terms) || terms.length < MIN_TERMS) {
    problems.push(`terms.json has ${Array.isArray(terms) ? terms.length : 0} terms`);
    return [];
  }

  return terms
    .map((t) =>
      typeof t === "object" && t !== null ? String((t as { termId?: unknown }).termId) : "",
    )
    .filter(Boolean);
}

function checkSchedules(dataDir: string, termIds: readonly string[], problems: Problem[]): void {
  for (const termId of termIds) {
    const path = join(dataDir, "schedules", `schedules.${termId}.json`);
    if (!existsSync(path)) {
      problems.push(`schedules/schedules.${termId}.json is missing`);
      continue;
    }
    // `schedules` holds one entry per course that actually has sections; a
    // healthy term always has thousands, so a near-empty list means the scrape
    // failed rather than that the term is genuinely small.
    const count = countArray(readJson(path), "schedules");
    if (count < MIN_SCHEDULED_COURSES_PER_TERM) {
      problems.push(`schedules.${termId}.json has only ${count} scheduled courses`);
    }
  }
}

function checkOptionalAsset(dataDir: string, file: string, enabled: boolean, problems: Problem[]) {
  const path = join(dataDir, file);
  if (!enabled) return;
  if (!existsSync(path)) problems.push(`${file} is missing but the school declares that feature`);
}

const school = parseSchool(process.argv.slice(2));
const dataDir = join(repoRoot, "apps", "scraper", "data", school);
if (!existsSync(dataDir)) {
  throw new Error(`check-scraped-data: ${dataDir} does not exist.`);
}

const problems: Problem[] = [];
checkCatalogue(dataDir, problems);
checkSchedules(dataDir, checkTerms(dataDir, problems), problems);

const { features } = getSchool(school);
checkOptionalAsset(dataDir, "grades.json", features.grades, problems);
checkOptionalAsset(dataDir, "important-dates.fr.json", features.importantDatesFr, problems);

if (problems.length > 0) {
  console.error(`check-scraped-data: ${school} data looks broken:`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(`check-scraped-data: ${school} data looks healthy.`);
