import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { FetchBytes } from "./transport";

/**
 * Node/test transport that reads assets straight off disk by id. `dir` points at
 * the data directory holding the `.pb` files (e.g. `apps/web/src/assets/data`);
 * the asset id is the bare filename, so it is simply joined onto `dir`.
 */
export function createFileTransport(dir: string): FetchBytes {
  return async (id) => new Uint8Array(await readFile(join(dir, id)));
}
