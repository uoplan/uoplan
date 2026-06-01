# Store Architecture

## What it is

The application uses Zustand for state management, combined with the slice pattern to break down a very large monolithic store into manageable pieces. The `appStore.ts` acts as the root orchestrator, merging all slices together.

## How it works

The store is defined by `AppState` and `AppActions` in `src/store/types.ts`.
It is divided into multiple slices under `src/store/slices/`:

- **`data.ts`**: Handles fetching, caching, and storing catalogues, schedules, indices, terms, and professor ratings.
- **`selection.ts`**: Manages user selections such as the chosen program, completed courses, and selected options for requirements. Also handles filtering logic via recomputations.
- **`constraints.ts`**: Maintains user preferences for schedule generation (allowed days, start/end times, limit first year credits, minimum professor ratings, closed components, etc.).
- **`schedules.ts`**: Manages current schedule generation, seed navigation, schedule pool/color mapping, and swap history.
- **`url.ts`**: Handles encoding and decoding the application state to and from base64 URLs or localStorage.

`appStore.ts` merges these slices together and provides common reset actions across all slices. Pure business logic is intentionally kept outside of slices (e.g. `src/store/requirementCompute/` or `src/lib/generateSchedulesAction.ts`) and is only called by the slices.

## How to change it

1. Update `AppState` or `AppActions` in `src/store/types.ts` to add the new state/action definitions.
2. Find the relevant slice in `src/store/slices/` (e.g. `selection.ts` if it relates to a user's chosen courses) and add the state defaults and action implementation there.
3. Update `src/store/appStore.ts` with the default state values.
4. If the new state needs to be serialized to the URL or localStorage, update the encoding logic in `packages/core/src/stateEncode.ts` and the store hydration/share logic in `src/store/slices/url.ts`.

## Configuration

The only constant is `LOCAL_STORAGE_KEY` which defines where the app persists its state in the browser.

## Dependencies

- `zustand` — the state management library.
- Domain logic in `src/lib/` such as `generateSchedulesAction.ts`, plus shared core logic in `packages/core/src/` such as `dataCache.ts` and `stateEncode.ts`.
