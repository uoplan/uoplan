#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

if (process.env.EAS_BUILD !== "true") {
  process.exit(0);
}

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const nativeDir = resolve(scriptsDir, "..");
const repoRoot = resolve(nativeDir, "../..");

function commandExists(command) {
  return spawnSync(command, ["--version"], { stdio: "ignore" }).status === 0;
}

function run(command, args, cwd = repoRoot, extraEnv = {}) {
  const result = spawnSync(command, args, {
    cwd,
    env: { ...process.env, ...extraEnv },
    stdio: "inherit",
    shell: false,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
  }
}

function ensureRustup() {
  if (commandExists("rustup")) return {};

  const cargoHome = resolve(process.env.HOME ?? repoRoot, ".cargo");
  const rustupInstaller = resolve(nativeDir, ".eas-rustup-init.sh");
  run("curl", [
    "--proto",
    "=https",
    "--tlsv1.2",
    "-sSf",
    "https://sh.rustup.rs",
    "-o",
    rustupInstaller,
  ]);
  try {
    run("sh", [rustupInstaller, "-y", "--profile", "minimal", "--default-toolchain", "stable"]);
  } finally {
    if (existsSync(rustupInstaller)) {
      rmSync(rustupInstaller, { force: true });
    }
  }

  return { PATH: `${resolve(cargoHome, "bin")}:${process.env.PATH ?? ""}` };
}

run("pnpm", ["generate"]);

if (process.env.EAS_BUILD_PLATFORM === "ios") {
  const rustEnv = ensureRustup();
  run("rustup", ["target", "add", "aarch64-apple-ios", "aarch64-apple-ios-sim"], repoRoot, rustEnv);
  run("pnpm", ["build:engine-native-ffi"], repoRoot, rustEnv);
}
