# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev              # Start Vite dev server (apps/web)
pnpm build            # Production build
pnpm test             # Run tests once (vitest)
pnpm test:watch       # Watch mode
pnpm scrape:catalogue # Scrape course/program data
pnpm scrape:schedules # Scrape schedule data
```

Always use `pnpm`, never `npm`.

## Architecture

**uoplan** is a course planner for University of Ottawa students: a React SPA with a wizard (term → program → completed courses → requirements → schedule preferences) and a calendar of generated timetables.

**Monorepo**: `apps/web` (Vite + React), `packages/core` (shared scheduling + requirements logic + protobuf schemas/types), `apps/scraper`.

### Tech Stack

React 19 + TypeScript, Zustand, Mantine, FullCalendar, Vite + Vitest, Zod, Framer Motion, pdfjs-dist.

### Data Flow

```
Source JSON (`apps/scraper/data`)
  → protobuf build step (`apps/scraper/src/build_proto.ts`)
  → runtime `.pb` assets (`apps/web/public/data`)
  → protobuf decode + DataCache (packages/core)
  → Zustand (apps/web/src/store/)
  → React (apps/web/src/components/)
```

### Key paths

- **`apps/web/src/store/`** — Zustand slices (`appStore.ts` composes them), `requirementCompute.ts`, `scheduleHelpers.ts` (requirement pools + `computeCoursesPerPool`).
- **`apps/web/src/lib/`** — `generateSchedulesAction.ts` (schedule generation orchestration), `implicitHonours.ts`, URL state encoding, etc.
- **`packages/core/`** — `generation/` (shared timetabling primitives: `sectionCombos.ts`, `overlaps.ts`, constraint filters), `engine/` (modular generation engine: composable constraint pipe, lazy seeded timetable + subset enumerators, relaxation diagnostics), `requirements/`, `scheduleCandidates/` (`kUserKGeneral`, `explicitPoolPicks`), filters, prerequisites. Schedule generation entry points are `generateSchedule.ts` (`generateBasicSchedule`, `generateAdvancedSchedule`).
- **`apps/scraper/data/`** — Source JSON datasets committed for diffability.
- **`apps/web/public/data/`** — Runtime protobuf (`.pb`) assets served to the client.

### Schedule generation

Orchestration lives in **`apps/web/src/lib/generateSchedulesAction.ts`**. Both modes timetable through the modular **`packages/core/src/engine/`** engine (entry points `generateBasicSchedule` / `generateAdvancedSchedule` in `packages/core/src/generateSchedule.ts`). Fixed-course-set timetabling (e.g. course-swap) goes through `timetableFixedCourseSet`. Pool sizing and pinned-credit rules use **`apps/web/src/store/scheduleHelpers.ts`** and helpers from **`packages/core/src/scheduleCandidates/`**.

### URL sharing

`apps/web/src/store/slices/url.ts` (and related) encodes state for shareable URLs.

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
