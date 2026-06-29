// Small shared helpers for the capture harness: resolve Playwright out of
// apps/web (so the marketing project stays dependency-isolated), run shell
// commands, and ensure output directories exist.

import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { REPO_ROOT } from "../config.mjs";

/**
 * Resolve `playwright` from apps/web's node_modules. The marketing project
 * intentionally has no Playwright dependency (it must stay isolated from the
 * 1-week release-age workspace gate), so we borrow the one apps/web already
 * installs for its e2e suite.
 */
export function loadPlaywright() {
  const requireFromWeb = createRequire(path.join(REPO_ROOT, "apps", "web", "package.json"));
  return requireFromWeb("playwright");
}

/** Promise wrapper around spawn that streams stdio and rejects on non-zero exit. */
export function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit", ...opts });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(" ")} exited ${code}`));
    });
  });
}

/** Like run() but captures stdout and returns it (trimmed). */
export function capture(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "inherit"], ...opts });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(out.trim());
      else reject(new Error(`${cmd} ${args.join(" ")} exited ${code}`));
    });
  });
}

/** Resolve the ffmpeg binary Playwright bundles (avoids a system dependency). */
export function ffmpegPath() {
  const requireFromWeb = createRequire(path.join(REPO_ROOT, "apps", "web", "package.json"));
  try {
    return requireFromWeb("@ffmpeg-installer/ffmpeg").path;
  } catch {
    return process.env.FFMPEG_PATH ?? "ffmpeg";
  }
}

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
