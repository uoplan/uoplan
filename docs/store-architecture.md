# Store Architecture

## What it is

The application uses Zustand for state management, combined with the slice pattern
to break down a large store into manageable pieces. The **canonical implementation**
lives in **`packages/store`** (`@uoplan/store`). Web and (eventually) native mount
it via platform `AppServices` adapters.

```
packages/store/src/
  appStore.ts              # createAppStore(services) factory + React hooks
  AppStoreProvider.tsx
  services.ts              # AppServices seam (nav, persistence, data, engine, …)
  types.ts                 # AppState / AppActions
  slices/                  # data, selection, constraints, schedules, url, compare
  hooks/                   # projection hooks (useSeedNavigation, useDataset, …)
  requirementCompute/      # pure requirement recomputation
  scheduleHelpers.ts
  …
```

Web-only glue (not the planner core):

```
apps/web/src/store/
  webServices.ts           # browser AppServices implementation
  appStore.ts              # thin factory wiring + defaultAppStore registry
  graphPlannerStore.ts     # degree-planner overlay (web-only)
  commandCenterStore.ts
  uiHelpStore.ts
  hooks/                   # re-exports of @uoplan/store/hooks (transition shims)
  slices/                  # re-exports (transition shims; to be deleted)
```

See [modularization.md](./modularization.md) for the package graph and shim-removal plan.

## How it works

`AppState` and `AppActions` are defined in `packages/store/src/types.ts`.
Slices under `packages/store/src/slices/`:

- **`data.ts`**: Fetching/caching catalogues, schedules, indices, terms, professor ratings.
- **`selection.ts`**: Program, completed courses, requirement options; recomputations.
- **`constraints.ts`**: Generation preferences (days, times, first-year cap, ratings, …).
- **`schedules.ts`**: Generation results, seed navigation, pool/color maps, swap history.
- **`url.ts`**: Encode/decode state to base64 URLs or local persistence.
- **`compare.ts`**: Compare tray selections.

`createAppStore(services)` merges slices and injects platform services so slices stay
framework-agnostic (no direct router or `localStorage` imports).

Pure business logic stays outside slices where possible
(`requirementCompute/`, generation input builders, `@uoplan/core` helpers) and is
called by slices or by the schedule runner service.

### Lazy data loading

Protobuf assets load on demand:

- **Core boot** (`data.ts` → `loadData`) loads essentials for data-gated routes:
  catalogue manifest, latest catalogue, `terms.pb`, `indices.pb`, the initial term's
  `schedules.pb`, and `DataCache`. Restores shared (`?s=`) / persisted state.
  `loadData` is **idempotent** and is triggered by `AppDataRouteGate`, not from the
  landing page.
- **Secondary assets** via `ensureX` actions: grades, professor ratings, disciplines,
  year catalogues, feedback. Routes declare needs via `AppDataRouteGate`'s `requires`.
- The schedule worker / WASM engine builds its own dataset via `@uoplan/data`'s
  `createDataClient`.

## Consuming the store: projection hooks

Components, routes, and `lib/` code **must not** call `useAppStore` /
`useAppStoreApi` directly. They consume domain **projection hooks** from
`@uoplan/store/hooks` (web may still import via `apps/web/src/store/hooks` shims).

Each hook groups related reads behind `useShallow` and bundles stable actions.

```ts
// ❌ coupled to raw field names
const currentSeed = useAppStore((s) => s.currentSeed);
const goToNextSeed = useAppStore((s) => s.goToNextSeed);

// ✅ domain hook
const { currentSeed, goToNextSeed, goToPreviousSeed, randomizeSeed } = useSeedNavigation();
```

Hooks map onto domains: `useDataset` / `useDataCache` / `useLazyData`,
`useTermSelection` / `useProgramSelection` / `useCompletedCourses`,
`useRequirementState` / `useRequirementActions`, `useGenerationConstraints`,
`useScheduleGeneration` / `useSeedNavigation` / `useScheduleSwaps` /
`useScheduleResultMaps`, `useCalendarView`, `useShareState`, `useSaveStatus`,
`useGlobalActions`. Imperative access goes through `useStoreApi()`.

**Sanctioned direct consumers** of the raw store hooks are limited to
`packages/store/src/hooks/**` and cross-cutting app hooks (e.g. web
`apps/web/src/hooks/**`). Enforced by `scripts/check-architecture.ts`
(`pnpm check:arch`).

## How to change it

1. Update `AppState` / `AppActions` in `packages/store/src/types.ts`.
2. Implement in the relevant slice under `packages/store/src/slices/`.
3. Update defaults in `packages/store/src/appStore.ts` if needed.
4. Expose via a projection hook in `packages/store/src/hooks/`.
5. If the field is serialized, update `packages/core/src/stateEncode.ts` and
   `packages/store/src/slices/url.ts`.
6. Wire platform behavior only through `AppServices` (`packages/store/src/services.ts`),
   never by importing app routers into slices.

## Configuration

`LOCAL_STORAGE_KEY` (web) defines where the browser persists encoded state.
Native will use its own `PersistenceService` implementation against the same codec.

## Dependencies

- `zustand` — state management.
- `@uoplan/core`, `@uoplan/data`, `@uoplan/proto` — domain + loaders.
- Platform shells provide `AppServices` (web: `apps/web/src/store/webServices.ts`).
