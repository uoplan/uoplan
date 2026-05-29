import { createDataClient } from "@uoplan/data";
import { createFetchTransport } from "@uoplan/data/browser";

/**
 * Process-wide browser data client. Owns the per-path byte memo (rejections are
 * evicted) and the LRU of built DataCaches. A single instance is shared by the
 * store, hooks, and the schedule worker so they reuse decoded assets.
 */
export const dataClient = createDataClient({ transport: createFetchTransport() });
