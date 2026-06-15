#!/usr/bin/env node
// Builds the uoplan schedule-generation engine (packages/engine) as a native
// static library for iOS and packages it as an XCFramework consumed by the Expo
// local module `apps/native/modules/uoplan-engine`.
//
// The engine is the single source of truth for generation: the web app + OG
// worker run it as WASM, the native apps link this XCFramework. Output is
// git-ignored (a build artifact) — run this before `pod install` / `expo run:ios`
// (or `pnpm build:engine-native-ffi`).
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const engineDir = join(repoRoot, "packages/engine");
const includeDir = join(engineDir, "native/include");
const moduleIosDir = join(repoRoot, "apps/native/modules/uoplan-engine/ios");
const xcframeworkOut = join(moduleIosDir, "UoplanEngine.xcframework");

const LIB_NAME = "libuoplan_engine.a";
const TARGETS = [
  { triple: "aarch64-apple-ios", label: "device" },
  { triple: "aarch64-apple-ios-sim", label: "simulator" },
];

function run(cmd, args, opts = {}) {
  console.log(`$ ${cmd} ${args.join(" ")}`);
  execFileSync(cmd, args, { stdio: "inherit", ...opts });
}

// 1. Build a static library for each apple target. `cargo rustc --crate-type
//    staticlib` overrides the crate-type for this build only, so the WASM build
//    (cdylib) is untouched.
for (const { triple } of TARGETS) {
  run("cargo", ["rustc", "--release", "--crate-type", "staticlib", "--target", triple], {
    cwd: engineDir,
  });
}

// 2. Stage headers (the C header + module map) so Swift can `import UoplanEngineFFI`.
const headersStage = join(engineDir, "target/native-ffi-headers");
rmSync(headersStage, { recursive: true, force: true });
mkdirSync(headersStage, { recursive: true });
for (const file of ["uoplan_engine.h", "module.modulemap"]) {
  copyFileSync(join(includeDir, file), join(headersStage, file));
}

// 3. Assemble the XCFramework (device + simulator slices share arm64, but carry
//    distinct platform load commands so xcodebuild keeps them separate).
rmSync(xcframeworkOut, { recursive: true, force: true });
mkdirSync(moduleIosDir, { recursive: true });
const createArgs = ["-create-xcframework"];
for (const { triple } of TARGETS) {
  const lib = join(engineDir, "target", triple, "release", LIB_NAME);
  if (!existsSync(lib)) {
    throw new Error(`expected static lib not found: ${lib}`);
  }
  createArgs.push("-library", lib, "-headers", headersStage);
}
createArgs.push("-output", xcframeworkOut);
run("xcodebuild", createArgs);

console.log(`\n✓ Built ${xcframeworkOut}`);
