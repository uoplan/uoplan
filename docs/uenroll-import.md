# uEnroll Import

## What it is

A button on the calendar page that lets users paste a uenroll.ca schedule URL and immediately load those courses and sections into the uoplan calendar.

## How it works

uenroll.ca serializes selections into a URL like:

```
https://uenroll.ca/?term=2265&data=eyJDU0kyMTAxIjpbIlowMSIsIlowMCJdfQ==
```

The `data` parameter is `encodeURIComponent(btoa(JSON.stringify(payload)))` where `payload` is:

```json
{ "CSI2101": ["Z01", "Z00"] }
```

Keys are course codes without a space; values are arrays of section codes (matching `ComponentSection.sectionCode`).

**Import flow:**

1. User clicks the import icon (`IconFileImport`) in the calendar toolbar — available on both the basic and advanced planner paths.
2. A modal opens with a text input. The user pastes the full URL or the bare `data` value.
3. `importFromUEnroll` (`apps/web/src/lib/importFromUEnroll.ts`) decodes the payload, normalizes course codes via `normalizeCourseCode`, looks up each course via `cache.getSchedule()`, and maps section codes to the matching `ComponentSection` across all components.
4. A `GeneratedSchedule` is built using `getEnrollmentsForCourse` from each matched `SectionCombo`.
5. The modal shows a live preview: recognized courses in a teal alert, any unrecognized courses/sections in a yellow warning, and a red error if nothing could be parsed at all.
6. Clicking **Import schedule** calls `importSchedule` on the store, which sets `currentSchedule` directly (no generation), assigns sequential color indices, and clears any previous swaps.

## How to change it

- **Import logic**: `apps/web/src/lib/importFromUEnroll.ts` — `importFromUEnroll(input, cache)` returns `{ schedule, warnings }` or throws.
- **Modal UI**: `apps/web/src/components/calendar/UEnrollImportModal.tsx`
- **Store action**: `importSchedule` in `apps/web/src/store/slices/schedules.ts`
- **Button placement**: added to `CalendarPage.tsx` (advanced planner toolbar) and `BasicCalendarHeaderActions.tsx` (basic planner toolbar)

## Configuration

No env vars or feature flags. The button appears whenever the calendar page is rendered; it works regardless of whether a schedule has already been generated.

## Dependencies

- `normalizeCourseCode` — `packages/schedule/src/utils/courseUtils.ts`
- `getEnrollmentsForCourse` — `packages/schedule/src/generation/sectionCombos.ts`
- `DataCache.getSchedule` — `packages/schedule/src/dataCache.ts`
- Mantine `Modal`, `TextInput`, `Alert`, `List`, `Button`
