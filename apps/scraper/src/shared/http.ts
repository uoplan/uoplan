import fs from "fs/promises";
import path from "path";
import { getErrorMessage, NotFoundError } from "./errors.ts";

const USE_CACHE_ONLY = process.argv.includes("use-cache");
const WRITE_CACHE = process.argv.includes("write-cache");

export async function fetchHtml(url: string, retries = 3): Promise<string> {
  const cacheDir = ".cache/catalogue";
  await fs.mkdir(cacheDir, { recursive: true });

  const filename = encodeURIComponent(url.replace(/^https?:\/\//, "")) + ".html";
  const filePath = path.join(cacheDir, filename);

  if (USE_CACHE_ONLY) {
    try {
      const cached = await fs.readFile(filePath, "utf-8");
      return cached;
    } catch {
      // not cached
      throw new Error(`Cache miss for ${url} with use-cache enabled (expected ${filePath})`);
    }
  }

  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url);
      if (res.status === 404) throw new NotFoundError(url);
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const text = await res.text();
      if (WRITE_CACHE) await fs.writeFile(filePath, text, "utf-8");
      return text;
    } catch (err: unknown) {
      // Don't retry 404s
      if (err instanceof NotFoundError) throw err;
      if (i === retries - 1)
        throw new Error(`Failed to fetch ${url}: ${getErrorMessage(err)}`, { cause: err });
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw new Error(`Failed to fetch ${url}`);
}
