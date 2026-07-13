import { Fragment, useId, useState } from "react";
import type { CalendarEntry, CalendarMonth, ResolvedMonth } from "../../lib/importantDatesCalendar";
import { formatMonthLabel, formatWeekdayLabels } from "../../lib/importantDatesCalendar";
import { i18n, tr, useTr } from "../../i18n";
import gridClasses from "./ImportantDatesCalendar.module.css";

export interface ImportantDatesCalendarProps {
  month: ResolvedMonth;
  calendar: CalendarMonth;
  today: string;
  selectedItemId: string | null;
  onNavigate: (direction: "prev" | "next" | "today") => void;
  onSelectEntry: (entry: CalendarEntry, viaKeyboard: boolean) => void;
}

const LEGEND_VARIANTS = ["break", "schedule-change", "deadline", "information"] as const;

/** Legend labels resolved via literal `tr()` calls (not a lookup) so the
 * static i18n-id scanner (`pnpm i18n:sync`) can find every id used here. */
function legendLabel(variant: (typeof LEGEND_VARIANTS)[number]) {
  switch (variant) {
    case "break":
      return tr("importantDates.calendar.legend.break");
    case "schedule-change":
      return tr("importantDates.calendar.legend.scheduleChange");
    case "deadline":
      return tr("importantDates.calendar.legend.deadline");
    case "information":
      return tr("importantDates.calendar.legend.information");
  }
}

function activeLocale(): string {
  return i18n.locale && i18n.locale.length > 0 ? i18n.locale : "en";
}

/**
 * For each item that appears in the grid, the single position that should
 * carry the stable `importantdates-calendar-event-${itemId}` DOM id — used
 * as the sole activation/focus/highlight target for badge↔calendar linking.
 * Multi-week ranges render one segment per week (same itemId, same visible
 * lane), so without this the id would be duplicated across segments.
 */
interface PrimaryPositions {
  /** "week-lane-cell" key of the earliest visible-lane segment, by itemId. */
  lane: Map<string, string>;
  /**
   * "week-day" key of the earliest in-grid hidden-day occurrence, by itemId
   * — only populated for entries that never appear in a visible lane
   * anywhere in the month (fully overflow-only entries).
   */
  hidden: Map<string, string>;
}

function computePrimaryPositions(calendar: CalendarMonth): PrimaryPositions {
  const lane = new Map<string, string>();
  for (const [weekIndex, week] of calendar.weeks.entries()) {
    for (const [laneIndex, laneRow] of week.laneRows.entries()) {
      for (const [cellIndex, cell] of laneRow.entries()) {
        // Don't rely solely on `isRangeStart`: a range clipped at the
        // grid's leading edge (e.g. starting before the visible month)
        // still needs a primary target, so the earliest *rendered*
        // segment wins regardless of whether it's the entry's true start.
        if (cell.kind === "segment" && !lane.has(cell.entry.itemId)) {
          lane.set(cell.entry.itemId, `${weekIndex}-${laneIndex}-${cellIndex}`);
        }
      }
    }
  }

  const hidden = new Map<string, string>();
  for (const [weekIndex, week] of calendar.weeks.entries()) {
    for (const [dayIndex, day] of week.days.entries()) {
      for (const entry of day.hiddenEntries) {
        if (!lane.has(entry.itemId) && !hidden.has(entry.itemId)) {
          hidden.set(entry.itemId, `${weekIndex}-${dayIndex}`);
        }
      }
    }
  }

  return { lane, hidden };
}

/** A single day's "+N more" overflow control: a toggle button plus a small list. */
function DayOverflow({
  date,
  hiddenEntries,
  selectedItemId,
  isPrimaryEntry,
  onSelectEntry,
}: {
  date: string;
  hiddenEntries: CalendarEntry[];
  selectedItemId: string | null;
  isPrimaryEntry: (entry: CalendarEntry) => boolean;
  onSelectEntry: (entry: CalendarEntry, viaKeyboard: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const listId = useId();

  if (hiddenEntries.length === 0) return null;

  // If the current selection is one of this day's hidden entries, force the
  // list open so a stable, focusable/highlightable node exists for it —
  // otherwise badge/calendar-event activation on an overflow-hidden item
  // would have nothing to select or focus. Other days are unaffected since
  // each `DayOverflow` only inspects its own `hiddenEntries`.
  const isSelectedHidden = hiddenEntries.some((entry) => entry.itemId === selectedItemId);
  const isOpen = open || isSelectedHidden;

  return (
    <div className={gridClasses.overflowWrapper}>
      <button
        type="button"
        className={gridClasses.overflowButton}
        aria-expanded={isOpen}
        aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
      >
        {tr("importantDates.calendar.overflowMore", { count: hiddenEntries.length })}
      </button>
      {isOpen ? (
        <ul
          id={listId}
          className={gridClasses.overflowList}
          aria-label={tr("importantDates.calendar.overflowListLabel", { date })}
        >
          {hiddenEntries.map((entry) => (
            <li key={entry.itemId}>
              <button
                type="button"
                id={
                  isPrimaryEntry(entry)
                    ? `importantdates-calendar-event-${entry.itemId}`
                    : undefined
                }
                aria-pressed={selectedItemId === entry.itemId}
                onClick={(e) => onSelectEntry(entry, e.detail === 0)}
              >
                {entry.topic}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * The full-width monthly Important Dates calendar: prev/next/today
 * navigation, a 4-item semantic-color legend, and a Monday-first month grid
 * with continuous multi-day event bars (rendered via native `colSpan`) capped
 * at 3 visible lanes per day plus a keyboard-operable "+N more" overflow
 * control. Pure presentation — all layout math lives in
 * `lib/importantDatesCalendar.ts`.
 */
export function ImportantDatesCalendar({
  month,
  calendar,
  today,
  selectedItemId,
  onNavigate,
  onSelectEntry,
}: ImportantDatesCalendarProps) {
  useTr();
  const locale = activeLocale();
  const monthLabel = formatMonthLabel(month, locale);
  const weekdayLabels = formatWeekdayLabels(locale);
  const primary = computePrimaryPositions(calendar);

  return (
    <section
      className={gridClasses.calendar}
      aria-label={tr("importantDates.calendar.gridLabel", { month: monthLabel })}
    >
      <div className={gridClasses.header}>
        <button
          type="button"
          className={gridClasses.navButton}
          aria-label={tr("importantDates.calendar.previousMonth")}
          onClick={() => onNavigate("prev")}
        >
          ‹
        </button>
        <span className={gridClasses.monthLabel}>{monthLabel}</span>
        <button
          type="button"
          className={gridClasses.navButton}
          aria-label={tr("importantDates.calendar.nextMonth")}
          onClick={() => onNavigate("next")}
        >
          ›
        </button>
        <button
          type="button"
          className={gridClasses.todayButton}
          onClick={() => onNavigate("today")}
        >
          {tr("importantDates.calendar.today")}
        </button>
      </div>

      <ul className={gridClasses.legend} aria-label={tr("importantDates.calendar.legendLabel")}>
        {LEGEND_VARIANTS.map((variant) => (
          <li key={variant} className={gridClasses.legendItem}>
            <span className={gridClasses.legendDot} data-variant={variant} aria-hidden="true" />
            {legendLabel(variant)}
          </li>
        ))}
      </ul>

      <table className={gridClasses.grid}>
        <thead>
          <tr>
            {weekdayLabels.map((label, i) => (
              // Weekday labels from `formatWeekdayLabels` are locale-formatted
              // text, not stable keys, so the array index is the correct key.
              // oxlint-disable-next-line react/no-array-index-key
              <th key={i} scope="col">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {calendar.weeks.map((week, weekIndex) => {
            const hasOverflow = week.days.some((d) => d.hiddenEntries.length > 0);
            return (
              // oxlint-disable-next-line react/no-array-index-key
              <Fragment key={weekIndex}>
                <tr>
                  {week.days.map((day) => (
                    <td
                      key={day.date}
                      className={gridClasses.dayCell}
                      data-in-month={day.inCurrentMonth}
                    >
                      <span
                        className={gridClasses.dayNumber}
                        data-today={day.date === today}
                        aria-current={day.date === today ? "date" : undefined}
                      >
                        {day.dayOfMonth}
                      </span>
                    </td>
                  ))}
                </tr>
                {week.laneRows.map((laneRow, laneIndex) => (
                  // oxlint-disable-next-line react/no-array-index-key
                  <tr key={laneIndex}>
                    {laneRow.map((cell, cellIndex) =>
                      cell.kind === "empty" ? (
                        // oxlint-disable-next-line react/no-array-index-key
                        <td key={cellIndex} colSpan={cell.span} className={gridClasses.laneCell} />
                      ) : (
                        <td
                          // oxlint-disable-next-line react/no-array-index-key
                          key={cellIndex}
                          colSpan={cell.span}
                          className={gridClasses.laneCell}
                        >
                          <button
                            type="button"
                            id={
                              primary.lane.get(cell.entry.itemId) ===
                              `${weekIndex}-${laneIndex}-${cellIndex}`
                                ? `importantdates-calendar-event-${cell.entry.itemId}`
                                : undefined
                            }
                            className={gridClasses.eventButton}
                            data-variant={cell.entry.variant}
                            aria-pressed={selectedItemId === cell.entry.itemId}
                            aria-label={`${cell.entry.topic}, ${cell.entry.dateText}`}
                            onClick={(e) => onSelectEntry(cell.entry, e.detail === 0)}
                          >
                            {cell.entry.topic}
                          </button>
                        </td>
                      ),
                    )}
                  </tr>
                ))}
                {hasOverflow ? (
                  <tr>
                    {week.days.map((day, dayIndex) => (
                      <td key={day.date} className={gridClasses.overflowCell}>
                        <DayOverflow
                          date={day.date}
                          hiddenEntries={day.hiddenEntries}
                          selectedItemId={selectedItemId}
                          isPrimaryEntry={(entry) =>
                            primary.hidden.get(entry.itemId) === `${weekIndex}-${dayIndex}`
                          }
                          onSelectEntry={onSelectEntry}
                        />
                      </td>
                    ))}
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
