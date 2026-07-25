import { isSchoolId } from "@uoplan/domain/school";
import type { SchoolId } from "@uoplan/domain/school";

/**
 * The `id → served URL` map for every `.pb` data asset, built from Vite's
 * `import.meta.glob`. With `query: "?url"` + `eager`, Vite emits each asset as a
 * content-hashed file under `/assets/…` (build) or serves it from source (dev)
 * and inlines the resolved URL here, so the browser never hard-codes a path.
 *
 * Assets live in per-school directories (`../assets/data/<school>/<name>.pb`),
 * and the id keeps that prefix — `withAssetNamespace` in `@uoplan/data` is what
 * turns a bare `catalogue.pb` into the active school's id.
 *
 * This module deliberately imports nothing but types and a pure predicate: it is
 * pulled in by `activeSchool`, which the data client evaluates at module scope,
 * so anything heavier here would risk an import cycle.
 */
const urlModules = import.meta.glob("../assets/data/**/*.pb", {
  query: "?url",
  import: "default",
  eager: true,
}) as Record<string, string>;

const DATA_ROOT = "../assets/data/";

export const dataAssetUrlById: Record<string, string> = {};
for (const [sourcePath, url] of Object.entries(urlModules)) {
  const index = sourcePath.indexOf(DATA_ROOT);
  if (index === -1) continue;
  dataAssetUrlById[sourcePath.slice(index + DATA_ROOT.length)] = url;
}

/**
 * Schools this bundle actually ships data for, derived from the asset ids above.
 *
 * A school is "available" iff at least one of its `.pb` assets was built, which
 * makes availability a property of the *build* rather than a flag anyone has to
 * remember to flip. `pnpm build:data-proto` skips a school whose scraped data
 * hasn't landed on the `data` branch yet, so on the first deploy after a new
 * school is added to the registry — and on any contributor's checkout who has
 * only run one school's scraper — the UI simply doesn't offer it, instead of
 * offering it and then failing to fetch a catalogue that was never published.
 */
export const AVAILABLE_SCHOOL_IDS: readonly SchoolId[] = [
  ...new Set(
    Object.keys(dataAssetUrlById)
      .map((id) => id.slice(0, id.indexOf("/")))
      .filter((segment) => isSchoolId(segment)),
  ),
];
