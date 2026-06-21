import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import type { CalendarEvent } from "@uoplan/calendar/types";
import { assignLanes, DAY_LABELS, WEEKDAY_CODES } from "@uoplan/calendar/layout";
import { mergeBlockedWindows, type BlockedTimeWindow } from "@uoplan/core";
import { COURSE_COLOR_HEX, COURSE_COLORS } from "@uoplan/core/utils/uiUtils";

import { GradeVizBar } from "@/components/grade-viz-bar";
import { WeekCalendarBlockedLayer } from "@/components/week-calendar-blocked-layer";
import { ACTIVE_SCHEME, Fonts, Surface } from "@/constants/theme";
import { useAdaptiveLayout } from "@/lib/adaptive-layout";

const TIME_AXIS_W = 42;
const HEIGHT_PER_HOUR = 40;
// The native timetable shows a FIXED window (08:30 → 22:00) matching uOttawa's
// standard lecture blocks, so the grid never reflows as events change (the web
// calendar is likewise static). Events outside this window are rare and clip.
const WINDOW_START_MINUTES = 8 * 60 + 30; // 08:30
const WINDOW_END_MINUTES = 22 * 60; // 22:00
// Whole-hour gridlines that fall inside the window (09:00 … 22:00).
const HOUR_LINES = Array.from(
  { length: Math.floor(WINDOW_END_MINUTES / 60) - Math.ceil(WINDOW_START_MINUTES / 60) + 1 },
  (_, i) => Math.ceil(WINDOW_START_MINUTES / 60) + i,
);
// Day-header row (label + bottom margin) reserved above the grid.
const HEADER_BLOCK_PX = 28;
// Floor for a single hour row so events stay legible on tall windows.
const MIN_HOUR_PX = 34;

const pad2 = (n: number) => String(n).padStart(2, "0");
const formatAxisLabel = (minutes: number) =>
  `${pad2(Math.floor(minutes / 60))}:${pad2(minutes % 60)}`;

// Web parity (tokens.css): the event fill mixes the bright course colour with a
// base (dark → app bg @ 38%, light → white @ 60%) for a translucent card; the
// full course colour stays as the solid 4px left bar.
const EVENT_FILL = ACTIVE_SCHEME === "dark" ? 0.38 : 0.6;
const EVENT_MIX_BASE = ACTIVE_SCHEME === "dark" ? Surface.page : "#ffffff";

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    Number.parseInt(h.slice(0, 2), 16),
    Number.parseInt(h.slice(2, 4), 16),
    Number.parseInt(h.slice(4, 6), 16),
  ];
}

/** Mix `hex` (weight `ratio`) over `base` — the RN analogue of CSS color-mix. */
function mixHex(hex: string, base: string, ratio: number): string {
  const [r1, g1, b1] = parseHex(hex);
  const [r2, g2, b2] = parseHex(base);
  const r = Math.round(r1 * ratio + r2 * (1 - ratio));
  const g = Math.round(g1 * ratio + g2 * (1 - ratio));
  const b = Math.round(b1 * ratio + b2 * (1 - ratio));
  return `rgb(${r}, ${g}, ${b})`;
}

interface EventColors {
  bar: string;
  fill: string;
}

/**
 * Deterministic course → colour. The same code always maps to the same web
 * calendar colour (`COURSE_COLOR_HEX`) regardless of event order; we precompute
 * both the solid left-bar colour and the translucent card fill.
 */
function buildCourseColors(events: CalendarEvent[]): Map<string, EventColors> {
  const codes = [...new Set(events.map((e) => e.courseCode))].sort();
  const map = new Map<string, EventColors>();
  codes.forEach((code, i) => {
    const bar = COURSE_COLOR_HEX[COURSE_COLORS[i % COURSE_COLORS.length]];
    map.set(code, { bar, fill: mixHex(bar, EVENT_MIX_BASE, EVENT_FILL) });
  });
  return map;
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

/** Component kind only ("LEC" from "LEC - MA00"), matching web `componentKindOnly`. */
function componentKind(componentSection: string): string {
  const i = componentSection.indexOf(" - ");
  return (i >= 0 ? componentSection.slice(0, i) : componentSection).trim();
}

function slotKey(event: CalendarEvent): string {
  return JSON.stringify([
    event.courseCode,
    event.componentSection,
    event.day,
    event.startMinutes,
    event.endMinutes,
  ]);
}

function mergeMeetingDates(
  a: CalendarEvent["meetingDates"],
  b: CalendarEvent["meetingDates"],
): CalendarEvent["meetingDates"] {
  if (a == null) {
    return b ?? null;
  }
  if (b == null) {
    return a;
  }
  return [a[0] < b[0] ? a[0] : b[0], a[1] > b[1] ? a[1] : b[1]];
}

export function dedupeWeeklySlots(events: CalendarEvent[]): CalendarEvent[] {
  const indices = new Map<string, number>();
  const deduped: CalendarEvent[] = [];

  events.forEach((event) => {
    const key = slotKey(event);
    const index = indices.get(key);
    if (index == null) {
      indices.set(key, deduped.length);
      deduped.push(event);
      return;
    }

    const current = deduped[index]!;
    deduped[index] = {
      ...current,
      meetingDates: mergeMeetingDates(current.meetingDates, event.meetingDates),
    };
  });

  return deduped;
}

export interface WeekCalendarProps {
  events: CalendarEvent[];
  /** Override the per-hour row height (defaults to 40); used to fill the screen. */
  heightPerHour?: number;
  /**
   * Total vertical space (header + grid) the calendar should fill. When set, the
   * per-hour height is derived so the *whole* event window fits exactly inside
   * this height — so the timetable never scrolls off the page behind the nav,
   * regardless of how late the latest class runs.
   */
  availableHeight?: number;
  /** Tapping an event invokes this with the event + its left-bar colour. */
  onEventPress?: (event: CalendarEvent, color: string) => void;
  /** Custom blocked windows edited by dragging on the schedule calendar. */
  blockedTimes?: BlockedTimeWindow[];
  /** Replace the full custom blocked-time list after create/move/resize. */
  onBlockedTimesChange?: (blockedTimes: BlockedTimeWindow[]) => void;
}

/**
 * Read-only native week timetable. Reuses the shared `@uoplan/calendar` layout
 * math (`assignLanes` for overlap lanes, `WEEKDAY_CODES`/`DAY_LABELS`) and
 * positions events as absolutely-placed RN Views — no SVG, so it needs no native
 * rebuild. The vertical window is a FIXED 08:30 → 22:00 (matching uOttawa's
 * standard lecture blocks) so the grid never reflows as events change; when
 * `availableHeight` is given the grid is sized to fill exactly that space.
 */
export function WeekCalendar({
  events,
  heightPerHour,
  availableHeight,
  onEventPress,
  blockedTimes = [],
  onBlockedTimesChange,
}: WeekCalendarProps) {
  const { isTablet, contentMaxWidth } = useAdaptiveLayout();
  const colors = useMemo(() => buildCourseColors(events), [events]);

  const windowEnd = WINDOW_END_MINUTES;
  const startHour = WINDOW_START_MINUTES / 60;
  const endHour = WINDOW_END_MINUTES / 60;

  const hourPx = useMemo(() => {
    if (availableHeight != null) {
      const numHours = endHour - startHour;
      return Math.max(MIN_HOUR_PX, Math.floor((availableHeight - HEADER_BLOCK_PX) / numHours));
    }
    return heightPerHour ?? HEIGHT_PER_HOUR;
  }, [availableHeight, endHour, startHour, heightPerHour]);

  const gridHeight = ((WINDOW_END_MINUTES - WINDOW_START_MINUTES) / 60) * hourPx;

  const dedupedEvents = useMemo(() => dedupeWeeklySlots(events), [events]);

  const eventsByDay = useMemo(() => {
    return WEEKDAY_CODES.map((day) => assignLanes(dedupedEvents.filter((e) => e.day === day)));
  }, [dedupedEvents]);

  const blocksByDay = useMemo(
    () =>
      WEEKDAY_CODES.map((day) =>
        blockedTimes
          .map((block, index) => ({ block, index }))
          .filter(({ block }) => block.day === day),
      ),
    [blockedTimes],
  );

  const gestureLayout = useMemo(
    () => ({ startMinutes: WINDOW_START_MINUTES, endMinutes: windowEnd, heightPx: gridHeight }),
    [gridHeight, windowEnd],
  );

  const updateBlockedTimes = (next: BlockedTimeWindow[]) => {
    onBlockedTimesChange?.(mergeBlockedWindows(next));
  };

  const createBlockedTime = (block: BlockedTimeWindow) => {
    updateBlockedTimes([...blockedTimes, block]);
  };

  const updateBlockedTime = (index: number, block: BlockedTimeWindow) => {
    updateBlockedTimes(blockedTimes.map((current, i) => (i === index ? block : current)));
  };

  return (
    <GestureHandlerRootView
      style={
        isTablet
          ? [styles.gestureRoot, styles.tabletRoot, { maxWidth: contentMaxWidth }]
          : styles.gestureRoot
      }
    >
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
        {HOUR_LINES.map((h) => {
          const top = (h - startHour) * hourPx;
          return <View key={h} style={[styles.hourLine, { top }]} pointerEvents="none" />;
        })}

        {/* Time axis labels — the fixed 08:30 start plus each whole hour (the
            22:00 bottom line is omitted so it doesn't clip at the grid edge). */}
        <View style={[styles.timeAxis, { width: TIME_AXIS_W }]}>
          <Text style={[styles.timeLabel, { top: -6 }]}>
            {formatAxisLabel(WINDOW_START_MINUTES)}
          </Text>
          {HOUR_LINES.slice(0, -1).map((h) => {
            const top = (h - startHour) * hourPx;
            return (
              <Text key={h} style={[styles.timeLabel, { top: top - 6 }]}>
                {formatAxisLabel(h * 60)}
              </Text>
            );
          })}
        </View>

        {/* Day columns */}
        <View style={styles.columns}>
          {eventsByDay.map((dayEvents, dayIdx) => (
            <View key={WEEKDAY_CODES[dayIdx]} style={styles.column}>
              <WeekCalendarBlockedLayer
                day={WEEKDAY_CODES[dayIdx]!}
                blocks={blocksByDay[dayIdx] ?? []}
                layout={gestureLayout}
                editable={Boolean(onBlockedTimesChange)}
                onCreate={createBlockedTime}
                onUpdate={updateBlockedTime}
              />
              {dayEvents.map(({ event, laneIndex, laneCount }) => {
                const top = ((event.startMinutes - WINDOW_START_MINUTES) / 60) * hourPx;
                const height = ((event.endMinutes - event.startMinutes) / 60) * hourPx;
                const widthPct = 100 / laneCount;
                const leftPct = laneIndex * widthPct;
                const c = colors.get(event.courseCode);
                const bar = c?.bar ?? COURSE_COLOR_HEX[COURSE_COLORS[0]];
                const fill = c?.fill ?? bar;
                const boxHeight = Math.max(height - 2, 18);
                const showTime = boxHeight >= 30;
                const profName = event.predictedInstructors?.[0]?.name ?? event.professor;
                const showProf = boxHeight >= 54 && profName.trim() !== "";
                const showGrade = boxHeight >= 40 && (event.gradeViz?.total ?? 0) > 0;
                const inlineValue = event.courseSentiment ?? event.professorRatingValue ?? null;
                const valueText =
                  inlineValue != null && inlineValue > 0 ? inlineValue.toFixed(1) : null;
                return (
                  <Pressable
                    key={event.id}
                    disabled={!onEventPress}
                    onPress={() => onEventPress?.(event, bar)}
                    style={({ pressed }) => [
                      styles.event,
                      {
                        top,
                        height: boxHeight,
                        left: `${leftPct}%`,
                        width: `${widthPct}%`,
                        backgroundColor: fill,
                        borderLeftColor: bar,
                        opacity: pressed ? 0.7 : 1,
                        zIndex: 3,
                      },
                    ]}
                  >
                    <View style={styles.eventContent}>
                      <Text style={styles.eventCode} numberOfLines={1}>
                        {event.courseCode}
                      </Text>
                      {showTime && (
                        <Text style={styles.eventMeta} numberOfLines={1}>
                          <Text style={styles.eventType}>
                            {componentKind(event.componentSection)}
                          </Text>
                          {" · "}
                          {formatMinutes(event.startMinutes)}–{formatMinutes(event.endMinutes)}
                        </Text>
                      )}
                      {showProf && (
                        <Text style={styles.eventProf} numberOfLines={1}>
                          {profName}
                          {valueText ? ` · ${valueText}` : ""}
                        </Text>
                      )}
                    </View>
                    {showGrade && (
                      <View style={styles.eventGrade}>
                        <GradeVizBar gradeViz={event.gradeViz} height={4} flush />
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  gestureRoot: {
    width: "100%",
  },
  headerRow: {
    flexDirection: "row",
    marginBottom: 6,
  },
  tabletRoot: {
    width: "100%",
    alignSelf: "center",
  },
  headerCell: {
    flex: 1,
    alignItems: "center",
  },
  headerText: {
    fontFamily: Fonts.monoMedium,
    fontSize: 12,
    fontWeight: "600",
    color: Surface.label,
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
    fontFamily: Fonts.mono,
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
    borderLeftWidth: 4,
    overflow: "hidden",
  },
  eventContent: {
    flex: 1,
    paddingTop: 3,
    paddingBottom: 2,
    paddingHorizontal: 5,
    gap: 1,
  },
  eventCode: {
    fontFamily: Fonts.monoMedium,
    fontSize: 10.5,
    fontWeight: "700",
    letterSpacing: -0.3,
    color: Surface.onEvent,
  },
  eventMeta: {
    fontFamily: Fonts.mono,
    fontSize: 8.5,
    color: Surface.onEvent,
    opacity: 0.82,
  },
  eventType: {
    fontWeight: "700",
    opacity: 1,
  },
  eventProf: {
    fontFamily: Fonts.sans,
    fontSize: 8.5,
    color: Surface.onEvent,
    opacity: 0.72,
  },
  eventGrade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
});
