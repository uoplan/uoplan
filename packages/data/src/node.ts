import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { FetchBytes } from "./transport";

/**
 * Node/test transport that reads assets from a local directory. `dir` points at
 * the served data directory (e.g. `apps/web/public/data`); the leading `/data/`
 * of a public path is stripped before joining.
 */
export function createFileTransport(dir: string): FetchBytes {
  return async (path) => {
    const rel = path.startsWith("/data/") ? path.slice("/data/".length) : path.replace(/^\/+/, "");
    return new Uint8Array(await readFile(join(dir, rel)));
  };
}
