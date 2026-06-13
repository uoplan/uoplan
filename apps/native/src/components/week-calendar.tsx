import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import type { CalendarEvent } from "@uoplan/calendar/types";
import {
  assignLanes,
  CAL_END_MINUTES,
  CAL_START_MINUTES,
  DAY_LABELS,
  WEEKDAY_CODES,
} from "@uoplan/calendar/layout";

import { Surface } from "@/constants/theme";

const TIME_AXIS_W = 42;
const HEIGHT_PER_HOUR = 40;
const DEFAULT_END_MINUTES = 18 * 60; // 18:00

/**
 * Deterministic course → colour palette (dark enough for white text). The same
 * code always maps to the same colour regardless of event order, mirroring the
 * web calendar's stable per-course colouring.
 */
const COURSE_PALETTE = [
  "#8c1d40", // garnet
  "#2d5fa3", // blue
  "#2f7d4f", // green
  "#a8591f", // rust
  "#5a3f8c", // purple
  "#2f6f6a", // teal
  "#9a2b6b", // magenta
  "#4a6320", // olive
];

function buildCourseColors(events: CalendarEvent[]): Map<string, string> {
  const codes = [...new Set(events.map((e) => e.courseCode))].sort();
  const map = new Map<string, string>();
  codes.forEach((code, i) => map.set(code, COURSE_PALETTE[i % COURSE_PALETTE.length]));
  return map;
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

export interface WeekCalendarProps {
  events: CalendarEvent[];
}

/**
 * Read-only native week timetable. Reuses the shared `@uoplan/calendar` layout
 * math (`assignLanes` for overlap lanes, `WEEKDAY_CODES`/`DAY_LABELS`) and
 * positions events as absolutely-placed RN Views — no SVG, so it needs no native
 * rebuild. The vertical window auto-fits the events (08:00 → latest class,
 * minimum 18:00) within the shared calendar bounds.
 */
export function WeekCalendar({ events }: WeekCalendarProps) {
  const colors = useMemo(() => buildCourseColors(events), [events]);

  const windowEnd = useMemo(() => {
    const latest = events.reduce((max, e) => Math.max(max, e.endMinutes), DEFAULT_END_MINUTES);
    const roundedUp = Math.ceil(latest / 60) * 60;
    return Math.min(CAL_END_MINUTES, Math.max(DEFAULT_END_MINUTES, roundedUp));
  }, [events]);

  const startHour = CAL_START_MINUTES / 60;
  const endHour = windowEnd / 60;
  const gridHeight = ((windowEnd - CAL_START_MINUTES) / 60) * HEIGHT_PER_HOUR;

  const hourLines = useMemo(
    () => Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i),
    [startHour, endHour],
  );

  const eventsByDay = useMemo(() => {
    return WEEKDAY_CODES.map((day) => assignLanes(events.filter((e) => e.day === day)));
  }, [events]);

  return (
    <View>
      {/* Day header row */}
      <View style={styles.headerRow}>
        <View style={{ width: TIME_AXIS_W }} />
        {WEEKDAY_CODES.map((day) => (
          <View key={day} style={styles.headerCell}>
            <Text style={styles.headerText}>{DAY_LABELS[day]}</Text>
          </View>
        ))}
      </View>

      {/* Grid body */}
      <View style={[styles.body, { height: gridHeight }]}>
        {/* Hour gridlines spanning full width */}
        {hourLines.map((h) => {
          const top = (h - startHour) * HEIGHT_PER_HOUR;
          return <View key={h} style={[styles.hourLine, { top }]} pointerEvents="none" />;
        })}

        {/* Time axis labels */}
        <View style={[styles.timeAxis, { width: TIME_AXIS_W }]}>
          {hourLines.slice(0, -1).map((h) => {
            const top = (h - startHour) * HEIGHT_PER_HOUR;
            return (
              <Text key={h} style={[styles.timeLabel, { top: top - 6 }]}>
                {String(h).padStart(2, "0")}:00
              </Text>
            );
          })}
        </View>

        {/* Day columns */}
        <View style={styles.columns}>
          {eventsByDay.map((dayEvents, dayIdx) => (
            <View key={WEEKDAY_CODES[dayIdx]} style={styles.column}>
              {dayEvents.map(({ event, laneIndex, laneCount }) => {
                const top = ((event.startMinutes - CAL_START_MINUTES) / 60) * HEIGHT_PER_HOUR;
                const height = ((event.endMinutes - event.startMinutes) / 60) * HEIGHT_PER_HOUR;
                const widthPct = 100 / laneCount;
                const leftPct = laneIndex * widthPct;
                const bg = colors.get(event.courseCode) ?? COURSE_PALETTE[0];
                return (
                  <View
                    key={event.id}
                    style={[
                      styles.event,
                      {
                        top,
                        height: Math.max(height - 2, 18),
                        left: `${leftPct}%`,
                        width: `${widthPct}%`,
                        backgroundColor: bg,
                      },
                    ]}
                  >
                    <Text style={styles.eventCode} numberOfLines={1}>
                      {event.courseCode}
                    </Text>
                    {height >= 34 && (
                      <Text style={styles.eventMeta} numberOfLines={1}>
                        {formatMinutes(event.startMinutes)}–{formatMinutes(event.endMinutes)}
                      </Text>
                    )}
                    {height >= 50 && (
                      <Text style={styles.eventMeta} numberOfLines={1}>
                        {event.componentSection}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    marginBottom: 6,
  },
  headerCell: {
    flex: 1,
    alignItems: "center",
  },
  headerText: {
    fontSize: 12,
    fontWeight: "600",
    color: Surface.dimmed,
  },
  body: {
    position: "relative",
    flexDirection: "row",
  },
  hourLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Surface.border,
  },
  timeAxis: {
    position: "relative",
  },
  timeLabel: {
    position: "absolute",
    right: 6,
    fontSize: 10,
    color: Surface.dimmed,
  },
  columns: {
    flex: 1,
    flexDirection: "row",
  },
  column: {
    flex: 1,
    position: "relative",
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: Surface.border,
  },
  event: {
    position: "absolute",
    borderRadius: 6,
    paddingHorizontal: 4,
    paddingVertical: 3,
    overflow: "hidden",
  },
  eventCode: {
    fontSize: 10.5,
    fontWeight: "700",
    letterSpacing: -0.3,
    color: "#ffffff",
  },
  eventMeta: {
    fontSize: 8.5,
    color: "rgba(255,255,255,0.9)",
  },
});
