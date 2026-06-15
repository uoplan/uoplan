/**
 * File-IO orchestration for the canonical professor registry: reads every
 * professor-name source (RateMyProfessors, grades, schedules, feedback) plus the
 * optional committed overrides, builds the registry, and writes the committed
 * `data/professors.json`. The proto build later reads that file and derives a
 * resolver (see `createResolverFromRegistry`) to map each dataset's professor
 * references to registry indices.
 */

import { promises as fs } from "node:fs";
import path from "node:path";

import { readJson } from "../shared/json.ts";
import {
  FEEDBACK_DATA_DIR,
  GRADES_FILE,
  RATEMYPROFESSORS_FILE,
  SCHEDULES_DATA_DIR,
  SCRAPER_DATA_DIR,
} from "../shared/paths.ts";
import { buildProfessorRegistry } from "./buildRegistry.ts";
import type {
  NamedInput,
  ProfessorRegistryEntry,
  RegistryInputs,
  RegistryOverrides,
  RmpInput,
} from "./buildRegistry.ts";

export const PROFESSORS_FILE = path.join(SCRAPER_DATA_DIR, "professors.json");
const PROFESSORS_OVERRIDES_FILE = path.join(SCRAPER_DATA_DIR, "professors.overrides.json");

interface RmpFile {
  professors?: RmpInput[];
}

interface GradesCourse {
  sections?: Array<{ name?: string; legacyId?: number }>;
  /** Backward-compatible reader for committed legacy grades.json until regenerated. */
  professors?: Array<{ name?: string; legacyId?: number }>;
}

interface ScheduleFile {
  schedules?: Array<{
    components?: Record<string, Array<{ times?: Array<{ instructor?: string | null }> }>>;
  }>;
}

interface FeedbackCourse {
  sections?: Array<{ professor?: string }>;
}

async function readJsonOptional<T>(file: string): Promise<T | null> {
  try {
    return await readJson<T>(file);
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === "ENOENT") return null;
    throw err;
  }
}

async function listJsonFiles(dir: string, prefix: RegExp): Promise<string[]> {
  const entries = await fs.readdir(dir).catch(() => [] as string[]);
  return entries.filter((name) => prefix.test(name)).sort();
}

/** Gather every professor-name source into the registry-builder input shape. */
async function collectRegistryInputs(): Promise<RegistryInputs> {
  const rmp = (await readJsonOptional<RmpFile>(RATEMYPROFESSORS_FILE))?.professors ?? [];

  const gradesJson = (await readJsonOptional<GradesCourse[]>(GRADES_FILE)) ?? [];
  const grades: NamedInput[] = [];
  for (const course of gradesJson) {
    for (const prof of course.sections ?? course.professors ?? []) {
      if (prof?.name) grades.push({ name: prof.name, legacyId: prof.legacyId });
    }
  }

  const schedules: string[] = [];
  for (const fileName of await listJsonFiles(SCHEDULES_DATA_DIR, /^schedules\.\d+\.json$/)) {
    const data = await readJson<ScheduleFile>(path.join(SCHEDULES_DATA_DIR, fileName));
    for (const course of data.schedules ?? []) {
      for (const sections of Object.values(course.components ?? {})) {
        for (const section of sections) {
          for (const time of section.times ?? []) {
            if (time.instructor) schedules.push(time.instructor);
          }
        }
      }
    }
  }

  const feedback: string[] = [];
  for (const fileName of await listJsonFiles(FEEDBACK_DATA_DIR, /^feedback\.\d+\.json$/)) {
    const data = await readJson<FeedbackCourse[]>(path.join(FEEDBACK_DATA_DIR, fileName));
    for (const course of data) {
      for (const section of course.sections ?? []) {
        if (section.professor) feedback.push(section.professor);
      }
    }
  }

  const overrides = (await readJsonOptional<RegistryOverrides>(PROFESSORS_OVERRIDES_FILE)) ?? {};

  return { rmp, grades, schedules, feedback, overrides };
}

/** Build the registry from all committed sources and write data/professors.json. */
export async function buildAndWriteProfessors(): Promise<ProfessorRegistryEntry[]> {
  const inputs = await collectRegistryInputs();
  const professors = buildProfessorRegistry(inputs);
  await fs.writeFile(PROFESSORS_FILE, `${JSON.stringify({ professors }, null, 2)}\n`, "utf-8");
  return professors;
}
