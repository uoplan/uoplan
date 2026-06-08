import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createFetchBytesTransport, type FetchBytes } from "./transport";

/**
 * Node/test transport that reads assets straight off disk by id. `dir` points at
 * the data directory holding the `.pb` files (e.g. `apps/web/src/assets/data`);
 * the asset id is the bare filename, so it is simply joined onto `dir`.
 */
export function createFileTransport(dir: string): FetchBytes {
  return createFetchBytesTransport({
    resolve: (id) => join(dir, id),
    fetch: async (path) => {
      const bytes = await readFile(path);
      const arrayBuffer = bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      ) as ArrayBuffer;
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => arrayBuffer,
      };
    },
  });
}
