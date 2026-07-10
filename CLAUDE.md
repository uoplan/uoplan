# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Always use `pnpm`, never `npm`.

## Commands

```bash
pnpm dev              # Vite dev server (runs generate + engine-wasm:dev + data-proto build first)
pnpm build            # Production build (generate + engine-wasm + data-proto + vite + prerender)
pnpm test             # Run all workspace tests once (vitest)
pnpm test:watch       # Watch mode (apps/web)
pnpm test:coverage    # Per-package Vitest coverage (v8; text + HTML in each pkg's coverage/).
                      # apps/web merges BOTH the `unit` and `browser` projects (run without a
                      # --project filter); use `pnpm --filter web test:coverage:unit` for a
                      # fast unit-only coverage run. NOTE: a package's coverage only counts
                      # tests that live in that package — e.g. core helpers exercised solely by
                      # apps/web tests show 0% in @uoplan/core's own report.
pnpm test:ui          # Interactive Vitest UI for apps/web (per-package: pnpm --filter <pkg> test:ui)
pnpm typecheck        # tsgo typecheck across all packages (+ wrangler types)
pnpm lint             # oxlint over apps/web, apps/scraper, packages/core
pnpm lint:fix         # oxlint --fix
pnpm format           # oxfmt   (pnpm format:check for the CI dry-run)
pnpm check:arch       # Package-layering + worker-purity guardrails
pnpm check:i18n       # Translation completeness / locale parity
pnpm i18n:sync        # Scaffold missing msgids into both PO files
pnpm fallow           # fallow — dead code + duplication + health (replaces knip)
pnpm check:fallow     # CI/pre-commit gate: fallow --fail-on-issues --skip health
                      # NOTE: `health` (complexity/CRAP) is TEMPORARILY DISABLED in the
                      # gate (see below). The full advisory analysis incl. health is
                      # still available on demand via `pnpm fallow health`.

# Rust/WASM schedule engine (packages/engine)
pnpm build:engine-wasm                   # wasm-pack build --release (run before vite/worker builds)
pnpm build:engine-wasm:dev               # wasm-pack build --dev
pnpm --filter @uoplan/engine test:rust   # cargo test for the engine crate
pnpm coverage:rust                       # cargo-llvm-cov HTML report (target/llvm-cov/html)
# Rust coverage needs the tool once: cargo install cargo-llvm-cov && rustup component add llvm-tools-preview
# (runs tests under --release; wall-clock timing asserts auto-relax under instrumentation)

# Lighthouse (report-only — runs as a lefthook pre-push hook)
pnpm lighthouse       # Build the web app + audit 7 routes with Lighthouse CI (@lhci/cli),
                      # served via `vite preview` on port 4178 (mirrors the E2E_SERVER=preview
                      # a11y path). Categories: performance, accessibility, best-practices, seo
                      # (PWA removed in Lighthouse 12). Prints a score table; HTML/JSON reports
                      # land in apps/web/.lighthouseci/ (gitignored). REPORT-ONLY: never fails on
                      # low scores, so the pre-push hook never blocks (skip with `git push
                      # --no-verify`). LH_SKIP_BUILD=1 reuses the existing dist/client build;
                      # CHROME_PATH overrides the browser (defaults to Playwright's Chromium).

# Scraper / data
# Granular scraper steps run via the scraper workspace (most are order-sensitive — see below):
pnpm --filter scraper scrape:catalogue        # Scrape per-year course/program data (--force to re-scrape)
pnpm --filter scraper scrape:schedules        # Scrape PeopleSoft schedule data
pnpm --filter scraper check:terms             # Sync terms.json from uOttawa's live class-search dropdown
pnpm build:data-proto                         # Compile apps/scraper/data JSON → runtime .pb assets
# Orchestrators (auto-sequenced, unattended — no auth/browser needed):
pnpm data:grades      # Refresh grades: grades:convert → scrape:grades → enrich:schedules → build:data-proto
pnpm data:build       # Full derived rebuild from committed JSON: + build:professors before proto
```

Run a single test with vitest directly, e.g.
`pnpm --filter @uoplan/core exec vitest run src/path/file.test.ts -t "case name"`.

Tooling is **oxc-based** — `oxlint` (`oxlint.config.ts`), `oxfmt` (`oxfmt.config.ts`), and `tsgo` (TypeScript native preview) for typechecking, not eslint/prettier/tsc. There is **no ESLint** in the toolchain: oxlint reimplements eslint-origin rules natively (the `Source` column in `oxlint --rules` only marks a rule's origin), and suppression comments must use `// oxlint-disable-next-line <rule>` with oxlint's canonical rule names (e.g. `typescript/no-explicit-any`, `react/exhaustive-deps`) — never `eslint-disable`. Enabled oxlint plugins: `typescript`, `react`, `jsx-a11y`, `unicorn`, `oxc`, `import`, `promise`, `node` (plus the custom `./scripts/i18n/oxlint-plugin.ts` JS plugin); `correctness` is `error` and a curated strict set (import hygiene + member-level `sort-imports`, `no-console`, `no-explicit-any`, `prefer-template`, and select `unicorn`/`promise` rules) is enabled at `error`. `no-console` is globally `error` but exempt for `apps/scraper/**` and the Node build/check scripts (`scripts/**`, `apps/web/scripts/**`, `packages/*/scripts/**` — Node CLI, where stdout is the output) and test files. Note oxlint has no grouped `import/order` autofix and several `unicorn` rules (`no-array-for-each`, `no-lonely-if`, `no-new-array`) have no working autofix in this version — they're fixed by hand. Git hooks run via `lefthook` (`lefthook.yml`, installed by `pnpm prepare`; pre-commit runs oxfmt, oxlint, typecheck, check:i18n, check:fallow, and cargo-clippy; **pre-push** runs a report-only `pnpm lighthouse` audit that never blocks the push). CI (`.github/workflows/ci.yml`) runs: install → setup Rust + wasm-pack → generate → build:engine-wasm → cargo test → lint → format:check → typecheck → check:arch → check:i18n → check:fallow → test → build. The engine WASM must be built before typecheck/test/build (web tests load it). `apps/cli/**` is excluded (it has its own workflow).

> **fallow `health` temporarily disabled in the gate.** Both the CI step and the
> lefthook pre-commit hook run `pnpm check:fallow` (`fallow --fail-on-issues --skip
health`), which enforces only dead-code + duplication. The complexity/CRAP `health`
> analysis is intentionally excluded for now because the codebase has a large backlog
> of complexity/CRAP findings that need a dedicated refactoring + test-coverage effort
> (tracked separately). It is **not** gated yet — run it manually with `pnpm fallow
health` to inspect the backlog. To re-enable gating later, drop `--skip health` from
> the `check:fallow` script in `package.json`.

## Architecture

**uoplan** (`uoplan.party`) is a requirement-first course planner for University of Ottawa students: a React SPA wizard (term → program → completed courses → requirements → schedule preferences) that turns degree requirements into conflict-free weekly timetables.

**Monorepo** (`pnpm-workspace.yaml` → `apps/*`, `packages/*`):

- `apps/web` — Vite + React 19 SPA (the planner UI).
- `apps/worker` — Cloudflare Worker (Hono): share redirect, OG image, web-push API.
- `apps/scraper` — Node scrapers that produce the source JSON datasets.
- `apps/cli` — Rust enrolment CLI (`@uoplan/cli` / `npx @uoplan/cli`), PeopleSoft search/enrol.
- `packages/proto` — protobuf schemas + generated TS (single source of truth).
- `packages/engine` — **Rust → WASM** schedule-generation engine (selection + timetabling), built with `wasm-pack`. The single source of truth for generation; consumed in-process by both the web schedule worker and the OG-image worker.
- `packages/core` — requirements, prerequisites, data cache, state encoding, grades, the TS↔engine bridge (`engineBridge.ts`), and retained TS relaxation diagnostics.
- `packages/data` — runtime data client/loaders/transport (browser + node + worker).
- `packages/calendar` — calendar rendering primitives (layout, events, colours).
- `packages/transcript` — pdfjs-based transcript parsing (browser only).

### Tech Stack

React 19 + TypeScript, Zustand, Mantine v9, FullCalendar + a custom `WeekCalendar`, TanStack Router, Zod, Framer Motion, comlink web workers, pdfjs-dist (browser only).

### Package layering

`pnpm check:arch` (`scripts/check-architecture.ts`) enforces that dependencies only point "downward".
The full graph (including store/ui/app/theme/i18n) is documented in `docs/modularization.md`.
Simplified view:

```
proto  ←  core  ←  { data, calendar, transcript, store }  ←  apps (web, native, worker, scraper)
theme / i18n / navigation / analytics / ui  →  app  →  apps (web, native)
```

Apps are leaves (nothing depends on them). The deployed Worker bundle must **never** contain `pdfjs-dist` — transcript parsing is browser-only, and the arch check fails the build if it leaks in.

### Data Flow

```
apps/scraper/data/*.json        (source datasets, committed for diffability)
  → proto build (pnpm build:data-proto → apps/scraper/src/cli/proto.ts)
  → apps/web/public/data/*.pb    (git-ignored build artifacts, regenerated; NOT committed)
  → protobuf decode + DataCache (packages/core) via @uoplan/data client
  → @uoplan/store slices (packages/store; web mounts via apps/web/src/store adapters)
  → React components (apps/web/src/components/ or packages/app screens)
```

### Key paths

- **`packages/store/`** — Canonical Zustand planner (`appStore`, slices, projection hooks, `AppServices`). See `docs/store-architecture.md`.
- **`apps/web/src/store/`** — Web adapters (`webServices.ts`) + temporary re-export shims + web-only stores (`graphPlannerStore`, …).
- **`apps/web/src/lib/`** — `generateSchedulesAction.ts` (schedule-generation orchestration), `engine/engineHost.ts` (web WASM init), URL/state glue, `encodeSchedulePayload.ts`, `importFromUEnroll.ts`.
- **`packages/engine/`** — Rust crate compiled to WASM / native FFI. Scripts: `build:wasm` / `build:wasm:dev` / `test:rust` / coverage / bench.
- **`packages/core/src/`** — Domain kitchen sink (to be split; see `docs/modularization.md`): `engineBridge.ts`, generation helpers, requirements, grades, search, `stateEncode.ts`, …
- **`packages/ui/`**, **`packages/app/`**, **`packages/navigation/`** — Write-once UI stack (primitives + screens + route contract).
- **`packages/i18n/`** — Shared Lingui catalogs + `tr` / `useTr` (not under `apps/web/src/locales`).
- **`packages/proto/`** — `proto/{state,data,cli,engine,feedback}.proto`; generate with `pnpm --filter @uoplan/proto generate`.
- **`apps/scraper/data/`** — source JSON datasets (committed).
- **`apps/web/public/data/`** — runtime protobuf `.pb` assets (git-ignored build artifacts).

### Schedule generation

Generation is implemented in **Rust → WASM / native FFI** (`packages/engine`); there is **no JS generation implementation**. TS only builds the `GenerationRequest`, runs the engine, and maps the `GenerationResponse`. Web orchestration lives in **`apps/web/src/lib/generateSchedulesAction.ts`** (Comlink worker + `engineHost.ts`); the TS↔engine bridge is **`packages/core/src/engineBridge.ts`**. The OG-image worker uses **`packages/core/src/scheduleFromStateEngine.ts`**. Pool sizing / pinned-credit rules live in **`packages/store`** (`scheduleHelpers`). Build the engine before web/worker builds (`pnpm build:engine-wasm`). See `docs/schedule-generation.md`.

### Documentation

`docs/` documents non-obvious subsystems (`docs/README.md` is the index). Start with **`docs/modularization.md`** for package boundaries, then store architecture, state/URL encoding, schedule generation, requirements, prerequisites, calendar, multi-year catalogue, explore search, web-push, CLI, native deploy.

### Internationalisation (i18n)

All user-visible text must be translated into both **English** and **French (Canadian)**. The app uses [Lingui](https://lingui.dev/) with ICU message format and **explicit string IDs** (no Lingui macros / no `lingui extract`). Catalogs are managed by the custom tooling below.

- Translation catalogs: `packages/i18n/src/locales/en/messages.po` and `packages/i18n/src/locales/fr-CA/messages.po`
- Compile catalogs: `pnpm --filter @uoplan/i18n i18n:compile` (compiled `messages.ts` is gitignored)
- Translation helper: `tr(id, values?)` from `@uoplan/i18n` (web also re-exports via `apps/web/src/i18n`)
- Plural forms use ICU syntax: `{count, plural, one {# item} other {# items}}`
- Components that render translated text must call `useTr()` (returns `tr`, re-renders on locale change). Non-React modules import `tr` directly.
- IDs reached only through dynamic `tr()` calls are enumerated in `scripts/i18n/dynamic-keys.ts`.
- Workflow for new strings:
  1. Add the `tr("my.id")` call (or a dynamic family entry in `scripts/i18n/dynamic-keys.ts`).
  2. Run `pnpm i18n:sync` to scaffold the missing `msgid` (empty `msgstr`) into **both** PO files (`--check` is the CI dry-run).
  3. Fill in the English and French `msgstr` for the new ids.
  4. Compile with `pnpm --filter @uoplan/i18n i18n:compile` when needed locally.
  5. `pnpm check:i18n` (CI + pre-commit) enforces completeness, locale parity, no empty `msgstr`, and **no obsolete (`#~`) entries**.
- **Do not run `pnpm i18n:sync --prune`** to clean up a few ids. `check:i18n` tolerates extra/unused catalog keys, and the catalogs carry hundreds of them (ids reachable only via patterns `--prune`'s scan doesn't capture), so `--prune` mass-deletes ~hundreds of legitimately-used entries. When removing a string, delete just that `msgid`/`msgstr` block from **both** PO files (and its `dynamic-keys.ts` entry) by hand.
