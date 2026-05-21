import { useMemo, useState } from "react";
import type { GeneratedSchedule } from "@uoplan/schedule";
import { COURSE_COLORS, COURSE_COLOR_HEX, hexToRgb } from "@uoplan/schedule";
import type { WeekGroup } from "../../hooks/useScheduleWeeks";
import { slotActiveInWeek } from "../../hooks/useScheduleWeeks";

const DAY_ORDER: Record<string, number> = { Mo: 0, Tu: 1, We: 2, Th: 3, Fr: 4 };
const NUM_DAYS = 5;
const TIME_MIN = 480; // 8:00 AM
const TIME_MAX = 1320; // 10:00 PM
const TIME_RANGE = TIME_MAX - TIME_MIN;

// landscape — matches the calendar's wider-than-tall aspect ratio
const CARD_W = 80;
const CARD_H = 56;
const COL_W = CARD_W / NUM_DAYS; // 16px per day column

interface Slot {
  dayIdx: number;
  topPct: number;
  heightPct: number;
  r: number;
  g: number;
  b: number;
}

interface WeekMiniCardProps {
  slots: Slot[];
  selected: boolean;
  hovered: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

function WeekMiniCard({
  slots,
  selected,
  hovered,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: WeekMiniCardProps) {
  return (
    <div
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        width: CARD_W,
        height: CARD_H,
        borderRadius: 0,
        backgroundColor: hovered && !selected ? "#222226" : "#1C1C20",
        border: selected ? "1px solid #52535C" : "1px solid #2C2E33",
        cursor: "pointer",
        position: "relative",
        overflow: "hidden",
        flexShrink: 0,
        transition: "border-color 0.1s",
      }}
    >
      {/* Gray overlay on selected card */}
      {selected && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "rgba(220, 220, 230, 0.07)",
            pointerEvents: "none",
            zIndex: 1,
          }}
        />
      )}

      {slots.map((slot, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: slot.dayIdx * COL_W + 1,
            top: `${slot.topPct}%`,
            width: COL_W - 2,
            height: `${slot.heightPct}%`,
            minHeight: 3,
            backgroundColor: `rgba(${slot.r}, ${slot.g}, ${slot.b}, 0.7)`,
            borderRadius: 0,
          }}
        />
      ))}
    </div>
  );
}

interface WeekPreviewPanelProps {
  schedule: GeneratedSchedule | null;
  weekGroups: WeekGroup[];
  weekIndex: number;
  setWeekIndex: (index: number) => void;
  colorMap: Record<string, number>;
}

export function WeekPreviewPanel({
  schedule,
  weekGroups,
  weekIndex,
  setWeekIndex,
  colorMap,
}: WeekPreviewPanelProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const weekSlots = useMemo<Slot[][]>(() => {
    if (!schedule) return weekGroups.map(() => []);

    return weekGroups.map((group) => {
      const slots: Slot[] = [];
      for (const [enrollIdx, enrollment] of schedule.enrollments.entries()) {
        const colorIdx = (colorMap[enrollment.courseCode] ?? enrollIdx) % COURSE_COLORS.length;
        const hex = COURSE_COLOR_HEX[COURSE_COLORS[colorIdx]];
        const { r, g, b } = hexToRgb(hex);

        for (const { section } of Object.values(enrollment.sectionCombo)) {
          for (const t of section.times) {
            if (t.startMinutes >= t.endMinutes) continue;
            const dayIdx = DAY_ORDER[t.day];
            if (dayIdx === undefined) continue;

            const active =
              !t.meetingDates || slotActiveInWeek(t.day, t.meetingDates, group.startDate);
            if (!active) continue;

            const clampedStart = Math.max(TIME_MIN, Math.min(TIME_MAX, t.startMinutes));
            const clampedEnd = Math.max(TIME_MIN, Math.min(TIME_MAX, t.endMinutes));
            const topPct = ((clampedStart - TIME_MIN) / TIME_RANGE) * 100;
            const heightPct = Math.max(0, ((clampedEnd - clampedStart) / TIME_RANGE) * 100);

            slots.push({ dayIdx, topPct, heightPct, r, g, b });
          }
        }
      }
      return slots;
    });
  }, [schedule, weekGroups, colorMap]);

  return (
    <div
      style={{
        width: CARD_W + 16,
        height: "100%",
        flexShrink: 0,
        overflowY: "auto",
        backgroundColor: "#161618",
        borderRight: "1px solid #2C2E33",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "8px 0",
        gap: 6,
        scrollbarWidth: "none",
      }}
    >
      {weekGroups.map((group, idx) => (
        <WeekMiniCard
          key={group.startDate}
          slots={weekSlots[idx] ?? []}
          selected={idx === weekIndex}
          hovered={idx === hoveredIndex}
          onClick={() => setWeekIndex(idx)}
          onMouseEnter={() => setHoveredIndex(idx)}
          onMouseLeave={() => setHoveredIndex(null)}
        />
      ))}
    </div>
  );
}
