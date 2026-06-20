import { Stack, Text } from "@mantine/core";
import type { DayOfWeek } from "@uoplan/core";
import { tr } from "../../../i18n";
import classes from "./DayAvoidToggles.module.css";

interface DayConfig {
  value: DayOfWeek;
  fullLabelId: string;
  shortLabelId: string;
}

const DAYS: DayConfig[] = [
  { value: "Mo", fullLabelId: "scheduleCount.day.monday", shortLabelId: "gen.day.mon" },
  { value: "Tu", fullLabelId: "scheduleCount.day.tuesday", shortLabelId: "gen.day.tue" },
  { value: "We", fullLabelId: "scheduleCount.day.wednesday", shortLabelId: "gen.day.wed" },
  { value: "Th", fullLabelId: "scheduleCount.day.thursday", shortLabelId: "gen.day.thu" },
  { value: "Fr", fullLabelId: "scheduleCount.day.friday", shortLabelId: "gen.day.fri" },
  { value: "Sa", fullLabelId: "scheduleCount.day.saturday", shortLabelId: "gen.day.sat" },
  { value: "Su", fullLabelId: "scheduleCount.day.sunday", shortLabelId: "gen.day.sun" },
];

export interface DayAvoidTogglesProps {
  avoidedDays: DayOfWeek[];
  onAvoidedDaysChange: (days: DayOfWeek[]) => void;
}

/** Seven per-day toggles replacing the avoided-days multi-select. A pressed toggle means
 * "avoid this day" (no classes scheduled on it). */
export function DayAvoidToggles({ avoidedDays, onAvoidedDaysChange }: DayAvoidTogglesProps) {
  const avoided = new Set(avoidedDays);

  const toggle = (day: DayOfWeek) => {
    const next = new Set(avoided);
    if (next.has(day)) next.delete(day);
    else next.add(day);
    onAvoidedDaysChange(DAYS.filter((d) => next.has(d.value)).map((d) => d.value));
  };

  return (
    <Stack gap={6}>
      <Text size="sm" fw={500}>
        {tr("scheduleCount.avoidDays.label")}
      </Text>
      <div
        className={classes.row}
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- semantic grouping wrapper for the day toggle buttons; not a fieldset
        role="group"
        aria-label={tr("scheduleCount.avoidDays.label")}
      >
        {DAYS.map((day) => {
          const isAvoided = avoided.has(day.value);
          return (
            <button
              key={day.value}
              type="button"
              className={classes.toggle}
              data-active={isAvoided || undefined}
              aria-pressed={isAvoided}
              aria-label={tr(day.fullLabelId)}
              title={tr(day.fullLabelId)}
              onClick={() => toggle(day.value)}
            >
              {tr(day.shortLabelId)}
            </button>
          );
        })}
      </div>
      <Text size="xs" c="dimmed">
        {tr("scheduleCount.avoidDays.description")}
      </Text>
    </Stack>
  );
}
