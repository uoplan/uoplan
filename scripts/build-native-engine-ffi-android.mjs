#!/usr/bin/env node
// Builds the uoplan schedule-generation engine (packages/engine) as a native
// shared library (`libuoplan_engine.so`) for every Android ABI and stages it in
// the Expo local module's jniLibs dir (`apps/native/modules/uoplan-engine/
// android/src/main/jniLibs/<abi>/`), where Gradle packages it into the APK.
//
// The engine is the single source of truth for generation: the web app + OG
// worker run it as WASM, iOS links the XCFramework, Android loads this `.so`
// (JNI exports in packages/engine/src/jni_android.rs). Output is git-ignored (a
// build artifact) — run this before `expo prebuild -p android` / a gradle build
// (or `pnpm build:engine-native-ffi-android`).
//
// Requires the Android NDK + `cargo-ndk` (`cargo install cargo-ndk`) and the
// Rust Android targets (`rustup target add aarch64-linux-android
// armv7-linux-androideabi x86_64-linux-android i686-linux-android`).
// ANDROID_NDK_HOME (or ANDROID_HOME with an installed ndk) must be set.
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { engineDir, repoRoot, run } from "./lib/native-engine.mjs";

const jniLibsOut = join(repoRoot, "apps/native/modules/uoplan-engine/android/src/main/jniLibs");

// cargo-ndk ABI names (it maps these to the corresponding Rust target triples).
const ABIS = ["arm64-v8a", "armeabi-v7a", "x86_64", "x86"];
// minSdk of the Expo module (android/build.gradle).
const MIN_SDK = "24";

function resolveNdkHome() {
  if (process.env.ANDROID_NDK_HOME) {
    return process.env.ANDROID_NDK_HOME;
  }
  const sdk = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT;
  if (sdk) {
    const ndkRoot = join(sdk, "ndk");
    if (existsSync(ndkRoot)) {
      const versions = readdirSync(ndkRoot).sort();
      if (versions.length > 0) {
        return join(ndkRoot, versions[versions.length - 1]);
      }
    }
  }
  return undefined;
}

const ndkHome = resolveNdkHome();
if (!ndkHome || !existsSync(ndkHome)) {
  throw new Error(
    "Android NDK not found. Set ANDROID_NDK_HOME (or ANDROID_HOME with an installed ndk).",
  );
}

// Fresh jniLibs so a removed ABI never lingers in the APK.
rmSync(jniLibsOut, { recursive: true, force: true });
mkdirSync(jniLibsOut, { recursive: true });

const args = ["ndk"];
for (const abi of ABIS) {
  args.push("-t", abi);
}
args.push("--platform", MIN_SDK, "-o", jniLibsOut, "build", "--release", "-p", "uoplan-engine");

run("cargo", args, {
  cwd: engineDir,
  env: { ...process.env, ANDROID_NDK_HOME: ndkHome },
});

for (const abi of ABIS) {
  const so = join(jniLibsOut, abi, "libuoplan_engine.so");
  if (!existsSync(so)) {
    throw new Error(`expected shared lib not found: ${so}`);
  }
}

console.log(`\n✓ Built libuoplan_engine.so for ${ABIS.join(", ")} → ${jniLibsOut}`);
