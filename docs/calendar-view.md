# Calendar View

The calendar view renders generated timetables as a time-grid week layout. It is a custom React component (no third-party calendar library).

## What it is

A single-week time grid that displays course events as positioned blocks. Events are clickable to open a swap modal. The calendar supports an optional weekend view and a fade animation when switching between schedules.

## How it works

### Component hierarchy

```
CalendarView (apps/web/src/components/calendar/CalendarView.tsx)
  └── WeekCalendar (apps/web/src/components/calendar/WeekCalendar/index.tsx)
        └── WeekCalendarEvent (…/WeekCalendar/WeekCalendarEvent.tsx)
              └── CalendarEventFace (…/calendar/CalendarEventFace.tsx)
              └── GradeDistributionBottomBar (…/calendar/GradeDistributionViz.tsx)
```

### Data flow

1. `useCalendarEvents(schedule, professorRatings)` transforms a `GeneratedSchedule` into `CalendarEvent[]`. Each event has `day: DayOfWeekCode`, `startMinutes`, and `endMinutes` — no `Date` objects.
2. `WeekCalendar` groups events by `day` and passes each day's events through `assignLanes()` in `weekCalendarLayout.ts` to handle side-by-side rendering of overlapping events.
3. Each `WeekCalendarEvent` is absolutely positioned within its column using `minutesToPercent()` to convert minute offsets to CSS percentages.

### Time grid geometry

Defined in `weekCalendarLayout.ts`:

- Visible range: `08:00` (`480 min`) to `23:00` (`1380 min`), a span of `900 min`
- `minutesToPercent(m)` = `(m - 480) / 900 * 100` — the vertical `%` position within a column

### Lane assignment (overlapping events)

`assignLanes(events)` in `weekCalendarLayout.ts` runs a greedy sweep over events sorted by `startMinutes`. It places each event in the first "lane" (sub-column) whose last occupant has already ended. After placement, a second pass ensures all events in the same overlapping cluster share the same `laneCount` so they all render at equal width.

### Schedule transition animation

`useScheduleTransition(schedule, prefersReduced)` in `apps/web/src/hooks/useScheduleTransition.ts` manages a three-phase CSS animation:

1. `captureAndPark()` is called externally (via `CalendarViewHandle` ref) before the schedule changes — sets phase to `"exiting"`.
2. When `schedule` changes, a 160 ms timeout fires: phase switches to `"entering"`, then `"idle"` after another 160 ms.
3. The `WeekCalendar` root element receives `data-phase` which CSS selectors use to animate `.uoplan-cal-event` blocks (fade-out-down / fade-in-up).

## How to change it

- **Time range**: Adjust `CAL_START_MINUTES` / `CAL_END_MINUTES` in `weekCalendarLayout.ts`.
- **Animation timing**: Change `TRANSITION_MS` in `useScheduleTransition.ts` and the matching `160ms` durations in `weekCalendar.css`.
- **Event appearance**: Edit `WeekCalendarEvent.tsx`. The inner layout is delegated to `CalendarEventFace.tsx` which is also used by the swap modal.
- **Column headers or day ordering**: Edit `DAY_LABELS` / `WEEKDAY_CODES` / `WEEKEND_CODES` in `weekCalendarLayout.ts`.
- **Swap modal**: `useSwapModal` hook + `SwapModalContent.tsx` — these are unrelated to the calendar grid.

## Configuration

No env vars or flags. Weekend columns appear automatically when any event has `day === "Sa"` or `day === "Su"`, unless `isCompactCalendar` (≤1200px) and there are no weekend events.

## Dependencies

- `CalendarEventFace.tsx` — shared with swap modal preview cards
- `GradeDistributionViz.tsx` — grade bar at the bottom of each event
- `calendarEventDisplayUtils.ts` — `formatTimeRange`, `componentKindOnly`
- `schedule` package — `DayOfWeekCode`, color utils, rating utils, `GradeVizData`
