import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Orchestrates the runtime-coverage report for `apps/web`:
 *   1. `--clean` wipes the raw snapshots + generated report.
 *   2. Otherwise: render an HTML + text-summary report from `.nyc_output/`
 *      (via nyc) and the ranked dead-code candidate list (dead-candidates.ts).
 *
 * Usage: `pnpm --filter web coverage:report` (add `--clean` to reset).
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "..", ".."); // apps/web/scripts/runtime-coverage -> apps/web
const nycDir = path.join(webRoot, ".nyc_output");
const reportDir = path.join(webRoot, "coverage-runtime");

function clean(): void {
  for (const dir of [nycDir, reportDir]) {
    fs.rmSync(dir, { recursive: true, force: true });
    console.info(`[coverage] removed ${path.relative(webRoot, dir) || dir}`);
  }
}

function run(cmd: string, args: string[]): void {
  const res = spawnSync(cmd, args, { cwd: webRoot, stdio: "inherit" });
  if (res.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} exited with ${res.status ?? res.signal}`);
  }
}

function main(): void {
  if (process.argv.includes("--clean")) {
    clean();
    return;
  }

  if (
    !fs.existsSync(nycDir) ||
    fs.readdirSync(nycDir).filter((f) => f.endsWith(".json")).length === 0
  ) {
    console.warn(
      "[coverage] No snapshots in apps/web/.nyc_output. Run `pnpm --filter web coverage:dev`, walk the app (auto-flushes + Alt+Shift+C), then re-run.",
    );
    return;
  }

  fs.mkdirSync(reportDir, { recursive: true });

  // Browsable HTML + a quick text summary, into coverage-runtime/ (keeps the
  // existing Vitest `coverage/` dir untouched).
  run("pnpm", [
    "exec",
    "nyc",
    "report",
    "--temp-dir",
    ".nyc_output",
    "--report-dir",
    "coverage-runtime",
    "--reporter",
    "html",
    "--reporter",
    "text-summary",
  ]);

  // Ranked never-executed files/functions.
  run("node", ["scripts/runtime-coverage/dead-candidates.ts"]);

  console.info(`[coverage] HTML report: ${path.join("coverage-runtime", "index.html")}`);
}

main();
