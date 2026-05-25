import { useMemo, useCallback } from "react";
import { ActionIcon, Box, Group, Text } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { AnimatePresence, motion } from "framer-motion";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import type { DataCache } from "@uoplan/schedule";
import type { GeneratedSchedule } from "@uoplan/schedule";
import type { ProfessorRatingsMap } from "@uoplan/schedule";
import { SwapPanel } from "./SwapPanel";
import { useCalendarEvents } from "../../hooks/useCalendarEvents";
import { useSwapModal } from "../../hooks/useSwapModal";
import { useScheduleTransition, useWeekIndexTransition } from "../../hooks/useScheduleTransition";
import { slotActiveInWeek } from "../../hooks/useScheduleWeeks";
import { WeekCalendar } from "./WeekCalendar";
import { WeekPreviewPanel } from "./WeekPreviewPanel";
import type { CalendarEvent } from "../../hooks/useCalendarEvents";
import type { WeekGroup } from "../../hooks/useScheduleWeeks";
import { formatWeekCount } from "../../lib/formatWeekCount";
import { tr } from "../../i18n";

const EMPTY_COLOR_MAP: Record<string, number> = {};

function formatScheduleRange(start: string, end: string): string {
  const s = new Date(`${start}T00:00:00Z`);
  const e = new Date(`${end}T00:00:00Z`);
  const startYear = s.getUTCFullYear();
  const endYear = e.getUTCFullYear();
  const fmtNoYear = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  const fmtWithYear = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  const startStr = startYear === endYear ? fmtNoYear.format(s) : fmtWithYear.format(s);
  return `${startStr} – ${fmtWithYear.format(e)}`;
}

interface CalendarViewProps {
  schedule: GeneratedSchedule | null;
  cache: DataCache | null;
  professorRatings: ProfessorRatingsMap | null;
  getSwapCandidates: (enrollmentIndex: number) => {
    candidates: string[];
    poolCourses: string[];
    requirementTitle?: string;
    rejectedWithConflict: Array<{ code: string; conflictsWith: string }>;
  };
  onSwap: (enrollmentIndex: number, newCourseCode: string) => void;
  colorMap?: Record<string, number>;
  weekGroups: WeekGroup[];
  weekIndex: number;
  setWeekIndex: (index: number) => void;
}

export function CalendarView({
  schedule,
  cache,
  professorRatings,
  getSwapCandidates,
  onSwap,
  colorMap = EMPTY_COLOR_MAP,
  weekGroups,
  weekIndex,
  setWeekIndex,
}: CalendarViewProps) {
  const isCompactCalendar = useMediaQuery("(max-width: 1200px)");
  const isMobile = useMediaQuery("(max-width: 768px)", false, { getInitialValueInEffect: false });
  const prefersReduced = useMediaQuery("(prefers-reduced-motion: reduce)") ?? false;

  const { displayedSchedule, animationPhase: schedulePhase } = useScheduleTransition(
    schedule,
    prefersReduced,
  );
  const { displayedWeekIndex, animationPhase: weekPhase } = useWeekIndexTransition(
    weekIndex,
    prefersReduced,
  );

  // Schedule animation takes priority; week animation fires only when schedule is idle.
  const animationPhase = schedulePhase !== "idle" ? schedulePhase : weekPhase;

  const swap = useSwapModal(getSwapCandidates, cache, professorRatings);

  const allEvents = useCalendarEvents(displayedSchedule, professorRatings);

  const scheduleDateRange = useMemo(() => {
    if (!schedule) return null;
    let min: string | null = null;
    let max: string | null = null;
    for (const enrollment of schedule.enrollments) {
      for (const { section } of Object.values(enrollment.sectionCombo)) {
        for (const t of section.times) {
          if (!t.meetingDates) continue;
          if (!min || t.meetingDates[0] < min) min = t.meetingDates[0];
          if (!max || t.meetingDates[1] > max) max = t.meetingDates[1];
        }
      }
    }
    return min && max ? { start: min, end: max } : null;
  }, [schedule]);

  const currentGroup: WeekGroup | null = weekGroups[displayedWeekIndex] ?? null;

  const events = useMemo(() => {
    if (!currentGroup) return allEvents;
    return allEvents.filter((e) => {
      if (!e.meetingDates) return true;
      // Use the slot's specific day occurrence within the group's first week,
      // matching the fingerprint logic so no phantom events bleed across groups.
      return slotActiveInWeek(e.day, e.meetingDates, currentGroup.startDate);
    });
  }, [allEvents, currentGroup]);

  const hasWeekendCourses = useMemo(
    () => events.some((e) => e.day === "Sa" || e.day === "Su"),
    [events],
  );

  const showWeekends = !isCompactCalendar || hasWeekendCourses;

  const handleEventClick = useCallback(
    (event: CalendarEvent) => {
      swap.openModal(event.enrollmentIndex, event.courseCode, {
        virtual: event.virtual,
        componentSection: event.componentSection,
        gradeViz: event.gradeViz,
      });
    },
    [swap],
  );

  return (
    <Box
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      {!swap.isOpen && (
        <Box
          style={{
            flexShrink: 0,
            borderBottom: "1px solid #2C2E33",
            backgroundColor: "#1A1A1C",
          }}
        >
          {weekGroups.length > 0 && (
            <>
              {scheduleDateRange && (
                <Text
                  size="xs"
                  c="dimmed"
                  style={{
                    textAlign: "center",
                    padding: "4px 12px 0",
                  }}
                >
                  {formatScheduleRange(scheduleDateRange.start, scheduleDateRange.end)}
                </Text>
              )}
              <Group
                justify="space-between"
                align="center"
                gap={8}
                style={{ padding: "4px 12px 6px" }}
              >
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size="sm"
                  aria-label="Previous week"
                  disabled={weekIndex === 0}
                  onClick={() => setWeekIndex(weekIndex - 1)}
                >
                  <IconChevronLeft size={14} />
                </ActionIcon>
                <Text size="xs" c="dimmed" style={{ textAlign: "center", flex: 1 }}>
                  {weekGroups.length > 1
                    ? `${tr("calendarPage.weekOf", { current: weekIndex + 1, total: weekGroups.length })} · ${formatWeekCount(weekGroups[weekIndex])}`
                    : formatWeekCount(weekGroups[0])}
                </Text>
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size="sm"
                  aria-label="Next week"
                  disabled={weekIndex === weekGroups.length - 1}
                  onClick={() => setWeekIndex(weekIndex + 1)}
                >
                  <IconChevronRight size={14} />
                </ActionIcon>
              </Group>
            </>
          )}
          {weekGroups.length === 0 && (
            <div style={{ visibility: "hidden" }}>
              <Text size="xs" style={{ padding: "4px 12px 0" }}>
                &nbsp;
              </Text>
              <Group
                justify="space-between"
                align="center"
                gap={8}
                style={{ padding: "4px 12px 6px" }}
              >
                <ActionIcon variant="subtle" color="gray" size="sm">
                  <IconChevronLeft size={14} />
                </ActionIcon>
                <Text size="xs">&nbsp;</Text>
                <ActionIcon variant="subtle" color="gray" size="sm">
                  <IconChevronRight size={14} />
                </ActionIcon>
              </Group>
            </div>
          )}
        </Box>
      )}
      <Box
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "row",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {swap.isOpen && swap.modalState ? (
            <motion.div
              key="swap"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              style={{ display: "flex", flex: 1, minWidth: 0, minHeight: 0 }}
            >
              <SwapPanel
                schedule={schedule}
                modalState={swap.modalState}
                result={swap.result}
                loading={swap.loading}
                candidateOptions={swap.candidateOptions}
                query={swap.query}
                setQuery={swap.setQuery}
                closeModal={swap.closeModal}
                cache={cache}
                professorRatings={professorRatings}
                onSwap={onSwap}
              />
            </motion.div>
          ) : (
            <motion.div
              key="calendar"
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              style={{ display: "flex", flex: 1, minWidth: 0, minHeight: 0 }}
            >
              {!isMobile && (
                <WeekPreviewPanel
                  schedule={schedule}
                  weekGroups={weekGroups}
                  weekIndex={weekIndex}
                  setWeekIndex={setWeekIndex}
                  colorMap={colorMap}
                />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <WeekCalendar
                  events={events}
                  cache={cache}
                  colorMap={colorMap}
                  onEventClick={handleEventClick}
                  showWeekends={showWeekends ?? false}
                  animationPhase={animationPhase}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Box>
    </Box>
  );
}
