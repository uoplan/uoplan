import { useMemo, useCallback, useEffect } from "react";
import { ActionIcon, Box, Group, Modal, Text } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import type { DataCache } from "schedule";
import type { GeneratedSchedule } from "schedule";
import type { ProfessorRatingsMap } from "schedule";
import { SwapModalContent } from "./SwapModalContent";
import { useCalendarEvents } from "../../hooks/useCalendarEvents";
import { useSwapModal } from "../../hooks/useSwapModal";
import { useScheduleTransition } from "../../hooks/useScheduleTransition";
import { useScheduleWeeks, slotActiveInWeek } from "../../hooks/useScheduleWeeks";
import { WeekCalendar } from "./WeekCalendar";
import { useAppStore } from "../../store/appStore";
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
}

export function CalendarView({
  schedule,
  cache,
  professorRatings,
  getSwapCandidates,
  onSwap,
  colorMap = EMPTY_COLOR_MAP,
}: CalendarViewProps) {
  const isCompactCalendar = useMediaQuery("(max-width: 1200px)");
  const prefersReduced = useMediaQuery("(prefers-reduced-motion: reduce)") ?? false;

  const { displayedSchedule, animationPhase } = useScheduleTransition(schedule, prefersReduced);

  const swap = useSwapModal(getSwapCandidates, cache);

  const calendarWeekIndex = useAppStore((s) => s.calendarWeekIndex);
  const setCalendarWeekIndex = useAppStore((s) => s.setCalendarWeekIndex);

  const allEvents = useCalendarEvents(displayedSchedule, professorRatings);
  const { weekGroups, weekIndex, setWeekIndex } = useScheduleWeeks(schedule, calendarWeekIndex);

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

  useEffect(() => {
    setCalendarWeekIndex(weekIndex);
  }, [weekIndex, setCalendarWeekIndex]);

  const currentGroup: WeekGroup | null = weekGroups[weekIndex] ?? null;

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
      {weekGroups.length > 0 && (
        <Box
          style={{
            flexShrink: 0,
            borderBottom: "1px solid #2C2E33",
            backgroundColor: "#1A1A1C",
          }}
        >
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
          <Group justify="space-between" align="center" gap={8} style={{ padding: "4px 12px 6px" }}>
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
        </Box>
      )}
      <Box style={{ flex: 1, minHeight: 0 }}>
        <WeekCalendar
          events={events}
          cache={cache}
          colorMap={colorMap}
          onEventClick={handleEventClick}
          showWeekends={showWeekends ?? false}
          animationPhase={animationPhase}
        />
      </Box>

      <Modal
        opened={swap.isOpen}
        onClose={swap.closeModal}
        title={swap.result?.requirementTitle}
        size="lg"
        centered
      >
        {swap.modalState && (
          <SwapModalContent
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
        )}
      </Modal>
    </Box>
  );
}
