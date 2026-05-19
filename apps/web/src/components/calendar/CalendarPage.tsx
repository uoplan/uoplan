import "./calendar.css";
import { useEffect, useRef, useState } from "react";
import { Alert, Box, Button, Group, Stack, Text, Title, Tooltip } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import {
  IconArrowBackUp,
  IconArrowLeft,
  IconChevronLeft,
  IconChevronRight,
  IconRefresh,
  IconSettings,
  IconShare,
} from "@tabler/icons-react";
import { useAppStore } from "../../store/appStore";
import { useShallow } from "zustand/react/shallow";
import { CalendarView, type CalendarViewHandle } from "./CalendarView";
import { ResetModal } from "../shared/ResetModal";
import { buildScheduleIcs, downloadTextFile } from "schedule";
import { useShareUrl } from "../../hooks/useShareUrl";
import { useTimetableDateRangeFromSchedule } from "../../hooks/useTimetableDateRange";
import { tr } from "../../i18n";
import { canGenerateBasicSchedule } from "../../lib/basicCalendarPins";
import { canGoToPreviousSeed } from "../../lib/seedNavigation";
import { CALENDAR_SIDEBAR_WIDTH_PX } from "./calendarLayout";
import { BasicCalendarSidebarControls } from "./BasicCalendarSidebarControls";
import { BasicCalendarHeaderActions } from "./BasicCalendarHeaderActions";
import { CalendarMobileDrawer } from "./CalendarMobileDrawer";
import { GenerationErrorModal } from "./GenerationErrorModal";
interface CalendarPageProps {
  variant: "basic" | "advanced";
  onBack: () => void;
}

export function CalendarPage({ variant, onBack }: CalendarPageProps) {
  useEffect(() => {
    document.documentElement.classList.add("calendar-no-scrollbar-gutter");
    return () => {
      document.documentElement.classList.remove("calendar-no-scrollbar-gutter");
    };
  }, []);

  const {
    currentSchedule,
    currentSwaps,
    indices,
    generationError,
    cache,
    professorRatings,
    currentColorMap,
    currentSeed,
    lowestVisitedSeed,
    scheduleGenerating,
    basicPinnedCourses,
    basicElectivesCount,
    scheduleNoVariety,
  } = useAppStore(
    useShallow((s) => ({
      currentSchedule: s.currentSchedule,
      currentSwaps: s.currentSwaps,
      indices: s.indices,
      generationError: s.generationError,
      cache: s.cache,
      professorRatings: s.professorRatings,
      currentColorMap: s.currentColorMap,
      currentSeed: s.currentSeed,
      lowestVisitedSeed: s.lowestVisitedSeed,
      scheduleGenerating: s.scheduleGenerating,
      basicPinnedCourses: s.basicPinnedCourses,
      basicElectivesCount: s.basicElectivesCount,
      scheduleNoVariety: s.scheduleNoVariety,
    })),
  );

  const clearGenerationError = () => useAppStore.setState({ generationError: null });
  const undoLastSwap = useAppStore((s) => s.undoLastSwap);
  const getShareUrl = useAppStore((s) => s.getShareUrl);
  const goToPreviousSeed = useAppStore((s) => s.goToPreviousSeed);
  const goToNextSeed = useAppStore((s) => s.goToNextSeed);
  const randomizeSeed = useAppStore((s) => s.randomizeSeed);
  const generateSchedules = useAppStore((s) => s.generateSchedules);
  const getSwapCandidates = useAppStore((s) => s.getSwapCandidates);
  const swapCourseInSchedule = useAppStore((s) => s.swapCourseInSchedule);
  const resetToDefault = useAppStore((s) => s.resetToDefault);

  const isBasic = variant === "basic";
  const hasSchedule = currentSchedule !== null;
  const canGoPrevious = canGoToPreviousSeed(currentSeed, lowestVisitedSeed);
  const canUseSeedNavigation =
    !isBasic || canGenerateBasicSchedule(basicPinnedCourses.length, basicElectivesCount);

  const morphRef = useRef<CalendarViewHandle>(null);

  const [controlsOpen, setControlsOpen] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [timetableStartDate, setTimetableStartDate] = useState("");
  const [timetableEndDate, setTimetableEndDate] = useState("");

  const { shareCopied, handleCopyShare } = useShareUrl(getShareUrl);

  const isMobile = useMediaQuery("(max-width: 768px)", false, { getInitialValueInEffect: false });

  useTimetableDateRangeFromSchedule(
    currentSchedule,
    timetableStartDate,
    timetableEndDate,
    setTimetableStartDate,
    setTimetableEndDate,
  );

  const eventCount = currentSchedule?.enrollments.reduce((sum, e) => sum + e.times.length, 0) ?? 0;

  const startOk =
    Boolean(timetableStartDate) && !Number.isNaN(Date.parse(`${timetableStartDate}T00:00:00Z`));
  const endOk =
    Boolean(timetableEndDate) && !Number.isNaN(Date.parse(`${timetableEndDate}T00:00:00Z`));
  const dateRangeOk = startOk && endOk && timetableStartDate <= timetableEndDate;

  const handlePrevious = async () => {
    if (scheduleGenerating || !canUseSeedNavigation) return;
    morphRef.current?.captureAndPark();
    await goToPreviousSeed();
  };

  const handleNext = async () => {
    if (scheduleGenerating || !canUseSeedNavigation) return;
    morphRef.current?.captureAndPark();
    await goToNextSeed();
  };

  const handleDownloadIcs = () => {
    if (!currentSchedule) return;
    const ics = buildScheduleIcs({
      schedule: currentSchedule,
      cache,
      startDate: timetableStartDate,
      endDate: timetableEndDate,
    });
    const filename = `uoplan-schedule-${currentSeed}-${timetableStartDate}-to-${timetableEndDate}.ics`;
    downloadTextFile(filename, ics, "text/calendar;charset=utf-8");
  };

  const calendarTitle = tr(isBasic ? "basicCalendar.title" : "calendarPage.title");
  const calendarSubtitle = tr(isBasic ? "basicCalendar.subtitle" : "calendarPage.subtitle");

  const sidebarControls = (
    <>
      <Title
        order={1}
        style={{
          fontFamily: '"DM Serif Display", serif',
          color: "#F8F9FA",
          marginBottom: 0,
          ...(isMobile ? { display: "none" } : {}),
        }}
      >
        {calendarTitle}
      </Title>
      <Text size="sm" style={{ color: "#ADB5BD", marginTop: isMobile ? 0 : -8 }}>
        {calendarSubtitle}
      </Text>

      {isBasic ? (
        <>
          <BasicCalendarHeaderActions onBack={onBack} />
          <BasicCalendarSidebarControls
            onBeforeNavigate={() => morphRef.current?.captureAndPark()}
            onDownloadIcs={handleDownloadIcs}
            downloadDisabled={!dateRangeOk || !currentSchedule}
          />
        </>
      ) : (
        <>
          {currentSwaps.length > 0 && (
            <Button
              variant="light"
              color="gray"
              size="sm"
              radius={0}
              leftSection={<IconArrowBackUp size={14} />}
              onClick={() => undoLastSwap()}
            >
              {currentSwaps.length === 1
                ? tr("calendarPage.undoSwap")
                : tr("calendarPage.undoSwapCount", {
                    count: currentSwaps.length,
                  })}
            </Button>
          )}

          <Group gap="xs">
            {indices && (
              <Tooltip
                label="Copied to clipboard!"
                opened={shareCopied}
                position="bottom"
                withArrow
                color="dark"
              >
                <Button
                  variant="filled"
                  color="dark"
                  size="sm"
                  radius={0}
                  leftSection={<IconShare size={14} />}
                  onClick={handleCopyShare}
                  style={{ backgroundColor: "#141517" }}
                >
                  {tr("calendarPage.share")}
                </Button>
              </Tooltip>
            )}
            <Button
              variant="filled"
              color="dark"
              size="sm"
              radius={0}
              leftSection={<IconRefresh size={14} />}
              onClick={() => setResetModalOpen(true)}
              style={{ backgroundColor: "#141517" }}
            >
              {tr("calendarPage.reset")}
            </Button>
          </Group>

          <ResetModal
            opened={resetModalOpen}
            onClose={() => setResetModalOpen(false)}
            onConfirm={() => {
              resetToDefault();
              setResetModalOpen(false);
              onBack();
            }}
          />
        </>
      )}

      {!isBasic && (
        <>
          {hasSchedule ? (
            <Stack gap={6}>
              <Text size="xs" c="dimmed">
                {tr("calendarPage.scheduleNav.label")}
              </Text>
              <Group gap="xs">
                <Button
                  variant="light"
                  color="violet"
                  size="sm"
                  radius={0}
                  leftSection={<IconChevronLeft size={14} />}
                  disabled={!canGoPrevious || scheduleGenerating || !canUseSeedNavigation}
                  loading={scheduleGenerating}
                  onClick={handlePrevious}
                >
                  {tr("calendarPage.previous")}
                </Button>
                <Button
                  variant="filled"
                  color="violet"
                  size="sm"
                  radius={0}
                  rightSection={<IconChevronRight size={14} />}
                  disabled={scheduleGenerating || !canUseSeedNavigation}
                  loading={scheduleGenerating}
                  onClick={handleNext}
                >
                  {tr("calendarPage.next")}
                </Button>
              </Group>
            </Stack>
          ) : (
            <Button
              variant="filled"
              color="violet"
              size="sm"
              radius={0}
              disabled={scheduleGenerating}
              loading={scheduleGenerating}
              onClick={() => void generateSchedules()}
            >
              {tr("calendarPage.generate")}
            </Button>
          )}

          {hasSchedule && (
            <Text size="sm" c="dimmed">
              {tr("calendarPage.seedLabel", { seed: currentSeed })}
            </Text>
          )}
        </>
      )}

      {!isBasic && (
        <Button
          size="sm"
          color="violet"
          variant="filled"
          radius={0}
          disabled={!dateRangeOk || !currentSchedule}
          onClick={handleDownloadIcs}
        >
          {tr("calendarPage.downloadIcs")}
        </Button>
      )}

      {!isBasic && (
        <Button
          variant="light"
          color="gray"
          size="sm"
          radius={0}
          disabled={scheduleGenerating}
          loading={scheduleGenerating}
          onClick={() => void randomizeSeed()}
        >
          {tr("calendarPage.randomize")}
        </Button>
      )}

      {scheduleNoVariety && !generationError && (
        <Alert color="yellow" variant="light" radius={0} py="xs" style={{ flexShrink: 0 }}>
          {tr(isBasic ? "basicCalendar.noMoreSchedules" : "calendarPage.noMoreSchedules")}
        </Alert>
      )}

      <Stack gap={0}>
        <Text size="xs" c="dimmed">
          {tr("calendarPage.showingBlocks", {
            count: eventCount,
            suffix: eventCount === 1 ? "" : "s",
          })}
        </Text>
      </Stack>

      {!isMobile && (
        <>
          <Box style={{ flex: 1, minHeight: 24 }} />
          <Button
            variant="filled"
            color="dark"
            size="sm"
            radius={0}
            onClick={onBack}
            style={{ backgroundColor: "#141517", alignSelf: "stretch" }}
          >
            {tr("calendarPage.backToSetup")}
          </Button>
        </>
      )}
    </>
  );

  return (
    <>
      <GenerationErrorModal error={generationError} onClose={clearGenerationError} />
      <Box
        component="main"
        style={{
          width: "100%",
          height: "100vh",
          display: "flex",
          flexDirection: "row",
          boxSizing: "border-box",
          overflow: "hidden",
        }}
      >
        {!isMobile && (
          <Box
            component="aside"
            aria-label="Calendar Controls"
            style={{
              width: CALENDAR_SIDEBAR_WIDTH_PX,
              height: "100%",
              flexShrink: 0,
              padding: "24px 20px",
              borderRight: "2px solid #2C2E33",
              backgroundColor: "#1E1E20",
              display: "flex",
              flexDirection: "column",
              gap: 24,
              overflowY: "auto",
            }}
          >
            {sidebarControls}
          </Box>
        )}

        {isMobile && (
          <CalendarMobileDrawer
            opened={controlsOpen}
            onClose={() => setControlsOpen(false)}
            title={calendarTitle}
            ariaLabel={tr("calendarPage.mobile.controlsAria")}
          >
            <Stack gap={24}>{sidebarControls}</Stack>
          </CalendarMobileDrawer>
        )}

        {/* Calendar area */}
        <Box
          component="section"
          aria-label="Timetable"
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            padding: 0,
            paddingBottom: isMobile ? 72 : 0,
            width: "100%",
          }}
        >
          <CalendarView
            ref={morphRef}
            schedule={currentSchedule}
            cache={cache}
            professorRatings={professorRatings}
            getSwapCandidates={getSwapCandidates}
            onSwap={swapCourseInSchedule}
            colorMap={currentColorMap}
          />
        </Box>

        {/* Mobile bottom nav */}
        {isMobile && (
          <Box
            component="nav"
            style={{
              position: "fixed",
              bottom: 0,
              left: 0,
              right: 0,
              display: "flex",
              gap: 0,
              backgroundColor: "#1E1E20",
              borderTop: "2px solid #2C2E33",
              paddingBottom: "env(safe-area-inset-bottom, 0)",
              zIndex: 198,
            }}
          >
            <Button
              variant="subtle"
              color="gray"
              size="md"
              radius={0}
              aria-label={tr("calendarPage.mobile.back")}
              style={{ flex: 1, border: "none", height: 56 }}
              onClick={onBack}
            >
              <IconArrowLeft size={22} stroke={1.75} />
            </Button>
            <Button
              variant="subtle"
              color="gray"
              size="md"
              radius={0}
              aria-label={tr("calendarPage.mobile.menu")}
              style={{ flex: 1, border: "none", height: 56 }}
              onClick={() => setControlsOpen(true)}
            >
              <IconSettings size={22} stroke={1.75} />
            </Button>
            <Button
              variant="subtle"
              color="gray"
              size="md"
              radius={0}
              aria-label={tr("calendarPage.mobile.previous")}
              style={{ flex: 1, border: "none", height: 56 }}
              disabled={!canGoPrevious || scheduleGenerating || !canUseSeedNavigation}
              loading={scheduleGenerating}
              onClick={handlePrevious}
              title="Previous schedule"
            >
              <IconChevronLeft size={22} stroke={1.75} />
            </Button>
            <Button
              variant="subtle"
              color="gray"
              size="md"
              radius={0}
              aria-label={tr("calendarPage.mobile.next")}
              style={{ flex: 1, border: "none", height: 56 }}
              disabled={scheduleGenerating || !canUseSeedNavigation}
              loading={scheduleGenerating}
              onClick={handleNext}
              title="Next schedule"
            >
              <IconChevronRight size={22} stroke={1.75} />
            </Button>
          </Box>
        )}
      </Box>
    </>
  );
}
