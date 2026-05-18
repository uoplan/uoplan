import { useMemo, useCallback, forwardRef, useImperativeHandle } from "react";
import { Box, Modal } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import type { DataCache } from "schedule";
import type { GeneratedSchedule } from "schedule";
import type { ProfessorRatingsMap } from "schedule";
import { SwapModalContent } from "./SwapModalContent";
import { useCalendarEvents } from "../../hooks/useCalendarEvents";
import { useSwapModal } from "../../hooks/useSwapModal";
import { useScheduleTransition } from "../../hooks/useScheduleTransition";
import { WeekCalendar } from "./WeekCalendar";
import type { CalendarEvent } from "../../hooks/useCalendarEvents";

const EMPTY_COLOR_MAP: Record<string, number> = {};

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

  const events = useCalendarEvents(displayedSchedule, professorRatings);

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
