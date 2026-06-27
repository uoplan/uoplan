import { spawn } from "node:child_process";
import { createRequire } from "node:module";

// Runs `eas build --local` while forcing eas-cli to use OUR pnpm-installed,
// pnpm-patched copy of the local build plugin instead of fetching a fresh one via
// `npx -y eas-cli-local-build-plugin@<version>` (which lands in the npx cache and
// can't be patched). eas-cli honours EAS_LOCAL_BUILD_PLUGIN_PATH and spawns it
// directly (see eas-cli build/build/local.js getCommandAndArgsAsync). The plugin
// resolves @expo/build-tools@20.1.0, which carries the patch in
// patches/@expo__build-tools@20.1.0.patch dropping the macOS-Tahoe-breaking
// `security find-identity -v` flag (expo/eas-cli#3678, #3645).
//
// If you bump eas-cli, check the plugin version it expects (PLUGIN_PACKAGE_VERSION
// = the bundled @expo/eas-build-job version) and keep the eas-cli-local-build-plugin
// devDependency + the patched @expo/build-tools version in sync.

const require = createRequire(import.meta.url);
const pluginPath = require.resolve("eas-cli-local-build-plugin/bin/run");

const forwarded = process.argv.slice(2).filter((arg) => arg !== "--");
const buildArgs =
  forwarded.length > 0 ? forwarded : ["--profile", "production", "--platform", "ios"];

const child = spawn("eas", ["build", "--local", ...buildArgs], {
  stdio: "inherit",
  env: { ...process.env, EAS_LOCAL_BUILD_PLUGIN_PATH: pluginPath },
});

child.on("error", (error) => {
  console.error("Failed to spawn `eas` — is eas-cli installed and on PATH?", error);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal !== null) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
