#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// EAS Build workers set EAS_BUILD="true"; the local-build plugin
// (`eas build --local`) sets EAS_BUILD="1". Accept both so generated artifacts
// (i18n catalogs, proto, bundled data, the engine .so) are produced either way.
if (process.env.EAS_BUILD !== "true" && process.env.EAS_BUILD !== "1") {
  process.exit(0);
}

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const nativeDir = resolve(scriptsDir, "..");
const repoRoot = resolve(nativeDir, "../..");

function commandExists(command: string): boolean {
  return spawnSync(command, ["--version"], { stdio: "ignore" }).status === 0;
}

function run(
  command: string,
  args: string[],
  cwd: string = repoRoot,
  extraEnv: NodeJS.ProcessEnv = {},
): void {
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

function ensureRustup(): NodeJS.ProcessEnv {
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

function cargoNdkInstalled(extraEnv: NodeJS.ProcessEnv): boolean {
  return (
    spawnSync("cargo", ["ndk", "--version"], {
      stdio: "ignore",
      env: { ...process.env, ...extraEnv },
    }).status === 0
  );
}

run("pnpm", ["generate"]);
run("node", ["scripts/copy-bundled-data.mts"], nativeDir);

if (process.env.EAS_BUILD_PLATFORM === "ios") {
  const rustEnv = ensureRustup();
  run("rustup", ["target", "add", "aarch64-apple-ios", "aarch64-apple-ios-sim"], repoRoot, rustEnv);
  run("pnpm", ["build:engine-native-ffi"], repoRoot, rustEnv);
} else if (process.env.EAS_BUILD_PLATFORM === "android") {
  // Android loads the Rust engine as a per-ABI `libuoplan_engine.so` (JNI). The
  // jniLibs are git-ignored build artifacts, so they must be compiled on the EAS
  // worker before Gradle packages the app — otherwise the APK/AAB ships without
  // the engine and crashes (UnsatisfiedLinkError) on schedule generation.
  const rustEnv = ensureRustup();
  run(
    "rustup",
    [
      "target",
      "add",
      "aarch64-linux-android",
      "armv7-linux-androideabi",
      "x86_64-linux-android",
      "i686-linux-android",
    ],
    repoRoot,
    rustEnv,
  );
  // `build:engine-native-ffi-android` invokes `cargo ndk`; install it if the EAS
  // Android image doesn't already provide it.
  if (!cargoNdkInstalled(rustEnv)) {
    run("cargo", ["install", "cargo-ndk", "--locked"], repoRoot, rustEnv);
  }
  run("pnpm", ["build:engine-native-ffi-android"], repoRoot, rustEnv);
}
