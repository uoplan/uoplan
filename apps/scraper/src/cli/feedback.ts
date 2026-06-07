/**
 * Course-feedback (S-Reports) scraper CLI.
 *
 * Auth:
 *   login    Open native Chrome, log in to uoZone, store the session in the Keychain.
 *   whoami   Check whether a stored session exists and is still valid.
 *   logout   Delete the stored session from the Keychain.
 *
 * Two-stage pipeline (raw cache -> committed dataset):
 *   fetch    Stage 1: download raw list pages (+ reports/charts with --stats) into
 *            the gitignored cache, skipping anything already saved.
 *   parse    Stage 2: parse the cache into data/feedback.<termId>.json.
 *   scrape   fetch then parse (default).
 *
 * Flags: --term <id> | --terms <a,b,c> (default: all), --force, --stats,
 *        --max-reports <n>.
 */

import { loginInteractive, sessionIsValid } from "../feedback/auth.ts";
import { runFetch } from "../feedback/fetch.ts";
import { deleteSession, loadSession } from "../feedback/keychain.ts";
import { runParse } from "../feedback/parse.ts";

interface CliArgs {
  terms?: string[];
  force: boolean;
  stats: boolean;
  maxReports?: number;
  concurrency?: number;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { force: false, stats: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "--force":
        args.force = true;
        break;
      case "--stats":
        args.stats = true;
        break;
      case "--term":
      case "--terms":
        args.terms = (argv[++i] ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        break;
      case "--max-reports":
        args.maxReports = Number(argv[++i]);
        break;
      case "--concurrency":
        args.concurrency = Number(argv[++i]);
        break;
      default:
        console.warn(`Ignoring unknown argument: ${a}`);
    }
  }
  return args;
}

async function cmdLogin(): Promise<void> {
  await loginInteractive();
  const stored = await loadSession();
  if (stored && (await sessionIsValid(stored))) {
    console.log("Login OK — session stored and verified.");
  } else {
    console.warn("Login captured but session does not look authenticated.");
    process.exitCode = 1;
  }
}

async function cmdWhoami(): Promise<void> {
  const stored = await loadSession();
  if (!stored) {
    console.log("No stored session. Run: pnpm --filter scraper scrape:feedback login");
    process.exitCode = 1;
    return;
  }
  const valid = await sessionIsValid(stored);
  const age = Math.round((Date.now() - stored.savedAt) / 60000);
  console.log(
    `Stored session: ${stored.cookies.length} cookies, saved ${age} min ago, ` +
      `valid: ${valid ? "yes" : "no (re-login needed)"}`,
  );
  if (!valid) process.exitCode = 1;
}

async function cmdLogout(): Promise<void> {
  await deleteSession();
  console.log("Stored session deleted.");
}

async function main(): Promise<void> {
  const cmd = process.argv[2];
  const args = parseArgs(process.argv.slice(3));

  switch (cmd) {
    case "login":
      await cmdLogin();
      break;
    case "whoami":
      await cmdWhoami();
      break;
    case "logout":
      await cmdLogout();
      break;
    case "fetch":
      await runFetch(args);
      break;
    case "parse":
      await runParse(args);
      break;
    case undefined:
    case "scrape":
      await runFetch(args);
      await runParse(args);
      break;
    default:
      console.error(`Unknown command: ${cmd}`);
      console.error(
        "Usage: scrape:feedback <login|whoami|logout|fetch|parse|scrape> " +
          "[--term <id> | --terms <a,b>] [--force] [--stats] [--max-reports <n>]",
      );
      process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("feedback CLI failed:");
  console.error(err);
  process.exit(1);
});
