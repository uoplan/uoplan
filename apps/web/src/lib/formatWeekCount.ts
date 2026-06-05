import { tr } from "../i18n";
import type { WeekGroup } from "../hooks/useScheduleWeeks";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_WEEK = 7 * MS_PER_DAY;

/**
 * Returns a human-readable week count for a WeekGroup.
 *
 * endDate is always the Sunday of the last calendar week (startDate + 6 days per week),
 * so the inclusive day span is (end - start + 1). Dividing by 7 gives the correct count.
 */
export function formatWeekCount(group: WeekGroup): string {
  const start = new Date(`${group.startDate}T00:00:00Z`);
  const end = new Date(`${group.endDate}T00:00:00Z`);
  const weeks = Math.round((end.getTime() - start.getTime() + MS_PER_DAY) / MS_PER_WEEK);
  return tr("calendarPage.weekCount", { weeks });
}

/**
 * Active-week label shown in the week header (desktop) and mobile week nav bar:
 * "Week X of Y · N weeks" when multiple groups exist, otherwise just the week count.
 */
export function formatWeekLabel(weekGroups: WeekGroup[], weekIndex: number): string {
  const group = weekGroups[weekIndex];
  if (!group) return "";
  if (weekGroups.length > 1) {
    const ordinal = tr("calendarPage.weekOf", {
      current: weekIndex + 1,
      total: weekGroups.length,
    });
    return `${ordinal} · ${formatWeekCount(group)}`;
  }
  return formatWeekCount(group);
}
