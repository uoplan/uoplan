# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Always use `pnpm`, never `npm`.

## Commands

```bash
pnpm dev              # Vite dev server (runs generate + data-proto build first)
pnpm build            # Production build (generate + data-proto + vite + prerender)
pnpm test             # Run all workspace tests once (vitest)
pnpm test:watch       # Watch mode (apps/web)
pnpm typecheck        # tsgo typecheck across all packages (+ wrangler types)
pnpm lint             # oxlint over apps/web, apps/scraper, packages/core
pnpm lint:fix         # oxlint --fix
pnpm format           # oxfmt   (pnpm format:check for the CI dry-run)
pnpm check:arch       # Package-layering + worker-purity guardrails
pnpm check:i18n       # Translation completeness / locale parity
pnpm i18n:sync        # Scaffold missing msgids into both PO files
pnpm deadcode         # knip

# Scraper / data
pnpm scrape:catalogue # Scrape per-year course/program data (--force to re-scrape)
pnpm scrape:schedules # Scrape PeopleSoft schedule data
pnpm build:data-proto # Compile apps/scraper/data JSON → apps/web/public/data .pb
```

Run a single test with vitest directly, e.g.
`pnpm --filter @uoplan/core exec vitest run src/path/file.test.ts -t "case name"`.

Tooling is **oxc-based** — `oxlint` (`oxlint.config.ts`), `oxfmt` (`oxfmt.config.ts`), and `tsgo` (TypeScript native preview) for typechecking, not eslint/prettier/tsc. Git hooks run via `lefthook` (`lefthook.yml`, installed by `pnpm prepare`). CI (`.github/workflows/ci.yml`) runs: generate → lint → format:check → typecheck → check:arch → check:i18n → test → build. `apps/cli/**` is excluded (it has its own workflow).

## Architecture

**uoplan** (`uoplan.party`) is a requirement-first course planner for University of Ottawa students: a React SPA wizard (term → program → completed courses → requirements → schedule preferences) that turns degree requirements into conflict-free weekly timetables.

**Monorepo** (`pnpm-workspace.yaml` → `apps/*`, `packages/*`):

- `apps/web` — Vite + React 19 SPA (the planner UI).
- `apps/worker` — Cloudflare Worker (Hono): share redirect, OG image, web-push API.
- `apps/scraper` — Node scrapers that produce the source JSON datasets.
- `apps/cli` — Rust enrolment CLI (`@uoplan/cli` / `npx @uoplan/cli`), PeopleSoft search/enrol.
- `packages/proto` — protobuf schemas + generated TS (single source of truth).
- `packages/core` — scheduling engine, requirements, prerequisites, data cache, state encoding, grades.
- `packages/data` — runtime data client/loaders/transport (browser + node + worker).
- `packages/calendar` — calendar rendering primitives (layout, events, colours).
- `packages/transcript` — pdfjs-based transcript parsing (browser only).

### Tech Stack

React 19 + TypeScript, Zustand, Mantine v9, FullCalendar + a custom `WeekCalendar`, TanStack Router, Zod, Framer Motion, comlink web workers, pdfjs-dist (browser only).

### Package layering

`pnpm check:arch` (`scripts/check-architecture.mjs`) enforces that dependencies only point "downward":

```
proto  ←  core  ←  { data, calendar, transcript }  ←  apps (web, worker, scraper)
```

Apps are leaves (nothing depends on them). The deployed Worker bundle must **never** contain `pdfjs-dist` — transcript parsing is browser-only, and the arch check fails the build if it leaks in.

### Data Flow

```
apps/scraper/data/*.json        (source datasets, committed for diffability)
  → proto build (pnpm build:data-proto → apps/scraper/src/cli/proto.ts)
  → apps/web/public/data/*.pb    (git-ignored build artifacts, regenerated; NOT committed)
  → protobuf decode + DataCache (packages/core) via @uoplan/data client
  → Zustand slices (apps/web/src/store/)
  → React components (apps/web/src/components/)
```

### Key paths

- **`apps/web/src/store/`** — Zustand slices (`appStore.ts` composes them; see `docs/store-architecture.md`), `requirementCompute.ts`, `scheduleHelpers.ts` (requirement pools + `computeCoursesPerPool`).
- **`apps/web/src/lib/`** — `generateSchedulesAction.ts` (schedule-generation orchestration), URL/state glue, `encodeSchedulePayload.ts`, `importFromUEnroll.ts`.
- **`packages/core/src/`** — `generateSchedule.ts` (`generateBasicSchedule` / `generateAdvancedSchedule`), `engine/` (modular generation engine: composable constraint pipe, lazy seeded timetable + subset enumerators, relaxation diagnostics), `generation/` (shared primitives: `sectionCombos.ts`, `overlaps.ts`, `types.ts`), `scheduleCandidates/`, `requirements/`, `prerequisites/`, `dataCache.ts`, `stateEncode.ts`, `implicitHonours.ts`, `scheduleFromState.ts`.
- **`packages/proto/`** — `proto/{state,data,cli}.proto`; generated TS in `src/generated/*` (git-ignored), exported via `@uoplan/proto` namespaces (`StateProto`/`DataProto`/`CliProto`) or subpaths (`@uoplan/proto/state|data|cli`). Regenerate with `pnpm --filter @uoplan/proto generate`. `cli.proto` is synced to the Rust CLI via `pnpm sync:proto-cli`.
- **`apps/scraper/data/`** — source JSON datasets (committed).
- **`apps/web/public/data/`** — runtime protobuf `.pb` assets (git-ignored build artifacts).

### Schedule generation

Orchestration lives in **`apps/web/src/lib/generateSchedulesAction.ts`**. Both modes timetable through the modular **`packages/core/src/engine/`** engine (entry points `generateBasicSchedule` / `generateAdvancedSchedule` in `packages/core/src/generateSchedule.ts`). The OG-image worker generates from a `DecodedState` via `packages/core/src/scheduleFromState.ts`. Pool sizing and pinned-credit rules use **`apps/web/src/store/scheduleHelpers.ts`** plus helpers from **`packages/core/src/scheduleCandidates/`**. See `docs/schedule-generation.md`.

### Documentation

`docs/` documents the non-obvious subsystems — consult it before changing them (`docs/README.md` is the index): store architecture, state/URL encoding, schedule generation, requirements steps, course prerequisites, the custom calendar view, multi-year catalogue scraping, explore search, web-push notifications, and the CLI.

### Internationalisation (i18n)

All user-visible text in `apps/web` must be translated into both **English** and **French (Canadian)**. The app uses [Lingui](https://lingui.dev/) with ICU message format, but with **explicit string IDs** rather than Lingui macros — so `lingui extract` is NOT used (it finds no macros and obsoletes the whole catalog). Catalogs are managed by the custom tooling below.

- Translation catalogs: `apps/web/src/locales/en/messages.po` and `apps/web/src/locales/fr-CA/messages.po`
- Translation helper: `tr(id, values?)` from `apps/web/src/i18n` — usable anywhere (components, utility functions, etc.)
- Plural forms use ICU syntax: `{count, plural, one {# item} other {# items}}`
- Components that render translated text must call the `useTr()` hook from `apps/web/src/i18n` (it returns `tr` and re-renders on locale change). Non-React modules import `tr` directly.
- IDs reached only through dynamic `tr()` calls (template literals / record lookups) are enumerated in `scripts/i18n/dynamic-keys.mjs` so the tooling can see them.
- Workflow for new strings:
  1. Add the `tr("my.id")` call (or a dynamic family entry in `scripts/i18n/dynamic-keys.mjs`).
  2. Run `pnpm i18n:sync` to scaffold the missing `msgid` (empty `msgstr`) into **both** PO files (`--prune` deletes unused ids; `--check` is the CI dry-run).
  3. Fill in the English and French `msgstr` for the new ids.
  4. `pnpm check:i18n` (CI + pre-commit) enforces completeness, locale parity, no empty `msgstr`, and **no obsolete (`#~`) entries**.
