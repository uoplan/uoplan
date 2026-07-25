import fs from "node:fs/promises";
import path from "node:path";
import * as cheerio from "cheerio";
import { scraperDataDir } from "../../shared/paths.ts";

const COURSES_URL = "https://calendar.carleton.ca/undergrad/courses/";

type DisciplineRow = {
  code: string;
  name: string;
  faculty?: string;
};

type FacultyRow = {
  id: string;
  name: string;
};

export type CarletonDisciplinesData = {
  sources: string[];
  count: number;
  faculties: FacultyRow[];
  disciplines: DisciplineRow[];
};

const FACULTIES: FacultyRow[] = [
  { id: "arts-social-sciences", name: "Faculty of Arts and Social Sciences" },
  { id: "engineering-and-design", name: "Faculty of Engineering and Design" },
  { id: "public-global-affairs", name: "Faculty of Public and Global Affairs" },
  { id: "science", name: "Faculty of Science" },
  { id: "sprott-school-of-business", name: "Sprott School of Business" },
];

const FACULTY_BY_CODE: Record<string, string> = {
  ACSE: "engineering-and-design",
  AERO: "engineering-and-design",
  ARCC: "engineering-and-design",
  ARCN: "engineering-and-design",
  ARCS: "engineering-and-design",
  ARCH: "engineering-and-design",
  ARCU: "engineering-and-design",
  BIT: "engineering-and-design",
  CCDP: "arts-social-sciences",
  CIVE: "engineering-and-design",
  ELEC: "engineering-and-design",
  ECOR: "engineering-and-design",
  ENVE: "engineering-and-design",
  IDES: "engineering-and-design",
  IMD: "engineering-and-design",
  IRM: "engineering-and-design",
  ITEC: "engineering-and-design",
  MAAE: "engineering-and-design",
  MECH: "engineering-and-design",
  MECT: "engineering-and-design",
  NET: "engineering-and-design",
  OSS: "engineering-and-design",
  SREE: "engineering-and-design",
  SYSC: "engineering-and-design",

  BIOC: "science",
  BIOL: "science",
  BTEC: "science",
  CHEM: "science",
  COMP: "science",
  DATA: "science",
  ERTH: "science",
  FOOD: "science",
  HLTH: "science",
  INSC: "science",
  ISCI: "science",
  ISAP: "science",
  MATH: "science",
  NEUR: "science",
  NSCI: "science",
  PHYS: "science",
  PSYC: "science",
  STAT: "science",

  BUSI: "sprott-school-of-business",

  AFRI: "arts-social-sciences",
  ALDS: "arts-social-sciences",
  ANTH: "arts-social-sciences",
  ARAB: "arts-social-sciences",
  ARCY: "arts-social-sciences",
  ARTH: "arts-social-sciences",
  ASLA: "arts-social-sciences",
  CDNS: "arts-social-sciences",
  CHIN: "arts-social-sciences",
  CLCV: "arts-social-sciences",
  COMS: "arts-social-sciences",
  CRST: "arts-social-sciences",
  DIGH: "arts-social-sciences",
  DIST: "arts-social-sciences",
  EACH: "arts-social-sciences",
  ENGL: "arts-social-sciences",
  ESLA: "arts-social-sciences",
  EURR: "arts-social-sciences",
  FILM: "arts-social-sciences",
  FINS: "arts-social-sciences",
  FREN: "arts-social-sciences",
  FYSM: "arts-social-sciences",
  GEOG: "arts-social-sciences",
  GEOM: "arts-social-sciences",
  GERM: "arts-social-sciences",
  GREK: "arts-social-sciences",
  HIST: "arts-social-sciences",
  HUMS: "arts-social-sciences",
  INDG: "arts-social-sciences",
  ITAL: "arts-social-sciences",
  JAPA: "arts-social-sciences",
  KORE: "arts-social-sciences",
  LANG: "arts-social-sciences",
  LATN: "arts-social-sciences",
  LACS: "arts-social-sciences",
  LING: "arts-social-sciences",
  MEMS: "arts-social-sciences",
  MGDS: "arts-social-sciences",
  MPAD: "arts-social-sciences",
  MUSI: "arts-social-sciences",
  PHIL: "arts-social-sciences",
  PORT: "arts-social-sciences",
  RELI: "arts-social-sciences",
  RUSS: "arts-social-sciences",
  SXST: "arts-social-sciences",
  SOCI: "arts-social-sciences",
  SPAN: "arts-social-sciences",
  TSES: "arts-social-sciences",
  WGST: "arts-social-sciences",

  CHST: "public-global-affairs",
  CIED: "public-global-affairs",
  COOP: "public-global-affairs",
  CRCJ: "public-global-affairs",
  CSEC: "public-global-affairs",
  DBST: "public-global-affairs",
  ECON: "public-global-affairs",
  ENSC: "public-global-affairs",
  ENST: "public-global-affairs",
  GINS: "public-global-affairs",
  HRSJ: "public-global-affairs",
  INAF: "public-global-affairs",
  IPAF: "public-global-affairs",
  JOUR: "public-global-affairs",
  LAWS: "public-global-affairs",
  NURS: "public-global-affairs",
  PADM: "public-global-affairs",
  PAPM: "public-global-affairs",
  POLM: "public-global-affairs",
  PSCI: "public-global-affairs",
  SOWK: "public-global-affairs",
};

function normalizeText(text: string): string {
  return text.replaceAll("\u00a0", " ").replaceAll(/\s+/g, " ").trim();
}

function parseDisciplineLine(line: string): DisciplineRow[] {
  const normalized = normalizeText(line);
  const match = normalized.match(/^(.+?)\s+\(([^)]+)\)$/);
  if (!match) return [];
  const name = normalizeText(match[1]!);
  const codes = Array.from(new Set(Array.from(match[2]!.matchAll(/[A-Z]{2,5}/g), (m) => m[0])));
  return codes.map((code) => ({
    code,
    name,
    ...(FACULTY_BY_CODE[code] ? { faculty: FACULTY_BY_CODE[code] } : {}),
  }));
}

export function parseCarletonDisciplines(html: string): CarletonDisciplinesData {
  const $ = cheerio.load(html);
  const sourceHtml = $("#textcontainer").html() ?? $.root().html() ?? "";
  const text = cheerio
    .load(`<div>${sourceHtml.replaceAll(/<br\s*\/?>/gi, "\n")}</div>`)("div")
    .text();
  const byCode = new Map<string, DisciplineRow>();
  for (const line of text.split("\n")) {
    for (const discipline of parseDisciplineLine(line)) byCode.set(discipline.code, discipline);
  }
  const disciplines = [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code, "en"));
  const usedFacultyIds = new Set(disciplines.map((d) => d.faculty).filter(Boolean));
  const faculties = FACULTIES.filter((faculty) => usedFacultyIds.has(faculty.id));
  return { sources: [COURSES_URL], count: disciplines.length, faculties, disciplines };
}

async function scrapeCarletonDisciplines(): Promise<CarletonDisciplinesData> {
  const response = await fetch(COURSES_URL, {
    headers: { "User-Agent": "uoplan-scraper/1.0 (+https://uoplan.party; Carleton CourseLeaf)" },
  });
  if (!response.ok) throw new Error(`Failed to fetch ${COURSES_URL}: HTTP ${response.status}`);
  return parseCarletonDisciplines(await response.text());
}

export async function writeCarletonDisciplines(): Promise<CarletonDisciplinesData> {
  const data = await scrapeCarletonDisciplines();
  const dataDir = scraperDataDir("carleton");
  const outPath = path.join(dataDir, "disciplines.json");
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(outPath, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
  console.log(
    `Wrote ${data.disciplines.length} disciplines and ${data.faculties.length} faculties to ${outPath}`,
  );

  const indicesPath = path.join(dataDir, "indices.json");
  let indices: Record<string, unknown> = {};
  try {
    indices = JSON.parse(await fs.readFile(indicesPath, "utf-8")) as Record<string, unknown>;
  } catch {
    // Missing indices are created here and later enriched by the catalogue scraper.
  }
  const existingCodes = Array.isArray(indices.disciplines)
    ? (indices.disciplines as string[]).filter((code): code is string => typeof code === "string")
    : [];
  const seen = new Set(existingCodes);
  let appended = 0;
  for (const discipline of data.disciplines) {
    if (seen.has(discipline.code)) continue;
    seen.add(discipline.code);
    existingCodes.push(discipline.code);
    appended += 1;
  }
  indices.disciplines = existingCodes;
  await fs.writeFile(indicesPath, `${JSON.stringify(indices, null, 2)}\n`, "utf-8");
  console.log(
    `Updated indices.json with ${existingCodes.length} discipline codes (+${appended} new)`,
  );
  return data;
}
