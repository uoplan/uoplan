# Modularization north star

This document is the source of truth for the monorepo package graph and the
write-once product stack. It supersedes path references in older docs that still
point at pre-extraction locations under `apps/web/src/store` or
`apps/web/src/locales`.

## Target layering

Dependencies only point **down**. Enforced by `pnpm check:arch`
(`scripts/check-architecture.ts`).

```
@uoplan/proto
@uoplan/engine                 (Rust → WASM / native FFI artifacts)

@uoplan/theme
@uoplan/i18n
@uoplan/navigation
@uoplan/analytics
@uoplan/search                 (done — description index)
@uoplan/domain                 (done — brand, dataTypes, dataCache, utils)

@uoplan/grades                 (done — grade analytics/trends/lookup; feedback still in core)
@uoplan/core                   (remaining: requirements, generation, professors, stateEncode, feedback, …)
@uoplan/data
@uoplan/calendar
@uoplan/transcript             (pdfjs; browser-only — never in worker)

@uoplan/store                  (Zustand planner; services-injected)
@uoplan/ui                     (dual-platform primitives: *.web.tsx / *.native.tsx)
@uoplan/app                    (write-once screens against ui + navigation + store)

apps: web | native | worker | scraper | cli
apps/marketing                 (isolated Remotion project; not a workspace member)
```

### Write-once product stack

| Package              | Role                                                              |
| -------------------- | ----------------------------------------------------------------- |
| `@uoplan/ui`         | Platform-resolved UI primitives (Mantine on web, RN on native).   |
| `@uoplan/navigation` | Abstract route names + `useNavigate` contract.                    |
| `@uoplan/store`      | Single planner state machine. Platforms inject `AppServices`.     |
| `@uoplan/app`        | Product screens authored once. No Mantine, RN, or router imports. |
| web / native shells  | Adapters, routing, chrome (tabs, Liquid Glass, Vite shell).       |

`WelcomeScreen` in `packages/app` is the end-to-end proof. Further screens migrate
here incrementally.

### `@uoplan/core` split

`packages/core` is shrinking. Status:

| Package                | Domain                                                                          | Status                            |
| ---------------------- | ------------------------------------------------------------------------------- | --------------------------------- |
| `@uoplan/domain`       | `brand`, `dataTypes`, `dataCache`, `courseAlias`, `facultyIdentity`, pure utils | **done**                          |
| `@uoplan/search`       | `DescriptionSearchIndex`, tokenize/encode helpers                               | **done**                          |
| `@uoplan/grades`       | grade lookup/distribution/trends/analytics, programTrends                       | **done** (feedback still in core) |
| `@uoplan/requirements` | requirements, prerequisites, honours, immersion                                 | planned                           |
| `@uoplan/generation`   | engine bridge, generation helpers, schedule preview                             | planned                           |
| `@uoplan/professors`   | identity, ratings, co-teaching graphs                                           | planned                           |
| `@uoplan/state-codec`  | URL/localStorage state encoding                                                 | planned                           |
| `@uoplan/ics`          | ICS export                                                                      | planned                           |

Core keeps **compat re-exports** for moved modules. Prefer importing from the new packages
(`@uoplan/domain`, `@uoplan/search`, `@uoplan/grades`) when touching call sites.

## Current vs target ownership

| Concern                 | Canonical home today                               | Notes                                                                                                                                                                                                                       |
| ----------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Planner store           | `packages/store`                                   | Web mounts via thin adapters in `apps/web/src/store` (`webServices`, `appStore` factory). Re-export shims removed; consumers import `@uoplan/store/*` directly. Native still uses React Context providers (to adopt store). |
| i18n catalogs           | `packages/i18n/src/locales/{en,fr-CA}/messages.po` | Web re-exports via `apps/web/src/i18n`.                                                                                                                                                                                     |
| Theme tokens            | `packages/theme`                                   | Native tokens generated into the package.                                                                                                                                                                                   |
| Schedule generation SoT | `packages/engine` (Rust)                           | TS only builds requests / maps responses via `engineBridge`.                                                                                                                                                                |
| Calendar layout         | `packages/calendar`                                | Shared pure layout; platform grids remain in apps.                                                                                                                                                                          |

## Dual implementations to collapse

These pairs are the highest-ROI consolidation targets:

| Domain                      | Web                                           | Native                                                       |
| --------------------------- | --------------------------------------------- | ------------------------------------------------------------ |
| Generation orchestration    | `apps/web/src/lib/generateSchedulesAction.ts` | `apps/native/src/lib/generate-schedule.ts`                   |
| Requirements personalize    | `packages/store` requirement compute          | `apps/native/src/lib/personalize-requirements.ts`            |
| Explore index/detail        | `apps/web/src/lib/explore/*`                  | `apps/native/src/data/explore-index.ts`, `explore-detail.ts` |
| Generation options UI model | `calendar/generationOptions/*`                | `schedule-settings-sheet.tsx`                                |

## God-file budget

Hand-written UI/domain modules should stay under **~350 LOC** unless documented.
Known hotspots to split: native `schedule-settings-sheet.tsx`, web `CalendarPage.tsx`,
`BasketContents.tsx`, `RequirementNode.tsx`, large explore tab screens.

## Guardrails

- `pnpm check:arch` — package layering, web store projection hooks, `@uoplan/app` purity, `@uoplan/store` purity, worker pdfjs purity, `cli.proto` drift.
- `pnpm check:fallow` — dead code + duplication (health/CRAP temporarily skipped).
- Projection hooks: components/routes/lib must not import raw `useAppStore` from the store factory; use `store/hooks`.

## Migration rules of thumb

1. Extract **pure domain** before UI.
2. Native adopts `@uoplan/store` before write-once screens that need planner state.
3. Delete re-export shims only after zero consumers.
4. Prefer many vertical PRs; keep main shippable.
5. Do not mix bulk data-compaction commits with TypeScript refactors.
