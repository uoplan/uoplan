import "./calendar.css";
import { useEffect, useRef, useState } from "react";
import {
  ActionIcon,
  Alert,
  Box,
  Button,
  Divider,
  Group,
  Stack,
  Text,
  Title,
  Tooltip,
} from "@mantine/core";
import { useHotkeys, useMediaQuery } from "@mantine/hooks";
import {
  IconArrowBackUp,
  IconArrowsShuffle,
  IconCalendarDown,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconEraser,
  IconFileImport,
  IconSettings,
  IconShare,
  IconTerminal,
} from "@tabler/icons-react";
import { useAppStore, useAppStoreApi } from "../../store/appStore";
import { useShallow } from "zustand/react/shallow";
import { CalendarView } from "./CalendarView";
import { BackButton } from "../shared/BackButton";
import { buildScheduleIcs } from "@uoplan/core";
import { downloadTextFile } from "../../lib/downloadFile";
import { useShareUrl } from "../../hooks/useShareUrl";
import { useTimetableDateRangeFromSchedule } from "../../hooks/useTimetableDateRange";
import { tr } from "../../i18n";
import { canGenerateBasicSchedule } from "../../lib/basicCalendarPins";
import { canGoToPreviousSeed } from "../../lib/seedNavigation";
import { CALENDAR_SIDEBAR_WIDTH_PX } from "./calendarLayout";
import { BasicCalendarHeaderActions } from "./BasicCalendarHeaderActions";
import { CalendarMobileDrawer } from "./CalendarMobileDrawer";
import { GenerationErrorModal } from "./GenerationErrorModal";
import { EnrolCliModal } from "./EnrolCliModal";
import { UEnrollImportModal } from "./UEnrollImportModal";
import { AdvancedGenerationOptions } from "./AdvancedGenerationOptions";
import { BasicGenerationOptions } from "./BasicGenerationOptions";
import { SaveStatusIndicator } from "./SaveStatusIndicator";
import { AnimatedIconSwap } from "../shared/AnimatedIconSwap";
import { encodeSchedulePayload } from "../../lib/encodeSchedulePayload";
import { useScheduleWeeks } from "../../hooks/useScheduleWeeks";

export function CalendarPage() {
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
    generationOptionsDirty,
    selectedTermId,
    program,
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
      generationOptionsDirty: s.generationOptionsDirty,
      selectedTermId: s.selectedTermId,
      program: s.program,
    })),
  );

  const hasProgram = program !== null;

  const setCalendarMode = useAppStore((s) => s.setCalendarMode);
  // Sync the active calendar mode so generation logic knows which path is active.
  useEffect(() => {
    setCalendarMode(hasProgram ? "advanced" : "basic");
    return () => setCalendarMode(null);
  }, [hasProgram, setCalendarMode]);

  const calendarWeekIndex = useAppStore((s) => s.calendarWeekIndex);
  const setCalendarWeekIndex = useAppStore((s) => s.setCalendarWeekIndex);

  const { weekGroups, weekIndex, setWeekIndex } = useScheduleWeeks(
    currentSchedule,
    calendarWeekIndex,
  );

  useEffect(() => {
    setCalendarWeekIndex(weekIndex);
  }, [weekIndex, setCalendarWeekIndex]);

  const storeApi = useAppStoreApi();
  const clearGenerationError = () => storeApi.setState({ generationError: null });
  const undoLastSwap = useAppStore((s) => s.undoLastSwap);
  const getShareUrl = useAppStore((s) => s.getShareUrl);
  const goToPreviousSeed = useAppStore((s) => s.goToPreviousSeed);
  const goToNextSeed = useAppStore((s) => s.goToNextSeed);
  const randomizeSeed = useAppStore((s) => s.randomizeSeed);
  const getSwapCandidates = useAppStore((s) => s.getSwapCandidates);
  const swapCourseInSchedule = useAppStore((s) => s.swapCourseInSchedule);
  const clearGenerationOptions = useAppStore((s) => s.clearGenerationOptions);
  const generateSchedules = useAppStore((s) => s.generateSchedules);
  const resetBasicCalendarSettings = useAppStore((s) => s.resetBasicCalendarSettings);

  const canGoPrevious = canGoToPreviousSeed(currentSeed, lowestVisitedSeed);
  const canUseSeedNavigation =
    hasProgram || canGenerateBasicSchedule(basicPinnedCourses.length, basicElectivesCount);

  const [controlsOpen, setControlsOpen] = useState(false);
  const [enrolCliOpen, setEnrolCliOpen] = useState(false);
  const [uenrollImportOpen, setUenrollImportOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(CALENDAR_SIDEBAR_WIDTH_PX);
  const isResizing = useRef(false);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);
  const pendingWidth = useRef(CALENDAR_SIDEBAR_WIDTH_PX);
  const asideRef = useRef<HTMLDivElement>(null);
  const previewLineRef = useRef<HTMLDivElement>(null);

  const cliCommand =
    currentSchedule && selectedTermId
      ? `uoplan run ${encodeSchedulePayload(currentSchedule, selectedTermId)}`
      : null;
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
    await goToPreviousSeed();
  };

  const handleNext = async () => {
    if (scheduleGenerating || !canUseSeedNavigation) return;
    if (generationOptionsDirty) {
      // Regenerate from a fresh random seed so the previous-variant ladder resets
      // (Previous becomes unavailable) instead of advancing the existing seed.
      await randomizeSeed();
      return;
    }
    await goToNextSeed();
  };

  const nextLabel = generationOptionsDirty ? tr("calendarPage.generate") : tr("calendarPage.next");

  useHotkeys([
    ["ArrowLeft", () => canGoPrevious && void handlePrevious()],
    ["ArrowRight", () => void handleNext()],
  ]);

  const handleClearOptions = () => {
    resetBasicCalendarSettings();
  };

  const handleClearGenerationOptions = () => {
    clearGenerationOptions();
    void generateSchedules();
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

  function clampSidebarWidth(width: number) {
    return Math.min(600, Math.max(220, width));
  }

  function positionPreviewLine(width: number) {
    const aside = asideRef.current;
    const line = previewLineRef.current;
    if (!aside || !line) return;
    const asideLeft = aside.getBoundingClientRect().left;
    line.style.left = `${asideLeft + width}px`;
  }

  function handleResizePointerDown(e: React.PointerEvent) {
    isResizing.current = true;
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = sidebarWidth;
    pendingWidth.current = sidebarWidth;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const line = previewLineRef.current;
    if (line) {
      positionPreviewLine(sidebarWidth);
      line.style.display = "block";
    }
  }

  function handleResizePointerMove(e: React.PointerEvent) {
    if (!isResizing.current) return;
    const delta = e.clientX - resizeStartX.current;
    const next = clampSidebarWidth(resizeStartWidth.current + delta);
    pendingWidth.current = next;
    positionPreviewLine(next);
  }

  function handleResizePointerUp() {
    if (!isResizing.current) return;
    isResizing.current = false;
    const line = previewLineRef.current;
    if (line) line.style.display = "none";
    setSidebarWidth(pendingWidth.current);
  }

  const calendarTitle = tr("calendarPage.title");
  const calendarSubtitle = tr(hasProgram ? "calendarPage.subtitle" : "basicCalendar.subtitle");

  const sidebarControls = (
    <>
      <BackButton fallbackTo="/schedule" fallbackLabel={tr("landing.schedule.title")} />
      <Title
        order={1}
        style={{
          fontFamily: "var(--app-font-heading)",
          color: "var(--app-text)",
          marginBottom: 0,
          ...(isMobile ? { display: "none" } : {}),
        }}
      >
        {calendarTitle}
      </Title>
      <Text size="sm" style={{ color: "var(--app-text-muted)", marginTop: isMobile ? 0 : -8 }}>
        {calendarSubtitle}
      </Text>

      {!hasProgram ? (
        <>
          <BasicCalendarHeaderActions
            cliCommand={cliCommand}
            onEnrolCli={() => setEnrolCliOpen(true)}
            onClearOptions={handleClearOptions}
            onDownloadIcs={handleDownloadIcs}
            downloadDisabled={!dateRangeOk || !currentSchedule}
          />
          {!isMobile && (
            <Button.Group>
              <Button
                variant="default"
                size="sm"
                radius="md"
                style={{ flex: 1 }}
                leftSection={<IconChevronLeft size={14} />}
                disabled={!canGoPrevious || scheduleGenerating || !canUseSeedNavigation}
                loading={scheduleGenerating}
                onClick={handlePrevious}
              >
                {tr("calendarPage.previous")}
              </Button>
              <Button
                variant={generationOptionsDirty ? "filled" : "default"}
                size="sm"
                radius="md"
                style={{ flex: 1 }}
                rightSection={<IconChevronRight size={14} />}
                disabled={scheduleGenerating || !canUseSeedNavigation}
                loading={scheduleGenerating}
                onClick={handleNext}
              >
                {nextLabel}
              </Button>
            </Button.Group>
          )}
          <BasicGenerationOptions />
        </>
      ) : (
        <Stack gap="md">
          {/* Utility toolbar: download, share, randomize, clear */}
          <Group gap={4}>
            <Tooltip label={tr("calendarPage.downloadIcs")} withArrow position="right">
              <ActionIcon
                variant="subtle"
                color="gray"
                size="md"
                radius="md"
                disabled={!dateRangeOk || !currentSchedule}
                onClick={handleDownloadIcs}
                aria-label={tr("calendarPage.downloadIcs")}
              >
                <IconCalendarDown size={16} />
              </ActionIcon>
            </Tooltip>
            <SaveStatusIndicator />
            {indices && (
              <Tooltip
                label={shareCopied ? tr("app.share.copied") : tr("calendarPage.share")}
                withArrow
                position="right"
                opened={shareCopied || undefined}
              >
                <ActionIcon
                  variant="subtle"
                  color={shareCopied ? "teal" : "gray"}
                  size="md"
                  radius="md"
                  onClick={handleCopyShare}
                  aria-label={tr("calendarPage.share")}
                  style={{ transition: "color 0.2s ease" }}
                >
                  <AnimatedIconSwap statusKey={shareCopied ? "copied" : "share"}>
                    {shareCopied ? <IconCheck size={16} /> : <IconShare size={16} />}
                  </AnimatedIconSwap>
                </ActionIcon>
              </Tooltip>
            )}
            <Tooltip label={tr("calendarPage.randomize")} withArrow position="right">
              <ActionIcon
                variant="subtle"
                color="gray"
                size="md"
                radius="md"
                disabled={scheduleGenerating || !canUseSeedNavigation}
                onClick={() => void randomizeSeed()}
                aria-label={tr("calendarPage.randomize")}
              >
                <IconArrowsShuffle size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={tr("calendarPage.clear")} withArrow position="right">
              <ActionIcon
                variant="subtle"
                color="gray"
                size="md"
                radius="md"
                onClick={handleClearGenerationOptions}
                aria-label={tr("calendarPage.clear")}
              >
                <IconEraser size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={tr("uenrollImport.button")} withArrow position="right">
              <ActionIcon
                variant="subtle"
                color="gray"
                size="md"
                radius="md"
                onClick={() => setUenrollImportOpen(true)}
                aria-label={tr("uenrollImport.button")}
              >
                <IconFileImport size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={tr("enrolCli.button")} withArrow position="right">
              <ActionIcon
                variant="subtle"
                color="green"
                size="md"
                radius="md"
                disabled={!cliCommand}
                onClick={() => setEnrolCliOpen(true)}
                aria-label={tr("enrolCli.button")}
                style={{ marginLeft: "auto" }}
              >
                <IconTerminal size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>

          {/* Prev/Next - desktop only */}
          {!isMobile && (
            <Stack gap={6}>
              <Button.Group>
                <Button
                  variant="default"
                  size="sm"
                  radius="md"
                  style={{ flex: 1 }}
                  leftSection={<IconChevronLeft size={14} />}
                  disabled={!canGoPrevious || scheduleGenerating || !canUseSeedNavigation}
                  loading={scheduleGenerating}
                  onClick={handlePrevious}
                >
                  {tr("calendarPage.previous")}
                </Button>
                <Button
                  variant={generationOptionsDirty ? "filled" : "default"}
                  size="sm"
                  radius="md"
                  style={{ flex: 1 }}
                  rightSection={<IconChevronRight size={14} />}
                  disabled={scheduleGenerating || !canUseSeedNavigation}
                  loading={scheduleGenerating}
                  onClick={handleNext}
                >
                  {nextLabel}
                </Button>
              </Button.Group>
            </Stack>
          )}

          <Divider color="var(--app-border)" />

          <AdvancedGenerationOptions />

          <Divider color="var(--app-border)" />

          {/* Undo swap */}
          {currentSwaps.length > 0 && (
            <Button
              variant="subtle"
              color="gray"
              size="xs"
              radius="md"
              leftSection={<IconArrowBackUp size={12} />}
              onClick={() => undoLastSwap()}
              style={{ alignSelf: "flex-start", paddingInline: 6 }}
            >
              {currentSwaps.length === 1
                ? tr("calendarPage.undoSwap")
                : tr("calendarPage.undoSwapCount", { count: currentSwaps.length })}
            </Button>
          )}
        </Stack>
      )}

      <EnrolCliModal
        opened={enrolCliOpen}
        onClose={() => setEnrolCliOpen(false)}
        command={cliCommand ?? ""}
      />
      <UEnrollImportModal opened={uenrollImportOpen} onClose={() => setUenrollImportOpen(false)} />

      {scheduleNoVariety && !generationError && (
        <Alert color="yellow" variant="light" radius="md" py="xs" style={{ flexShrink: 0 }}>
          {tr(hasProgram ? "calendarPage.noMoreSchedules" : "basicCalendar.noMoreSchedules")}
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
    </>
  );

  return (
    <>
      <GenerationErrorModal error={generationError} onClose={clearGenerationError} />
      <Box
        component="main"
        data-testid="calendar-page"
        style={{
          width: "100%",
          height: "100dvh",
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          boxSizing: "border-box",
          overflow: "hidden",
        }}
      >
        {!isMobile && (
          <>
            <Box
              component="aside"
              ref={asideRef}
              aria-label="Calendar Controls"
              style={{
                width: sidebarWidth,
                height: "100%",
                flexShrink: 0,
                padding: "24px 20px",
                backgroundColor: "var(--app-surface)",
                display: "flex",
                flexDirection: "column",
                gap: 24,
                overflowY: "auto",
              }}
            >
              {sidebarControls}
            </Box>
            <div
              role="separator"
              aria-label="Resize sidebar"
              onPointerDown={handleResizePointerDown}
              onPointerMove={handleResizePointerMove}
              onPointerUp={handleResizePointerUp}
              style={{
                width: 6,
                flexShrink: 0,
                cursor: "col-resize",
                backgroundColor: "var(--app-border)",
                transition: "background-color 0.15s",
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
            <div
              ref={previewLineRef}
              aria-hidden="true"
              style={{
                display: "none",
                position: "fixed",
                top: 0,
                bottom: 0,
                width: 2,
                marginLeft: -1,
                backgroundColor: "var(--app-border-strong)",
                pointerEvents: "none",
                zIndex: 1000,
              }}
            />
          </>
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
            width: "100%",
          }}
        >
          <CalendarView
            schedule={currentSchedule}
            cache={cache}
            professorRatings={professorRatings}
            getSwapCandidates={getSwapCandidates}
            onSwap={swapCourseInSchedule}
            colorMap={currentColorMap}
            weekGroups={weekGroups}
            weekIndex={weekIndex}
            setWeekIndex={setWeekIndex}
          />
        </Box>

        {/* Mobile bottom nav */}
        {isMobile && (
          <Box
            component="nav"
            style={{
              flexShrink: 0,
              display: "flex",
              gap: 0,
              backgroundColor: "var(--app-surface)",
              borderTop: "var(--app-border-width) solid var(--app-border)",
              paddingBottom: "env(safe-area-inset-bottom, 0)",
            }}
          >
            <Button
              variant="subtle"
              color="gray"
              size="md"
              radius="md"
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
              radius="md"
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
              variant={generationOptionsDirty ? "light" : "subtle"}
              color={generationOptionsDirty ? undefined : "gray"}
              size="md"
              radius="md"
              aria-label={
                generationOptionsDirty
                  ? tr("calendarPage.generate")
                  : tr("calendarPage.mobile.next")
              }
              style={{ flex: 1, border: "none", height: 56 }}
              disabled={scheduleGenerating || !canUseSeedNavigation}
              loading={scheduleGenerating}
              onClick={handleNext}
              title={generationOptionsDirty ? tr("calendarPage.generate") : "Next schedule"}
            >
              <IconChevronRight size={22} stroke={1.75} />
            </Button>
          </Box>
        )}
      </Box>
    </>
  );
}
