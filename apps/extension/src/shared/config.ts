/**
 * Shared, environment-agnostic constants for the extension. Safe to import from
 * any context (background service worker, content script, popup) AND from the
 * Node dev tooling (`manifest.config.ts`, `dev/log-sink.ts`), so the manifest
 * host-permission, the background reporter, and the sink server never drift.
 */

/** Port the local dev log-sink server listens on (see `dev/log-sink.ts`). */
const SINK_PORT = 9777;

/** Full ingest endpoint the background worker POSTs batched events to. */
export const SINK_URL = `http://localhost:${SINK_PORT}/ingest`;

/**
 * Where the extension fetches uoPlan data assets (`manifest.json` + `.pb`).
 * In dev we reuse the user's running web dev server (it serves the same
 * `/data/manifest.json` + `/data/<id>.pb` contract via the data-dev-server
 * plugin); in prod we hit uoplan.party.
 */
export const DEV_DATA_BASE_URL = "http://localhost:5173";
export const PROD_DATA_BASE_URL = "https://uoplan.party";

/** Hosts whose pages the extension enhances (uoCampus / PeopleSoft). */
export const UOCAMPUS_MATCHES = [
  "https://uocampus.uottawa.ca/*",
  "https://*.uottawa.ca/*",
] as const;
