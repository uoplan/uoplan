import { copyFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const nativeRoot = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(nativeRoot, "../..");
const sourceDir = path.join(repoRoot, "apps/web/src/assets/data");
const builtManifestPath = path.join(repoRoot, "apps/web/dist/client/data/manifest.json");
const destinationDir = path.join(nativeRoot, "assets/data");
const generatedAssetMapPath = path.join(nativeRoot, "src/data/bundled-data-assets.ts");
const sourceManifestPath = path.join(sourceDir, "manifest.json");

const REQUIRED_ASSETS = [
  "terms.pb",
  "disciplines.pb",
  "indices.pb",
  "professors.pb",
  "ratemyprofessors.pb",
  "grades.pb",
  "feedback.pb",
  "catalogue.pb",
];

function bytesToMiB(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
}

function quote(value) {
  return JSON.stringify(value);
}

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function manifestForAssets(rawManifest, assetFiles) {
  const manifest = {};
  if (rawManifest !== null && typeof rawManifest === "object" && !Array.isArray(rawManifest)) {
    for (const id of assetFiles) {
      const value = rawManifest[id];
      if (typeof value === "string") manifest[id] = value;
    }
  }
  for (const id of assetFiles) {
    manifest[id] ??= `bundled://${id}`;
  }
  return manifest;
}

function generatedAssetMap(assetFiles) {
  const entries = assetFiles.map(
    (id) => `  ${quote(id)}: require(${quote(`../../assets/data/${id}`)}),`,
  );
  return `${[
    "export type BundledDataAssetModule =",
    "  | number",
    "  | string",
    "  | { height?: number; uri: string; width?: number };",
    "",
    "declare const require: (id: string) => BundledDataAssetModule;",
    "",
    "export const BUNDLED_DATA_MODULES = {",
    ...entries,
    "} as const satisfies Record<string, BundledDataAssetModule>;",
    "",
  ].join("\n")}`;
}

async function main() {
  const entries = await readdir(sourceDir, { withFileTypes: true });
  const assetFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".pb"))
    .map((entry) => entry.name)
    .sort();

  if (assetFiles.length === 0) {
    throw new Error(`No protobuf assets found in ${sourceDir}. Run pnpm build:data-proto first.`);
  }

  const missingRequired = REQUIRED_ASSETS.filter((id) => !assetFiles.includes(id));
  const catalogueYears = assetFiles
    .map((id) => /^catalogue\.(\d{4})\.pb$/.exec(id)?.[1])
    .filter(Boolean)
    .map(Number);
  const scheduleFiles = assetFiles.filter((id) => /^schedules\..+\.pb$/.test(id));

  if (missingRequired.length > 0) {
    throw new Error(`Missing required bundled data assets: ${missingRequired.join(", ")}`);
  }
  if (catalogueYears.length === 0) {
    throw new Error("Missing catalogue.<year>.pb assets for the bundled native fallback.");
  }
  if (scheduleFiles.length === 0) {
    throw new Error("Missing schedules.<termId>.pb assets for the bundled native fallback.");
  }

  await mkdir(destinationDir, { recursive: true });

  let totalBytes = 0;
  for (const id of assetFiles) {
    const source = path.join(sourceDir, id);
    const destination = path.join(destinationDir, id);
    await copyFile(source, destination);
    totalBytes += (await readFile(source)).byteLength;
  }

  const rawManifest =
    (await readJsonIfExists(sourceManifestPath)) ?? (await readJsonIfExists(builtManifestPath));
  const manifest = manifestForAssets(rawManifest, assetFiles);
  await writeFile(
    path.join(destinationDir, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  await writeFile(generatedAssetMapPath, generatedAssetMap(assetFiles));

  const latestCatalogueYear = Math.max(...catalogueYears);
  console.log(
    `Copied ${assetFiles.length} bundled data assets (${bytesToMiB(totalBytes)}); latest catalogue ${latestCatalogueYear}; schedules ${scheduleFiles.length}.`,
  );
}

await main();
