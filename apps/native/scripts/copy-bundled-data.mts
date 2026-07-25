import { copyFile, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const nativeRoot = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(nativeRoot, "../..");
const sourceRootDir = path.join(repoRoot, "apps/web/src/assets/data");
const schoolNamespace = "uottawa";
const sourceDir = path.join(sourceRootDir, schoolNamespace);
const builtManifestPath = path.join(repoRoot, "apps/web/dist/client/data/manifest.json");
const destinationDir = path.join(nativeRoot, "assets/data");
const generatedAssetMapPath = path.join(nativeRoot, "src/data/bundled-data-assets.ts");
const sourceManifestPath = path.join(sourceRootDir, "manifest.json");

const REQUIRED_ASSETS = [
  "terms.pb",
  "disciplines.pb",
  "indices.pb",
  "professors.pb",
  "ratemyprofessors.pb",
  "grades.pb",
  "feedback.pb",
  "catalogue.pb",
  "catalogue.union.pb",
  "catalogue.search.pb",
];

/**
 * Catalogue assets the native fallback never bundles: the per-year full
 * catalogues (`catalogue.<year>.pb`), the web-only programs-per-year helpers
 * (`catalogue.programs.<year>.pb`), and the prerequisite-history overlay
 * (`catalogue.history.pb`). Native always uses the latest prerequisites, so it
 * only needs the single union catalogue (`catalogue.union.pb`).
 */
function bareAssetId(id: string): string {
  return id.split("/").pop() ?? id;
}

function isExcludedFromBundle(id: string): boolean {
  const bareId = bareAssetId(id);
  return (
    /^catalogue\.\d{4}\.pb$/.test(bareId) ||
    /^catalogue\.programs\.\d{4}\.pb$/.test(bareId) ||
    bareId === "catalogue.history.pb"
  );
}

function bytesToMiB(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
}

function quote(value: string): string {
  return JSON.stringify(value);
}

async function readJsonIfExists(filePath: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error !== null && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function manifestForAssets(rawManifest: unknown, assetFiles: string[]): Record<string, string> {
  const manifest: Record<string, string> = {};
  if (rawManifest !== null && typeof rawManifest === "object" && !Array.isArray(rawManifest)) {
    const record = rawManifest as Record<string, unknown>;
    for (const id of assetFiles) {
      const value = record[id];
      if (typeof value === "string") manifest[id] = value;
    }
  }
  for (const id of assetFiles) {
    manifest[id] ??= `bundled://${id}`;
  }
  return manifest;
}

function generatedAssetMap(assetFiles: string[]): string {
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
  const allAssetFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".pb"))
    .map((entry) => `${schoolNamespace}/${entry.name}`)
    .sort();

  if (allAssetFiles.length === 0) {
    throw new Error(`No protobuf assets found in ${sourceDir}. Run pnpm build:data-proto first.`);
  }

  const assetFiles = allAssetFiles.filter((id) => !isExcludedFromBundle(id));

  const missingRequired = REQUIRED_ASSETS.map((id) => `${schoolNamespace}/${id}`).filter(
    (id) => !assetFiles.includes(id),
  );
  const catalogueYears = allAssetFiles
    .map((id) => /^catalogue\.(\d{4})\.pb$/.exec(bareAssetId(id))?.[1])
    .filter(Boolean)
    .map(Number);
  const scheduleFiles = assetFiles.filter((id) => /^schedules\..+\.pb$/.test(bareAssetId(id)));

  if (missingRequired.length > 0) {
    throw new Error(`Missing required bundled data assets: ${missingRequired.join(", ")}`);
  }
  if (scheduleFiles.length === 0) {
    throw new Error("Missing schedules.<termId>.pb assets for the bundled native fallback.");
  }

  await mkdir(destinationDir, { recursive: true });

  // Prune stale `.pb` files (e.g. per-year catalogues from a previous build) so
  // they don't get swept into the app binary by `assetPatternsToBeBundled`.
  const bundledSet = new Set(assetFiles);
  const existing = await readdir(destinationDir, { withFileTypes: true }).catch(() => []);
  for (const entry of existing) {
    if (entry.isFile() && entry.name.endsWith(".pb")) {
      await rm(path.join(destinationDir, entry.name));
      continue;
    }
    if (entry.isDirectory()) {
      const nested = await readdir(path.join(destinationDir, entry.name), { withFileTypes: true });
      for (const nestedEntry of nested) {
        const id = `${entry.name}/${nestedEntry.name}`;
        if (nestedEntry.isFile() && nestedEntry.name.endsWith(".pb") && !bundledSet.has(id)) {
          await rm(path.join(destinationDir, entry.name, nestedEntry.name));
        }
      }
    }
  }

  let totalBytes = 0;
  for (const id of assetFiles) {
    const bareId = bareAssetId(id);
    const source = path.join(sourceDir, bareId);
    const destination = path.join(destinationDir, id);
    await mkdir(path.dirname(destination), { recursive: true });
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

  const latestCatalogueYear = catalogueYears.length > 0 ? Math.max(...catalogueYears) : "n/a";
  console.log(
    `Copied ${assetFiles.length} bundled data assets (${bytesToMiB(totalBytes)}); latest catalogue ${latestCatalogueYear}; schedules ${scheduleFiles.length}.`,
  );
}

await main();
