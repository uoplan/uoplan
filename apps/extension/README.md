# uoPlan browser extension

MV3 browser extension (Chrome-primary, Firefox 128+) that improves the
**uoCampus** (`uocampus.uottawa.ca`, Oracle PeopleSoft Campus Solutions) layout
and will overlay uoPlan grade data beside courses.

> **Phase 1 (current):** groundwork only — a loadable extension that streams its
> logs live to a local sink, dumps uoCampus's DOM/iframe structure, captures the
> page's network calls, applies a tiny proof-of-injection CSS tweak, and wires up
> (but does not yet render) the uoPlan grade-data pipeline. The responsive
> redesign and the grade-overlay UI come in later phases.

## Layout

```
apps/extension/
  manifest.config.ts   # crxjs MV3 manifest (Chrome + gecko settings)
  vite.config.ts       # Vite + @crxjs/vite-plugin build → dist/
  dev/log-sink.ts      # local HTTP server: prints extension logs live + NDJSON
  src/
    background/        # service worker: batches events → sink, routes commands, loads grades
    content/           # isolated content script + MAIN-world net hook + DOM serializer + CSS
    popup/             # minimal vanilla popup (dump structure / load grades / check sink)
    shared/            # config, typed messages, reporter, grade-data loader
```

The extension imports `@uoplan/{proto,core,data}` directly from the monorepo —
Vite transpiles them in-graph (no prebuilt artifacts beyond the generated proto).

## Dev workflow

From the repo root (uses `pnpm`; honours the 1-week min-release-age gate):

```bash
# 1. Generate the proto TS the data layer needs (once per fresh checkout):
pnpm --filter @uoplan/proto generate

# 2. Start the log sink (streams every extension event to this terminal):
pnpm --filter extension dev:sink

# 3. In another terminal, build the extension:
pnpm --filter extension build        # → apps/extension/dist/
# or watch-rebuild while iterating:
pnpm --filter extension dev
```

Then load it in Chrome:

1. Open `chrome://extensions`.
2. Toggle **Developer mode** (top-right).
3. **Load unpacked** → select `apps/extension/dist/`.
4. Visit `https://uocampus.uottawa.ca/` — you should see a thin blue accent strip
   at the top of the page, and DOM/network events streaming into the sink
   terminal. The popup's buttons trigger an on-demand DOM dump, a grade-data
   load, and a sink health check.

### Grade data source

The background worker fetches `manifest.json` + `grades.pb` from the uoPlan data
origin and decodes it via `@uoplan/{proto,core,data}`. In dev it reuses the
running web dev server (`http://localhost:5173`); in prod it hits
`https://uoplan.party`. Bytes are cached in `storage.local` with a 6h TTL.

> Prod fetches from a content-script/Firefox context require CORS on the data
> origin — see `apps/web/public/_headers` (`access-control-allow-origin: *` on
> `/data/*` and `/assets/*`). Chrome dev against `localhost:5173` is already
> unblocked via the background worker's host permission.

## Firefox

`pnpm --filter extension build:firefox` emits to `dist-firefox/`. Firefox MV3
support (background service worker + `world: "MAIN"` content scripts) needs
Firefox 128+. crxjs is Chrome-centric, so the Firefox build is a best-effort
secondary target in Phase 1.
