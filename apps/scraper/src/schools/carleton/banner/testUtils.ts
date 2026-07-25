import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const fixtureDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "__fixtures__");

export function readFixture(name: string): string {
  return readFileSync(path.join(fixtureDir, name), "utf-8");
}
