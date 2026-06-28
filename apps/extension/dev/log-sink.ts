import { createServer } from "node:http";
import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { LogLevel, SinkEvent } from "../src/shared/messages";

/**
 * Local dev log-sink. The extension's background worker POSTs batched
 * log/net/dom events here; this server pretty-prints them to stdout (so the
 * agent driving development sees uoCampus's structure + network live) and
 * appends raw NDJSON to a file for later inspection.
 *
 * Run with `pnpm --filter extension dev:sink`. Configure via env:
 *   - UOPLAN_EXT_SINK_PORT (default 9777 — must match src/shared/config.ts)
 *   - UOPLAN_EXT_LOG_DIR   (default apps/extension/.logs)
 */

const PORT = Number(process.env.UOPLAN_EXT_SINK_PORT ?? 9777);
const LOG_DIR = process.env.UOPLAN_EXT_LOG_DIR ?? join(import.meta.dirname, "..", ".logs");
const LOG_FILE = join(
  LOG_DIR,
  `events-${new Date().toISOString().replaceAll(/[:.]/g, "-")}.ndjson`,
);

mkdirSync(LOG_DIR, { recursive: true });

const C = {
  reset: "\u001B[0m",
  dim: "\u001B[2m",
  red: "\u001B[31m",
  green: "\u001B[32m",
  yellow: "\u001B[33m",
  blue: "\u001B[34m",
  magenta: "\u001B[35m",
  cyan: "\u001B[36m",
};

const LEVEL_COLOR: Record<LogLevel, string> = {
  debug: C.dim,
  info: C.green,
  warn: C.yellow,
  error: C.red,
};

function clock(ts: number): string {
  return new Date(ts).toLocaleTimeString();
}

function frameTag(inFrame: boolean | undefined): string {
  return inFrame ? `${C.magenta}[iframe]${C.reset}` : "";
}

function render(e: SinkEvent): void {
  const time = `${C.dim}${clock(e.ts)}${C.reset}`;
  if (e.type === "log") {
    const color = LEVEL_COLOR[e.level] ?? C.reset;
    console.log(
      `${time} ${color}${e.level.toUpperCase().padEnd(5)}${C.reset} ${frameTag(e.inFrame)} ${e.message}`,
    );
    return;
  }
  if (e.type === "net") {
    const status = e.error ? `${C.red}ERR${C.reset}` : `${C.cyan}${e.status ?? "?"}${C.reset}`;
    const dur = e.durationMs === undefined ? "" : `${C.dim}${e.durationMs}ms${C.reset}`;
    const err = e.error ? ` ${C.red}${e.error}${C.reset}` : "";
    console.log(
      `${time} ${C.blue}NET${C.reset}   ${frameTag(e.inFrame)} ${e.method} ${status} ${e.requestUrl} ${dur}${err}`,
    );
    return;
  }
  // DOM snapshot.
  const markers = Object.entries(e.markers)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${k}=${v}`)
    .join(" ");
  console.log(
    `${time} ${C.magenta}DOM${C.reset}   ${frameTag(e.inFrame)} ${e.title} ${C.dim}${e.url ?? ""}${C.reset}`,
  );
  if (markers) console.log(`${C.dim}        markers: ${markers}${C.reset}`);
  if (e.sections?.length) {
    console.log(`${C.cyan}        sections (${e.sections.length}):${C.reset}`);
    for (const s of e.sections) {
      const code = s.courseCode ? `${C.yellow}${s.courseCode}${C.reset} ` : "";
      console.log(
        `${C.dim}          ${s.kind[0]}#${s.classNbr} ${code}${s.name} | ${s.days} | ${s.instructor} | ${s.status}${C.reset}`,
      );
    }
  }
  if (e.outline) {
    console.log(
      `${C.dim}${e.outline
        .split("\n")
        .map((l) => `        ${l}`)
        .join("\n")}${C.reset}`,
    );
  }
}

function ingest(events: SinkEvent[]): void {
  for (const e of events) {
    render(e);
    try {
      appendFileSync(LOG_FILE, `${JSON.stringify(e)}\n`);
    } catch {
      // Best-effort file logging.
    }
  }
}

const server = createServer((req, res) => {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-headers", "content-type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "GET" && req.url === "/") {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("uoplan extension log-sink: POST /ingest\n");
    return;
  }

  if (req.method === "POST" && req.url === "/ingest") {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as { events?: SinkEvent[] };
        if (Array.isArray(body.events)) ingest(body.events);
        res.writeHead(204);
        res.end();
      } catch (err) {
        res.writeHead(400, { "content-type": "text/plain" });
        res.end(`bad request: ${(err as Error).message}\n`);
      }
    });
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(PORT, () => {
  console.log(`${C.green}● uoplan log-sink listening on http://localhost:${PORT}/ingest${C.reset}`);
  console.log(`${C.dim}  writing NDJSON → ${LOG_FILE}${C.reset}`);
});
