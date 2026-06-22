import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

/**
 * Dev-only runtime-coverage collector. Pairs with `vite-plugin-istanbul`
 * (enabled together behind `COVERAGE=1`, see vite.config.ts) to capture which
 * code the *running app* actually executes — the signal static analysis can't
 * see. Used by the dead-code-elimination workflow (see docs + plan): walk the
 * whole app, then `pnpm coverage:report` to rank never-executed code.
 *
 * Contract:
 * - Injects a tiny client script (via `transformIndexHtml`) that periodically
 *   beacons `window.__coverage__` (Istanbul's accumulator) to the server, plus
 *   on tab-hide / unload and on an `Alt+Shift+C` manual flush. Each tab uses a
 *   stable random id so repeated cumulative snapshots overwrite one file instead
 *   of double-counting.
 * - `POST /__coverage__?id=<sid>` writes the snapshot to
 *   `apps/web/.nyc_output/web-<sid>.json` (the dir `nyc` + the reporter scripts
 *   read).
 *
 * Entirely contained in this plugin + the istanbul plugin, so teardown is just
 * removing both from the (COVERAGE-gated) plugin list — no app/src changes.
 */

const CLIENT_SNIPPET = `
(function () {
  var sid = (function () {
    try {
      var k = "__cov_sid__";
      var v = sessionStorage.getItem(k);
      if (!v) { v = Math.random().toString(36).slice(2) + Date.now().toString(36); sessionStorage.setItem(k, v); }
      return v;
    } catch (e) { return Math.random().toString(36).slice(2); }
  })();
  var url = "/__coverage__?id=" + encodeURIComponent(sid);
  function send() {
    try {
      var c = window.__coverage__;
      if (!c) return;
      var body = JSON.stringify(c);
      if (navigator.sendBeacon) {
        navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
      } else {
        fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: body, keepalive: true });
      }
    } catch (e) { /* ignore */ }
  }
  setInterval(send, 5000);
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") send(); });
  window.addEventListener("pagehide", send);
  window.addEventListener("beforeunload", send);
  window.addEventListener("keydown", function (e) {
    if (e.altKey && e.shiftKey && (e.key === "C" || e.key === "c")) { send(); console.info("[coverage] flushed snapshot " + sid); }
  });
  window.__dumpCoverage__ = send;
  console.info("[coverage] runtime instrumentation active (session " + sid + "). Flush: Alt+Shift+C or window.__dumpCoverage__()");
})();
`;

function readBody(req: NodeJS.ReadableStream): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function sanitizeId(raw: string | null): string {
  const cleaned = (raw ?? "").replaceAll(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
  return cleaned || `anon-${Date.now()}`;
}

export function coverageCollectorPlugin(): Plugin {
  const here = path.dirname(fileURLToPath(import.meta.url));
  // apps/web/vite -> apps/web/.nyc_output
  const outDir = path.resolve(here, "..", ".nyc_output");

  return {
    name: "coverage-collector",
    apply: "serve",
    configureServer(server) {
      fs.mkdirSync(outDir, { recursive: true });
      server.middlewares.use((req, res, next) => {
        if (!req.url || !req.url.startsWith("/__coverage__")) return next();
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("method not allowed");
          return;
        }
        const id = sanitizeId(new URL(req.url, "http://localhost").searchParams.get("id"));
        void (async () => {
          try {
            const body = await readBody(req);
            // Validate it parses as JSON before persisting so a malformed beacon
            // can't poison the report run.
            JSON.parse(body);
            fs.writeFileSync(path.join(outDir, `web-${id}.json`), body);
            res.statusCode = 204;
            res.end();
          } catch {
            res.statusCode = 400;
            res.end("bad coverage payload");
          }
        })();
      });
    },
    transformIndexHtml() {
      return [
        {
          tag: "script",
          attrs: { type: "text/javascript" },
          children: CLIENT_SNIPPET,
          injectTo: "body",
        },
      ];
    },
  };
}
