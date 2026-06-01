# Week Preview Panel

A narrow visual panel on the left edge of the desktop calendar layout that shows one mini-calendar card per unique week group, letting users glance at and navigate between different weekly patterns in a semester.

## How it works

Many schedules have courses that only meet for part of the term (they carry `meetingDates`). The week-grouping logic in `useScheduleWeeks.ts` identifies consecutive weeks with identical timetable fingerprints and groups them. On desktop, `CalendarView` renders `WeekPreviewPanel` — one card per returned group.

Each card shows a proportionally-positioned miniature of that week's time blocks:

- 5 columns (Mo–Fr), no grid lines or labels
- Each block is colored using the same `colorMap` as the main calendar (`COURSE_COLORS` / `COURSE_COLOR_HEX` from `@uoplan/core`)
- Time range is clamped to 8 am–10 pm
- The selected week has a strong outline; other cards respond to hover

Clicking a card calls `setWeekIndex`, which is owned by `CalendarPage` and passed through `CalendarView` to `WeekPreviewPanel` as props.

## How to change it

**Card size:** `CARD_W` and `CARD_H` constants in `WeekPreviewPanel.tsx`. Adjust `COL_W` (derived) accordingly.

**Time range:** `TIME_MIN` / `TIME_MAX` in `WeekPreviewPanel.tsx` (minutes from midnight).

**Show weekends:** extend `DAY_ORDER` with `Sa: 5, Su: 6` and update `NUM_DAYS`/`COL_W`.

**Show/hide panel by week count:** in `CalendarView.tsx`, add or adjust a `weekGroups.length` guard around `WeekPreviewPanel`. Currently the built-in guard is desktop-only (`!isMobile`).

**Week state source:** `useScheduleWeeks` is called in `CalendarPage`, which owns `weekGroups`, `weekIndex`, and `setWeekIndex`. These are passed to `CalendarView`, which passes them to `WeekPreviewPanel`. The selected index is also synced to the app store (`calendarWeekIndex`) for URL state encoding.

## Configuration

No env vars or feature flags. The panel is hidden on mobile (`!isMobile` in `CalendarView`).

## Dependencies

- `useScheduleWeeks` / `slotActiveInWeek` — `apps/web/src/hooks/useScheduleWeeks.ts`
- `COURSE_COLORS`, `COURSE_COLOR_HEX`, `hexToRgb` — `packages/core/src/utils/uiUtils.ts`
- `WeekGroup` type — `apps/web/src/hooks/useScheduleWeeks.ts`
- Mantine `useMediaQuery` (via `CalendarView`) for mobile detection
