import { useMemo, useCallback, useRef, useState } from "react";
import { Box, Text } from "@mantine/core";
import { useLocalStorage, useMediaQuery } from "@mantine/hooks";
import type { DataCache } from "@uoplan/core";
import type { GeneratedSchedule } from "@uoplan/core";
import type { ProfessorRatingsMap } from "@uoplan/core";
import { useCalendarEvents } from "../../hooks/useCalendarEvents";
import { useSwapModal } from "../../hooks/useSwapModal";
import { useScheduleTransition, useWeekIndexTransition } from "../../hooks/useScheduleTransition";
import { slotActiveInWeek } from "../../hooks/useScheduleWeeks";
import { WeekCalendar } from "./WeekCalendar";
import { WeekPreviewPanel } from "./WeekPreviewPanel";
import { CalendarMobileDrawer } from "./CalendarMobileDrawer";
import { CalendarEventDetails } from "./CalendarEventDetails";
import { SwapContextProvider, type SwapContextValue } from "./swapContext";
import { useAppStore } from "../../store/appStore";
import { CALENDAR_HEADER_MIN_HEIGHT } from "./calendarHeaderLayout";
import {
  CALENDAR_PREVIEW_BAR_LARGE_QUERY,
  CALENDAR_PREVIEW_BAR_MAX_PX,
  CALENDAR_PREVIEW_BAR_MIN_PX,
  CALENDAR_PREVIEW_BAR_WIDTH_LARGE_PX,
  CALENDAR_PREVIEW_BAR_WIDTH_PX,
} from "./calendarLayout";
import type { CalendarEvent } from "../../hooks/useCalendarEvents";
import type { WeekGroup } from "../../hooks/useScheduleWeeks";
import { formatWeekLabel } from "../../lib/formatWeekCount";
import { tr as staticTr } from "../../i18n";

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
  const isLargeScreen = useMediaQuery(CALENDAR_PREVIEW_BAR_LARGE_QUERY, false);
  const prefersReduced = useMediaQuery("(prefers-reduced-motion: reduce)") ?? false;

  const [previewBarWidth, setPreviewBarWidth] = useLocalStorage<number>({
    key: "uoplan.calendar.previewBarWidth",
    defaultValue: isLargeScreen
      ? CALENDAR_PREVIEW_BAR_WIDTH_LARGE_PX
      : CALENDAR_PREVIEW_BAR_WIDTH_PX,
    getInitialValueInEffect: false,
  });

  const previewResizing = useRef(false);
  const previewStartX = useRef(0);
  const previewStartWidth = useRef(0);
  // Transient width during an active drag; committed to localStorage on pointer-up
  // so we don't write to storage on every pointer-move.
  const [draggingPreviewWidth, setDraggingPreviewWidth] = useState<number | null>(null);
  const effectivePreviewWidth = draggingPreviewWidth ?? previewBarWidth;

  const clampPreviewWidth = useCallback(
    (width: number) =>
      Math.min(CALENDAR_PREVIEW_BAR_MAX_PX, Math.max(CALENDAR_PREVIEW_BAR_MIN_PX, width)),
    [],
  );

  const handlePreviewResizeDown = useCallback(
    (e: React.PointerEvent) => {
      previewResizing.current = true;
      previewStartX.current = e.clientX;
      previewStartWidth.current = previewBarWidth;
      setDraggingPreviewWidth(previewBarWidth);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [previewBarWidth],
  );

  const handlePreviewResizeMove = useCallback(
    (e: React.PointerEvent) => {
      if (!previewResizing.current) return;
      const delta = e.clientX - previewStartX.current;
      setDraggingPreviewWidth(clampPreviewWidth(previewStartWidth.current + delta));
    },
    [clampPreviewWidth],
  );

  const handlePreviewResizeUp = useCallback(() => {
    if (!previewResizing.current) return;
    previewResizing.current = false;
    setDraggingPreviewWidth((current) => {
      if (current !== null) setPreviewBarWidth(current);
      return null;
    });
  }, [setPreviewBarWidth]);

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
        eventId: event.id,
        virtual: event.virtual,
        componentSection: event.componentSection,
        gradeViz: event.gradeViz,
      });
    },
    [swap],
  );

  const generationPreferEasier = useAppStore((s) => s.generationPreferEasier);

  // The full event for the currently-open swap overlay (used by the mobile drawer).
  const activeEvent = useMemo<CalendarEvent | null>(() => {
    if (!swap.modalState) return null;
    const { enrollmentIndex, componentSection } = swap.modalState;
    return (
      allEvents.find(
        (e) => e.enrollmentIndex === enrollmentIndex && e.componentSection === componentSection,
      ) ??
      allEvents.find((e) => e.enrollmentIndex === enrollmentIndex) ??
      null
    );
  }, [allEvents, swap.modalState]);

  const activeCourseTitle = activeEvent
    ? (cache?.getCourse(activeEvent.courseCode)?.title ?? "")
    : "";

  const swapContextValue = useMemo<SwapContextValue>(
    () => ({
      activeEnrollmentIndex: swap.modalState?.enrollmentIndex ?? null,
      activeEventId: swap.modalState?.eventId ?? null,
      isMobile: isMobile ?? false,
      loading: swap.loading,
      result: swap.result,
      candidateOptions: swap.candidateOptions,
      query: swap.query,
      setQuery: swap.setQuery,
      closeModal: swap.closeModal,
      onSwap,
      cache,
      professorRatings,
      preferEasier: generationPreferEasier,
    }),
    [
      swap.modalState?.enrollmentIndex,
      swap.modalState?.eventId,
      swap.loading,
      swap.result,
      swap.candidateOptions,
      swap.query,
      swap.setQuery,
      swap.closeModal,
      isMobile,
      onSwap,
      cache,
      professorRatings,
      generationPreferEasier,
    ],
  );

  return (
    <SwapContextProvider value={swapContextValue}>
      <Box
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        <Box
          style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
            overflow: "hidden",
          }}
        >
          {!isMobile && (
            <Box
              style={{
                flexShrink: 0,
                minHeight: CALENDAR_HEADER_MIN_HEIGHT,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                borderBottom: "1px solid var(--app-border)",
                backgroundColor: "var(--app-surface)",
              }}
            >
              {weekGroups.length > 0 ? (
                <Box style={{ padding: "6px 12px", textAlign: "center" }}>
                  {scheduleDateRange && (
                    <Text size="xs" c="dimmed">
                      {formatScheduleRange(scheduleDateRange.start, scheduleDateRange.end)}
                    </Text>
                  )}
                  <Text size="xs" c="dimmed">
                    {formatWeekLabel(weekGroups, weekIndex)}
                  </Text>
                </Box>
              ) : (
                <Box style={{ padding: "6px 12px", textAlign: "center", visibility: "hidden" }}>
                  <Text size="xs">&nbsp;</Text>
                  <Text size="xs">&nbsp;</Text>
                </Box>
              )}
            </Box>
          )}
          <Box
            style={{
              flex: 1,
              minHeight: 0,
              display: "flex",
              flexDirection: "row",
              overflow: "hidden",
            }}
          >
            {!isMobile && (
              <>
                <WeekPreviewPanel
                  schedule={schedule}
                  weekGroups={weekGroups}
                  weekIndex={weekIndex}
                  setWeekIndex={setWeekIndex}
                  colorMap={colorMap}
                  barWidth={effectivePreviewWidth}
                />
                <div
                  role="separator"
                  aria-label={staticTr("calendarView.resizePreviewBar")}
                  onPointerDown={handlePreviewResizeDown}
                  onPointerMove={handlePreviewResizeMove}
                  onPointerUp={handlePreviewResizeUp}
                  style={{
                    width: 6,
                    flexShrink: 0,
                    cursor: "col-resize",
                    backgroundColor: "var(--app-border)",
                    transition: "background-color 0.15s",
                    touchAction: "none",
                    zIndex: 1,
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.backgroundColor =
                      "var(--app-border-strong)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.backgroundColor = "var(--app-border)";
                  }}
                />
              </>
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
          </Box>
        </Box>
      </Box>

      {isMobile && activeEvent && (
        <CalendarMobileDrawer
          opened={swap.isOpen}
          onClose={swap.closeModal}
          title={activeEvent.courseCode}
          ariaLabel={staticTr("calendar.swap.swapWith")}
        >
          <CalendarEventDetails
            event={activeEvent}
            courseTitle={activeCourseTitle}
            hideCloseButton
          />
        </CalendarMobileDrawer>
      )}
    </SwapContextProvider>
  );
}
