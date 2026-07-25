import { createDataClient } from "@uoplan/data";
import { withAssetNamespace } from "@uoplan/data/transport";
import { SCHOOLS } from "@uoplan/domain/school";
import { dataTransport } from "./dataAssets";
import { getActiveSchool } from "./activeSchool";

/**
 * Process-wide browser data client. Owns the per-id byte memo (rejections are
 * evicted), a decoded-message memo (via `load`), and the LRU of built
 * DataCaches. A single instance is shared by the store, hooks, and the schedule
 * worker so they reuse decoded assets. Asset ids resolve to content-hashed URLs
 * through `dataTransport` (see ./dataAssets).
 *
 * Callers pass school-neutral ids (`terms.pb`); the transport is namespaced
 * once here to the page's active school, which is frozen for the document's
 * lifetime — so a single client can never mix two schools' assets.
 */
export const dataClient = createDataClient({
  transport: withAssetNamespace(dataTransport, SCHOOLS[getActiveSchool()].assetNamespace),
});
