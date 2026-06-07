import { createDataClient } from "@uoplan/data";
import { dataTransport } from "./dataAssets";

/**
 * Process-wide browser data client. Owns the per-id byte memo (rejections are
 * evicted), a decoded-message memo (via `load`), and the LRU of built
 * DataCaches. A single instance is shared by the store, hooks, and the schedule
 * worker so they reuse decoded assets. Asset ids resolve to content-hashed URLs
 * through `dataTransport` (see ./dataAssets).
 */
export const dataClient = createDataClient({ transport: dataTransport });
