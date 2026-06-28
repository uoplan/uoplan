import { defineManifest } from "@crxjs/vite-plugin";
import pkg from "./package.json" with { type: "json" };
import { UOCAMPUS_MATCHES } from "./src/shared/config";

/**
 * MV3 manifest (Chrome-primary; Firefox via `browser_specific_settings`).
 *
 * Two content-script entries per target frame:
 *   - the ISOLATED-world script (`content/index.ts` + `restyle.css`) for DOM
 *     dumping, CSS, and relaying;
 *   - the MAIN-world hook (`content/inject.ts`) that observes the page's own
 *     `fetch`/XHR. `world: "MAIN"` needs Chrome 111+ / Firefox 128+.
 *
 * `all_frames` + `run_at: document_start` so we attach inside PeopleSoft's nested
 * `ptifrmtgtframe` before the page wires up its network calls.
 */

const UOTTAWA_MATCHES = [...UOCAMPUS_MATCHES];

export default defineManifest({
  manifest_version: 3,
  name: "uoPlan",
  description:
    "Improves the uoCampus (PeopleSoft) layout and overlays uoPlan grade data beside courses.",
  version: pkg.version,
  action: { default_popup: "src/popup/index.html", default_title: "uoPlan" },
  background: { service_worker: "src/background/service-worker.ts", type: "module" },
  content_scripts: [
    {
      matches: UOTTAWA_MATCHES,
      js: ["src/content/content-script.ts"],
      css: ["src/content/restyle.css"],
      all_frames: true,
      run_at: "document_start",
      match_about_blank: true,
    },
    {
      matches: UOTTAWA_MATCHES,
      js: ["src/content/inject.ts"],
      world: "MAIN",
      all_frames: true,
      run_at: "document_start",
      match_about_blank: true,
    },
  ],
  permissions: ["storage", "activeTab"],
  host_permissions: [
    "https://uocampus.uottawa.ca/*",
    "https://*.uottawa.ca/*",
    "https://uoplan.party/*",
    "http://localhost:5173/*",
    "http://localhost:9777/*",
  ],
  browser_specific_settings: {
    gecko: { id: "extension@uoplan.party", strict_min_version: "128.0" },
  },
});
