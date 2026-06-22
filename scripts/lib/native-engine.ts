// Shared helpers for the native-engine FFI build scripts (iOS XCFramework +
// Android jniLibs). Both compile the packages/engine crate to a native library
// for the Expo local module `apps/native/modules/uoplan-engine`.
import { execFileSync } from "node:child_process";
import type { ExecFileSyncOptions } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

export const repoRoot = join(here, "..", "..");
export const engineDir = join(repoRoot, "packages/engine");

export function run(cmd: string, args: string[], opts: ExecFileSyncOptions = {}): void {
  console.log(`$ ${cmd} ${args.join(" ")}`);
  execFileSync(cmd, args, { stdio: "inherit", ...opts });
}
