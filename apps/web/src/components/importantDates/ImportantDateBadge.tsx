import type { CalendarEntry } from "../../lib/importantDatesCalendar";
import { i18n, tr, useTr } from "../../i18n";
import classes from "./ImportantDatesPage.module.css";

export interface ImportantDateBadgeProps {
  entry: CalendarEntry;
  selected: boolean;
  onActivate: (viaKeyboard: boolean) => void;
}

function activeLocale(): string {
  return i18n.locale && i18n.locale.length > 0 ? i18n.locale : "en";
}

/** ISO date -> UTC-anchored `Date`, independent of host timezone. */
function toUtcDate(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day!));
}

function formatTile(date: string, locale: string) {
  return {
    month: new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }).format(
      toUtcDate(date),
    ),
    day: new Intl.DateTimeFormat(locale, { day: "numeric", timeZone: "UTC" }).format(
      toUtcDate(date),
    ),
  };
}

function formatFullDate(date: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(toUtcDate(date));
}

/**
 * A compact button badge for a dated table row: a single calendar-like tile
 * for one-day events, or two tiles connected by a bar for inclusive ranges.
 * Activating it (click or keyboard) hands the entry back to the caller, which
 * is responsible for switching the calendar month and selecting the event.
 */
export function ImportantDateBadge({ entry, selected, onActivate }: ImportantDateBadgeProps) {
  useTr();
  const locale = activeLocale();
  const isRange = entry.startDate !== entry.endDate;
  const start = formatTile(entry.startDate, locale);
  const end = isRange ? formatTile(entry.endDate, locale) : null;

  const accessibleLabel = isRange
    ? tr("importantDates.badge.dateRange", {
        topic: entry.topic,
        start: formatFullDate(entry.startDate, locale),
        end: formatFullDate(entry.endDate, locale),
      })
    : tr("importantDates.badge.singleDate", {
        topic: entry.topic,
        date: formatFullDate(entry.startDate, locale),
      });

  return (
    <button
      type="button"
      data-role="date-badge"
      className={[classes.badge, isRange ? classes.badgeRange : classes.badgeSingle].join(" ")}
      data-variant={entry.variant}
      aria-label={accessibleLabel}
      aria-pressed={selected}
      onClick={(e) => onActivate(e.detail === 0)}
    >
      <span className={classes.badgeTile}>
        <span className={classes.badgeMonth}>{start.month}</span>
        <span className={classes.badgeDay}>{start.day}</span>
      </span>
      {isRange && end ? (
        <>
          <span className={classes.badgeConnector} aria-hidden="true" />
          <span className={classes.badgeTile}>
            <span className={classes.badgeMonth}>{end.month}</span>
            <span className={classes.badgeDay}>{end.day}</span>
          </span>
        </>
      ) : null}
    </button>
  );
}
