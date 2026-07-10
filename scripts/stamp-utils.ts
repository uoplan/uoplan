import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/** Files larger than this are fingerprinted by size+mtime only. */
const LARGE_FILE_BYTES = 1_000_000;

function listFiles(dir: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc;
  const st = statSync(dir);
  if (st.isFile()) {
    acc.push(dir);
    return acc;
  }
  for (const name of readdirSync(dir)) {
    if (
      name === "node_modules" ||
      name === "target" ||
      name === "dist" ||
      name === ".git" ||
      name === "pkg"
    ) {
      continue;
    }
    if (name === "raw" && dir.replaceAll("\\", "/").endsWith("apps/scraper/data")) continue;
    listFiles(join(dir, name), acc);
  }
  return acc;
}

export function hashPaths(repoRoot: string, inputPaths: readonly string[], extra?: string): string {
  const h = createHash("sha256");
  if (extra) {
    h.update(extra);
    h.update("\0");
  }
  const files: string[] = [];
  for (const p of inputPaths) {
    listFiles(join(repoRoot, p), files);
  }
  files.sort();
  for (const file of files) {
    h.update(relative(repoRoot, file));
    h.update("\0");
    try {
      const st = statSync(file);
      if (st.size >= LARGE_FILE_BYTES) {
        h.update(`large:${st.size}:${st.mtimeMs}`);
      } else {
        h.update(readFileSync(file));
      }
    } catch {
      h.update("missing");
    }
    h.update("\0");
  }
  return h.digest("hex");
}

export function allExist(repoRoot: string, markers: readonly string[]): boolean {
  return markers.every((p) => existsSync(join(repoRoot, p)));
}
