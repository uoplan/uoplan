import { useMemo, useState } from "react";
import type { GeneratedSchedule } from "@uoplan/core";
import { COURSE_COLORS, COURSE_COLOR_HEX, hexToRgb } from "@uoplan/core";
import type { WeekGroup } from "../../hooks/useScheduleWeeks";
import { slotActiveInWeek } from "../../hooks/useScheduleWeeks";
import { formatWeekLabel } from "../../lib/formatWeekCount";
import { CALENDAR_PREVIEW_CARD_ASPECT } from "./calendarLayout";

const DAY_ORDER: Record<string, number> = { Mo: 0, Tu: 1, We: 2, Th: 3, Fr: 4 };
const NUM_DAYS = 5;
const TIME_MIN = 480; // 8:00 AM
const TIME_MAX = 1320; // 10:00 PM
const TIME_RANGE = TIME_MAX - TIME_MIN;

/** Horizontal padding (px) inside the bar on each side of a card. */
const CARD_INSET = 8;

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
  cardW: number;
  cardH: number;
  colW: number;
  selected: boolean;
  hovered: boolean;
  ariaLabel: string;
  onClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

function WeekMiniCard({
  slots,
  cardW,
  cardH,
  colW,
  selected,
  hovered,
  ariaLabel,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: WeekMiniCardProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-pressed={selected}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        appearance: "none",
        padding: 0,
        font: "inherit",
        color: "inherit",
        textAlign: "left",
        width: cardW,
        height: cardH,
        borderRadius: "var(--app-radius-sm)",
        backgroundColor: hovered && !selected ? "var(--app-surface-hover)" : "var(--app-surface)",
        border: selected ? "1px solid var(--app-border-strong)" : "1px solid var(--app-border)",
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
            backgroundColor: "color-mix(in srgb, var(--app-surface-hover) 42%, transparent)",
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
            left: slot.dayIdx * colW + 1,
            top: `${slot.topPct}%`,
            width: colW - 2,
            height: `${slot.heightPct}%`,
            minHeight: 3,
            backgroundColor: `rgb(${slot.r} ${slot.g} ${slot.b} / 70%)`,
            borderRadius: 1,
          }}
        />
      ))}
    </button>
  );
}

interface WeekPreviewPanelProps {
  schedule: GeneratedSchedule | null;
  weekGroups: WeekGroup[];
  weekIndex: number;
  setWeekIndex: (index: number) => void;
  colorMap: Record<string, number>;
  /** Total width (px) of the bar; cards scale to fill it. */
  barWidth: number;
}

export function WeekPreviewPanel({
  schedule,
  weekGroups,
  weekIndex,
  setWeekIndex,
  colorMap,
  barWidth,
}: WeekPreviewPanelProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const cardW = Math.max(40, barWidth - CARD_INSET * 2);
  const cardH = Math.round(cardW * CALENDAR_PREVIEW_CARD_ASPECT);
  const colW = cardW / NUM_DAYS;

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
        width: barWidth,
        height: "100%",
        flexShrink: 0,
        overflowY: "auto",
        backgroundColor: "var(--app-surface-sunken)",
        borderRight: "1px solid var(--app-border)",
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
          cardW={cardW}
          cardH={cardH}
          colW={colW}
          selected={idx === weekIndex}
          hovered={idx === hoveredIndex}
          ariaLabel={formatWeekLabel(weekGroups, idx)}
          onClick={() => setWeekIndex(idx)}
          onMouseEnter={() => setHoveredIndex(idx)}
          onMouseLeave={() => setHoveredIndex(null)}
        />
      ))}
    </div>
  );
}
