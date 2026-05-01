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

**Monorepo**: `apps/web` (Vite + React), `packages/schedule` (shared scheduling + requirements logic + protobuf schemas/types), `apps/scrapers`.

### Tech Stack

React 19 + TypeScript, Zustand, Mantine, FullCalendar, Vite + Vitest, Zod, Framer Motion, pdfjs-dist.

### Data Flow

```
Source JSON (`apps/scrapers/data`)
  → protobuf build step (`apps/scrapers/src/build_proto.ts`)
  → runtime `.pb` assets (`apps/web/public/data`)
  → protobuf decode + DataCache (packages/schedule)
  → Zustand (apps/web/src/store/)
  → React (apps/web/src/components/)
```

### Key paths

- **`apps/web/src/store/`** — Zustand slices (`appStore.ts` composes them), `requirementCompute.ts`, `scheduleHelpers.ts` (requirement pools + `computeCoursesPerPool`).
- **`apps/web/src/lib/`** — `generateSchedulesAction.ts` (schedule generation orchestration), `implicitHonours.ts`, URL state encoding, etc.
- **`packages/schedule/`** — `scheduleGenerator.ts` (backtracking), `requirements.ts`, `scheduleCandidates/` (`kUserKGeneral`, `explicitPoolPicks`), filters, prerequisites.
- **`apps/scrapers/data/`** — Source JSON datasets committed for diffability.
- **`apps/web/public/data/`** — Runtime protobuf (`.pb`) assets served to the client.

### Schedule generation

Orchestration lives in **`apps/web/src/lib/generateSchedulesAction.ts`**. The pure timetable solver is **`packages/schedule/src/scheduleGenerator.ts`** (`generateSchedules`, `generateSchedulesWithPinned`). Pool sizing and pinned-credit rules use **`apps/web/src/store/scheduleHelpers.ts`** and helpers from **`packages/schedule/src/scheduleCandidates/`**.

### URL sharing

`apps/web/src/store/slices/url.ts` (and related) encodes state for shareable URLs.
