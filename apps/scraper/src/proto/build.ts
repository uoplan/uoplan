import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { SchoolId } from "@uoplan/domain/school";
import { DEFAULT_SCHOOL_ID, SCHOOLS } from "@uoplan/domain/school";
import * as DataProto from "@uoplan/proto/data";
import * as FeedbackProto from "@uoplan/proto/feedback";
import { toProtoIndices } from "@uoplan/core/dataTypes/indices";
import { toProtoImportantDatesData } from "../../../../packages/domain/src/dataTypes/importantDates.ts";
import type {
  ImportantDatesData,
  ImportantDatesLocale,
} from "../../../../packages/domain/src/dataTypes/importantDates.ts";
import { parseSchoolArg } from "../shared/cliSchool.ts";
import {
  catalogueDataDir,
  DATA_MANIFEST_FILE,
  schedulesDataDir,
  scraperDataDir,
  WEB_ASSETS_DATA_ROOT,
  webAssetsDataDir,
} from "../shared/paths.ts";
import { readJson } from "../shared/json.ts";
import { buildFeedbackData } from "./feedback.ts";
import { mapCatalogue } from "./catalogue.ts";
import type { CatalogueJsonInput } from "./catalogue.ts";
import {
  buildPrereqHistory,
  buildProgramHistory,
  buildUnionCatalogueInput,
} from "./catalogue-merged.ts";
import type { YearCatalogue } from "./catalogue-merged.ts";
import { mapDisciplinesJson, mapGradesJson } from "./grades.ts";
import {
  buildCourseDescriptionShards,
  buildShardIdsFromDisciplines,
  collectLatestCourseDescriptions,
  COURSE_DESCRIPTION_SHARD_IDS,
} from "./description-shards.ts";
import { buildCourseSearchIndex } from "./search-index.ts";
import type { CourseDescriptionInput } from "./search-index.ts";
import { mapSchedules } from "./schedules.ts";
import type { SchedulesJsonInput } from "./schedules.ts";
import { createResolverFromRegistry } from "../professors/buildRegistry.ts";
import type { ProfessorRegistryEntry } from "../professors/buildRegistry.ts";
import { professorsFile } from "../professors/build.ts";
import {
  buildPredictionContext,
  predictInstructorsForTerm,
} from "../schedules/predictInstructors.ts";
import type { GradesCourseInput, ScheduleFileInput } from "../schedules/predictInstructors.ts";
import { parseTermIdToNumber } from "./shared.ts";
import { normalizeTermName } from "../terms/normalize.ts";

interface RateMyProfessorInput {
  id?: string;
  legacyId?: number;
  name?: string;
  rating?: number | null;
  numRatings?: number;
}

interface BuildContext {
  school: SchoolId;
  assetNamespace: string;
  dataDir: string;
  catalogueDir: string;
  scheduleDir: string;
  assetsDir: string;
}

function createBuildContext(school: SchoolId): BuildContext {
  return {
    school,
    assetNamespace: SCHOOLS[school].assetNamespace,
    dataDir: scraperDataDir(school),
    catalogueDir: catalogueDataDir(school),
    scheduleDir: schedulesDataDir(school),
    assetsDir: webAssetsDataDir(school),
  };
}

async function readJsonOptional<T>(file: string): Promise<T | null> {
  try {
    return await readJson<T>(file);
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === "ENOENT") return null;
    throw err;
  }
}

function logMissingSource(assetFile: string, sourceFile: string): void {
  console.log(`Skipping ${assetFile}: missing ${sourceFile}`);
}

async function writePb(filePath: string, bytes: Uint8Array): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, bytes);
}

async function writeAsset(ctx: BuildContext, assetFile: string, bytes: Uint8Array): Promise<void> {
  await writePb(path.join(ctx.assetsDir, assetFile), bytes);
}

function importantDatesBuildTargets(ctx: BuildContext): ReadonlyArray<{
  locale: ImportantDatesLocale;
  sourceFile: string;
  assetFile: string;
}> {
  return [
    {
      locale: "en",
      sourceFile: path.join(ctx.dataDir, "important-dates.en.json"),
      assetFile: "important-dates.en.pb",
    },
    {
      locale: "fr-CA",
      sourceFile: path.join(ctx.dataDir, "important-dates.fr.json"),
      assetFile: "important-dates.fr.pb",
    },
  ];
}

async function writeImportantDatesAssets(ctx: BuildContext): Promise<readonly string[]> {
  const written: string[] = [];
  for (const { locale, sourceFile, assetFile } of importantDatesBuildTargets(ctx)) {
    const data = await readJsonOptional<ImportantDatesData>(sourceFile);
    if (!data) {
      logMissingSource(assetFile, sourceFile);
      continue;
    }
    if (data.locale !== locale) {
      throw new Error(
        `Important dates locale mismatch in ${path.basename(sourceFile)}: expected ${locale}, received ${data.locale}`,
      );
    }
    await writeAsset(
      ctx,
      assetFile,
      DataProto.ImportantDatesData.encode(toProtoImportantDatesData(data)).finish(),
    );
    written.push(assetFile);
  }
  return written;
}

async function collectPbAssetManifest(): Promise<Record<string, string>> {
  const manifest: Record<string, string> = {};
  const schoolDirs = (
    await fs.readdir(WEB_ASSETS_DATA_ROOT, { withFileTypes: true }).catch(() => [])
  )
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  for (const schoolDir of schoolDirs) {
    const dir = path.join(WEB_ASSETS_DATA_ROOT, schoolDir);
    const files = (await fs.readdir(dir).catch(() => [] as string[]))
      .filter((file) => file.endsWith(".pb"))
      .sort();
    for (const file of files) {
      const id = `${schoolDir}/${file}`;
      manifest[id] = `/data/${id}`;
    }
  }
  return manifest;
}

/**
 * Ensure build:data-proto leaves behind a generated data-manifest module when no
 * Vite build has created one yet. If an older flat placeholder is present, replace
 * it with the school-namespaced placeholder expected by the runtime data layer.
 */
async function scaffoldDataManifest(): Promise<void> {
  const existing = await fs.readFile(DATA_MANIFEST_FILE, "utf-8").catch(() => "");
  if (existing && !/"[^"/]+\.pb"/.test(existing)) return;

  const manifest = await collectPbAssetManifest();
  const body = Object.keys(manifest)
    .sort()
    .map((id) => `  ${JSON.stringify(id)}: ${JSON.stringify(manifest[id])},`)
    .join("\n");
  const source = `// AUTO-GENERATED by the data-manifest build. Do not edit.
// Maps each \`.pb\` asset id (its path under \`assets/data\`, i.e. \`<school>/<name>.pb\`)
// to the URL it is served from. A placeholder is scaffolded by \`pnpm build:data-proto\`;
// the real, content-hashed URLs are written by the web Vite build
// (see apps/web/vite/data-manifest-plugin.ts).

export const dataManifest: Record<string, string> = {
${body}
};
`;
  await fs.mkdir(path.dirname(DATA_MANIFEST_FILE), { recursive: true });
  await fs.writeFile(DATA_MANIFEST_FILE, source);
}

function isCatalogueYearJson(name: string): boolean {
  return /^catalogue\.\d{4}\.json$/.test(name);
}

function isScheduleJson(name: string): boolean {
  return /^schedules\.\d+\.json$/.test(name);
}

async function removeStaleFullCatalogues(ctx: BuildContext): Promise<void> {
  const staleFullCatalogues = (await fs.readdir(ctx.assetsDir).catch(() => [] as string[])).filter(
    (name) => /^catalogue\.\d{4}\.pb$/.test(name),
  );
  await Promise.all(
    staleFullCatalogues.map((name) => fs.rm(path.join(ctx.assetsDir, name), { force: true })),
  );
}

/**
 * Remove any `catalogue.descriptions.*.pb` files from the assets directory
 * that are NOT in the current `shardIds` set. This prevents stale shard files
 * from accumulating when the school's faculty structure changes.
 */
async function removeStaleDescriptionShards(
  ctx: BuildContext,
  shardIds: readonly string[],
): Promise<void> {
  const idSet = new Set(shardIds.map((id) => `catalogue.descriptions.${id}.pb`));
  const stale = (await fs.readdir(ctx.assetsDir).catch(() => [] as string[])).filter(
    (name) => /^catalogue\.descriptions\..+\.pb$/.test(name) && !idSet.has(name),
  );
  await Promise.all(stale.map((name) => fs.rm(path.join(ctx.assetsDir, name), { force: true })));
}

export async function main(school: SchoolId = DEFAULT_SCHOOL_ID): Promise<void> {
  const ctx = createBuildContext(school);
  await fs.mkdir(ctx.assetsDir, { recursive: true });
  await removeStaleFullCatalogues(ctx);

  const catalogueEntries = await fs.readdir(ctx.catalogueDir).catch(() => [] as string[]);
  const scheduleEntries = await fs.readdir(ctx.scheduleDir).catch(() => [] as string[]);
  const yearCatalogues = catalogueEntries.filter(isCatalogueYearJson).sort();
  const scheduleFiles = scheduleEntries.filter(isScheduleJson).sort();

  const manifestPath = path.join(ctx.catalogueDir, "catalogue.json");
  const manifest = await readJsonOptional<{ years: number[] }>(manifestPath);
  if (manifest) {
    await writeAsset(
      ctx,
      "catalogue.pb",
      DataProto.CatalogueManifest.encode({
        years: manifest.years ?? [],
      }).finish(),
    );
  } else {
    logMissingSource("catalogue.pb", manifestPath);
  }

  const termsPath = path.join(ctx.dataDir, "terms.json");
  const terms = await readJsonOptional<{
    terms: Array<{ termId: string; name: string }>;
  }>(termsPath);
  if (terms) {
    await writeAsset(
      ctx,
      "terms.pb",
      DataProto.TermsData.encode({
        terms: (terms.terms ?? []).map((t) => ({
          termId: parseTermIdToNumber(String(t.termId ?? "")),
          name: normalizeTermName(t.name),
        })),
      }).finish(),
    );
  } else {
    logMissingSource("terms.pb", termsPath);
  }

  const importantDatesAssets = await writeImportantDatesAssets(ctx);

  const indicesPath = path.join(ctx.dataDir, "indices.json");
  const indices = await readJsonOptional<{
    courses: string[];
    programs: string[];
    disciplines?: string[];
  }>(indicesPath);
  if (indices) {
    await writeAsset(
      ctx,
      "indices.pb",
      DataProto.Indices.encode(
        toProtoIndices({
          courses: indices.courses ?? [],
          programs: indices.programs ?? [],
          disciplines: indices.disciplines ?? [],
        }),
      ).finish(),
    );
  } else {
    logMissingSource("indices.pb", indicesPath);
  }

  const rmpPath = path.join(ctx.dataDir, "ratemyprofessors.json");
  const rmp = await readJsonOptional<{ resultCount?: number; professors?: RateMyProfessorInput[] }>(
    rmpPath,
  );
  if (rmp) {
    await writeAsset(
      ctx,
      "ratemyprofessors.pb",
      DataProto.RateMyProfessorsData.encode({
        resultCount: rmp.resultCount ?? 0,
        professors: (rmp.professors ?? []).map((p) => ({
          legacyId: p.legacyId,
          name: p.name ?? "",
          rating: p.rating ?? undefined,
          numRatings: p.numRatings,
        })),
      }).finish(),
    );
  } else {
    logMissingSource("ratemyprofessors.pb", rmpPath);
  }

  const disciplinesPath = path.join(ctx.dataDir, "disciplines.json");
  const disciplinesJson = await readJsonOptional<unknown>(disciplinesPath);
  const disciplinesProto = disciplinesJson ? mapDisciplinesJson(disciplinesJson) : null;
  if (disciplinesProto) {
    await writeAsset(
      ctx,
      "disciplines.pb",
      DataProto.DisciplinesData.encode(disciplinesProto).finish(),
    );
  } else {
    logMissingSource("disciplines.pb", disciplinesPath);
  }

  const registryPath = professorsFile(ctx.school);
  const registry =
    (await readJsonOptional<{ professors?: ProfessorRegistryEntry[] }>(registryPath))?.professors ??
    [];
  const professorResolver = createResolverFromRegistry(registry);
  if (registry.length > 0) {
    await writeAsset(
      ctx,
      "professors.pb",
      DataProto.ProfessorsData.encode({
        professors: registry.map((p) => ({
          name: p.name,
          legacyIds: p.legacyIds,
          rating: p.rating,
          numRatings: p.numRatings,
          aliases: p.aliases,
        })),
      }).finish(),
    );
  } else {
    logMissingSource("professors.pb", registryPath);
  }

  const yearInputs: YearCatalogue[] = [];
  for (const fileName of yearCatalogues) {
    const match = /catalogue\.(\d{4})\.json$/.exec(fileName);
    if (!match) continue;
    yearInputs.push({
      year: Number(match[1]),
      data: await readJson<CatalogueJsonInput>(path.join(ctx.catalogueDir, fileName)),
    });
  }
  yearInputs.sort((a, b) => a.year - b.year);
  if (yearInputs.length > 0) {
    const unionInput = buildUnionCatalogueInput(yearInputs);
    const unionProto = mapCatalogue(unionInput);
    await writeAsset(ctx, "catalogue.union.pb", DataProto.Catalogue.encode(unionProto).finish());
    await writeAsset(
      ctx,
      "catalogue.history.pb",
      DataProto.CataloguePrereqHistory.encode(
        buildPrereqHistory(yearInputs, unionInput, unionProto.courseCodes),
      ).finish(),
    );
    await writeAsset(
      ctx,
      "catalogue.programs.history.pb",
      DataProto.CatalogueProgramHistory.encode(
        buildProgramHistory(yearInputs, unionInput, unionProto.courseCodes),
      ).finish(),
    );

    const latestDescriptions = new Map<string, CourseDescriptionInput>();
    for (const { data } of yearInputs) {
      for (const course of data.courses ?? []) {
        if (!course.code) continue;
        latestDescriptions.set(course.code, {
          code: course.code,
          title: course.title ?? "",
          description: course.description ?? "",
        });
      }
    }
    await writeAsset(
      ctx,
      "catalogue.search.pb",
      DataProto.CourseSearchIndex.encode(
        buildCourseSearchIndex([...latestDescriptions.values()], { minDf: 2, maxDf: 200 }),
      ).finish(),
    );

    if (disciplinesProto) {
      const courseDescriptions = collectLatestCourseDescriptions(
        yearInputs.map(({ data }) => data),
      );
      const shardIds =
        ctx.school === "uottawa"
          ? COURSE_DESCRIPTION_SHARD_IDS
          : buildShardIdsFromDisciplines(disciplinesProto);
      await removeStaleDescriptionShards(ctx, shardIds);
      const descriptionShards = buildCourseDescriptionShards(
        courseDescriptions,
        disciplinesProto,
        shardIds,
      );
      await Promise.all(
        shardIds.map((shardId) =>
          writeAsset(
            ctx,
            `catalogue.descriptions.${shardId}.pb`,
            DataProto.CourseDescriptionShard.encode(descriptionShards.get(shardId)!).finish(),
          ),
        ),
      );
    }
  } else {
    console.log(
      `Skipping catalogue union assets: no catalogue.<year>.json files in ${ctx.catalogueDir}`,
    );
  }

  const gradesPath = path.join(ctx.dataDir, "grades.json");
  const gradesJson = (await readJsonOptional<unknown[]>(gradesPath)) ?? [];
  if (gradesJson.length === 0) logMissingSource("grades.pb", gradesPath);

  const scheduleJsonByFile = new Map<string, SchedulesJsonInput>();
  for (const fileName of scheduleFiles) {
    scheduleJsonByFile.set(
      fileName,
      await readJson<SchedulesJsonInput>(path.join(ctx.scheduleDir, fileName)),
    );
  }
  const predictionContext = buildPredictionContext({
    grades: gradesJson as GradesCourseInput[],
    scheduleFiles: [...scheduleJsonByFile.values()] as ScheduleFileInput[],
    rmp: rmp?.professors ?? [],
  });

  for (const fileName of scheduleFiles) {
    const data = scheduleJsonByFile.get(fileName)!;
    const predictions = predictInstructorsForTerm(data as ScheduleFileInput, predictionContext);
    const encoded = DataProto.SchedulesData.encode(
      mapSchedules(data, predictions, professorResolver),
    ).finish();
    await writeAsset(ctx, fileName.replace(/\.json$/, ".pb"), encoded);
  }

  if (gradesJson.length > 0) {
    await writeAsset(
      ctx,
      "grades.pb",
      DataProto.GradesData.encode(mapGradesJson(gradesJson, professorResolver)).finish(),
    );
  }

  const feedback = await buildFeedbackData(ctx.school, professorResolver);
  if (feedback) {
    await writeAsset(ctx, "feedback.pb", FeedbackProto.FeedbackData.encode(feedback).finish());
  }

  await scaffoldDataManifest();

  const shardCount =
    disciplinesProto && yearInputs.length > 0
      ? ctx.school === "uottawa"
        ? COURSE_DESCRIPTION_SHARD_IDS.length
        : buildShardIdsFromDisciplines(disciplinesProto).length
      : 0;
  console.log(
    `Generated ${ctx.assetNamespace} protobuf data: catalogue.union.pb + catalogue.search.pb + catalogue.history.pb + catalogue.programs.history.pb, ${importantDatesAssets.join(" + ") || "no important dates"}, ${shardCount} description shards, ${scheduleFiles.length} schedule files${gradesJson.length > 0 ? ", grades.pb" : ""}, ${disciplinesProto ? "disciplines.pb" : "no disciplines.pb"}${feedback ? ", feedback.pb" : ""}`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void (async () => {
    try {
      await main(parseSchoolArg(process.argv));
    } catch (err) {
      console.error("Failed to build protobuf data artifacts.");
      console.error(err);
      process.exit(1);
    }
  })();
}
