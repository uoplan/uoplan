import { useMemo, useCallback, forwardRef, useImperativeHandle } from "react";
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
import type { CalendarEvent } from "../../hooks/useCalendarEvents";
import type { WeekGroup } from "../../hooks/useScheduleWeeks";

const EMPTY_COLOR_MAP: Record<string, number> = {};

function formatWeekRange(group: WeekGroup): string {
  const fmt = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  // Display Monday of first week → Friday of last week (matching the Mon–Fri grid)
  const start = new Date(`${group.startDate}T00:00:00Z`);
  const endFriday = new Date(`${group.endDate}T00:00:00Z`);
  endFriday.setUTCDate(endFriday.getUTCDate() - 2); // Sunday → Friday
  if (endFriday < start) {
    // Edge case: single-day range
    return fmt.format(start);
  }
  return `${fmt.format(start)} – ${fmt.format(endFriday)}`;
}

export interface CalendarViewHandle {
  captureAndPark: () => void;
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

export const CalendarView = forwardRef<CalendarViewHandle, CalendarViewProps>(function CalendarView(
  { schedule, cache, professorRatings, getSwapCandidates, onSwap, colorMap = EMPTY_COLOR_MAP },
  ref,
) {
  const isCompactCalendar = useMediaQuery("(max-width: 1200px)");
  const prefersReduced = useMediaQuery("(prefers-reduced-motion: reduce)") ?? false;

  const { displayedSchedule, animationPhase, captureAndPark } = useScheduleTransition(
    schedule,
    prefersReduced,
  );

  useImperativeHandle(ref, () => ({ captureAndPark }), [captureAndPark]);

  const swap = useSwapModal(getSwapCandidates, cache);

  const allEvents = useCalendarEvents(displayedSchedule, professorRatings);
  const { weekGroups, weekIndex, setWeekIndex } = useScheduleWeeks(schedule);

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
        <Group
          justify="space-between"
          align="center"
          gap={8}
          style={{
            flexShrink: 0,
            padding: "6px 12px",
            borderBottom: "1px solid #2C2E33",
            backgroundColor: "#1A1A1C",
          }}
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
              ? `Week ${weekIndex + 1} of ${weekGroups.length} · ${formatWeekRange(weekGroups[weekIndex])}`
              : formatWeekRange(weekGroups[0])}
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
});
