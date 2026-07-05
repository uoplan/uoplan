import "./calendar.css";
import { useEffect, useRef, useState } from "react";
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Divider,
  Group,
  Stack,
  Text,
  Title,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import { useHotkeys, useMediaQuery } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconArrowBackUp,
  IconArrowsShuffle,
  IconCalendarDown,
  IconChevronLeft,
  IconChevronRight,
  IconEraser,
  IconFileImport,
  IconInfoCircle,
  IconSettings,
  IconTerminal,
} from "@tabler/icons-react";
import {
  useActiveProgram,
  useAdditionalElectives,
  useCalendarView,
  useDataCache,
  useGetShareUrl,
  useIndices,
  useProfessorRatings,
  useScheduleGeneration,
  useScheduleResultMaps,
  useScheduleSwaps,
  useSeedNavigation,
  useStoreApi,
  useTermSelection,
} from "../../store/hooks";
import { useBasketCourses } from "../../hooks/useBasket";
import { useGraphPlannerStore } from "../../store/graphPlannerStore";
import { CalendarView } from "./CalendarView";
import { BackButton } from "../shared/BackButton";
import { PersonalizeBanner } from "../shared/PersonalizeBanner";
import { buildScheduleIcs, normalizeCourseCode } from "@uoplan/core";
import { downloadTextFile } from "../../lib/downloadFile";
import { useShareUrl } from "../../hooks/useShareUrl";
import { useTimetableDateRangeFromSchedule } from "../../hooks/useTimetableDateRange";
import { useGenerationErrorToast } from "../../hooks/useGenerationErrorToast";
import { GenerationErrorModal } from "../GenerationErrorModal";
import type { GenerationErrorState } from "../../store/types";
import { useGenerationSentiment } from "../../hooks/useGenerationSentiment";
import { tr, useTr } from "../../i18n";
import { useAnalytics } from "../../lib/analytics";
import { canGenerateBasicSchedule } from "../../lib/basicCalendarPins";
import { canGoToPreviousSeed } from "../../lib/seedNavigation";
import { SidebarResizeHandle } from "../shared/SidebarResizeHandle";
import { useSidebarResize } from "../shared/useSidebarResize";
import { BasicCalendarHeaderActions } from "./BasicCalendarHeaderActions";
import { CalendarMobileDrawer } from "./CalendarMobileDrawer";
import { EnrolCliModal } from "./EnrolCliModal";
import { UEnrollImportModal } from "./UEnrollImportModal";
import { AdvancedGenerationOptions } from "./AdvancedGenerationOptions";
import { BasicGenerationOptions } from "./BasicGenerationOptions";
import { SaveStatusIndicator } from "./SaveStatusIndicator";
import { CalendarShareAction } from "./CalendarShareAction";
import { encodeSchedulePayload } from "../../lib/encodeSchedulePayload";
import { useScheduleWeeks } from "../../hooks/useScheduleWeeks";
import { formatWeekLabel } from "../../lib/formatWeekCount";
import { cancelScheduleGeneration } from "../../workers/scheduleWorkerClient";

type ScheduleNavigationButtonsProps = {
  canGoPrevious: boolean;
  canUseSeedNavigation: boolean;
  generationOptionsDirty: boolean;
  nextLabel: string;
  scheduleGenerating: boolean;
  onNext: () => void;
  onPrevious: () => void;
};

function ScheduleNavigationButtons({
  canGoPrevious,
  canUseSeedNavigation,
  generationOptionsDirty,
  nextLabel,
  scheduleGenerating,
  onNext,
  onPrevious,
}: ScheduleNavigationButtonsProps) {
  useTr();
  return (
    <Button.Group>
      <Button
        variant="default"
        size="sm"
        radius="md"
        style={{ flex: 1 }}
        leftSection={<IconChevronLeft size={14} />}
        disabled={!canGoPrevious || scheduleGenerating || !canUseSeedNavigation}
        loading={scheduleGenerating}
        onClick={onPrevious}
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
        onClick={onNext}
      >
        {nextLabel}
      </Button>
    </Button.Group>
  );
}

export interface CalendarPageProps {
  /**
   * When the calendar is rendered inside the degree planner's in-page overlay
   * (instead of as the standalone `/schedule` route), this closes the overlay.
   * The planner's back affordance then returns to the graph without navigating.
   */
  onExit?: () => void;
}

export function CalendarPage({ onExit }: CalendarPageProps = {}) {
  const analytics = useAnalytics();
  const viewedScheduleKey = useRef<string | null>(null);

  useEffect(() => {
    document.documentElement.classList.add("calendar-no-scrollbar-gutter");
    return () => {
      document.documentElement.classList.remove("calendar-no-scrollbar-gutter");
    };
  }, []);

  const storeApi = useStoreApi();
  useEffect(() => {
    // Cancel an in-flight generation the moment the user changes a generation
    // option (any setter flips generationOptionsDirty to true). The previous
    // schedule stays put and the now-dirty options prompt a manual re-run.
    return storeApi.subscribe((next, prev) => {
      if (next.scheduleGenerating && next.generationOptionsDirty && !prev.generationOptionsDirty) {
        cancelScheduleGeneration();
        notifications.show({
          color: "gray",
          title: tr("notifications.scheduleGenerationCancelled.title"),
          message: tr("notifications.scheduleGenerationCancelled.message"),
        });
      }
    });
  }, [storeApi]);

  const {
    currentSchedule,
    scheduleGenerating,
    generationError,
    generationOptionsDirty,
    generateSchedules,
    clearGenerationOptions,
    resetBasicCalendarSettings,
  } = useScheduleGeneration();
  const { currentSwaps, getSwapCandidates, swapCourseInSchedule, undoLastSwap } =
    useScheduleSwaps();
  const { currentColorMap } = useScheduleResultMaps();
  const {
    currentSeed,
    lowestVisitedSeed,
    scheduleNoVariety,
    goToPreviousSeed,
    goToNextSeed,
    randomizeSeed,
  } = useSeedNavigation();
  const indices = useIndices();
  const cache = useDataCache();
  const professorRatings = useProfessorRatings();
  const basketCourses = useBasketCourses();
  const { additionalElectivesCount } = useAdditionalElectives();
  const { selectedTermId } = useTermSelection();
  const program = useActiveProgram();

  // When a term is opened from the degree planner it links that term into this
  // calendar (see `openInCalendar`). While that link is live for the term on
  // screen, the back affordance returns to the planner (not the generic
  // personalize dashboard) and names it accordingly.
  const linkedCalendarTermId = useGraphPlannerStore((s) => s.linkedCalendarTermId);
  const openedFromPlanner =
    linkedCalendarTermId !== null && linkedCalendarTermId === selectedTermId;

  const hasProgram = program !== null;

  useEffect(() => {
    if (!currentSchedule) return;
    const key = `${selectedTermId ?? "unknown"}:${currentSeed}`;
    if (viewedScheduleKey.current === key) return;
    viewedScheduleKey.current = key;
    analytics.capture("schedule_viewed");
  }, [analytics, currentSchedule, currentSeed, selectedTermId]);

  const { setCalendarMode, calendarWeekIndex, setCalendarWeekIndex } = useCalendarView();
  // Sync the active calendar mode so generation logic knows which path is active.
  useEffect(() => {
    setCalendarMode(hasProgram ? "advanced" : "basic");
    return () => setCalendarMode(null);
  }, [hasProgram, setCalendarMode]);

  const { weekGroups, weekIndex, setWeekIndex } = useScheduleWeeks(
    currentSchedule,
    calendarWeekIndex,
  );

  useEffect(() => {
    setCalendarWeekIndex(weekIndex);
  }, [weekIndex, setCalendarWeekIndex]);

  const [generationErrorDetail, setGenerationErrorDetail] = useState<GenerationErrorState | null>(
    null,
  );
  useGenerationErrorToast(generationError, (error) => {
    analytics.capture("generation_error_details_opened", { kind: error.message.kind });
    setGenerationErrorDetail(error);
  });
  useGenerationSentiment();

  const getShareUrl = useGetShareUrl();

  const canGoPrevious = canGoToPreviousSeed(currentSeed, lowestVisitedSeed);
  const canUseSeedNavigation =
    hasProgram || canGenerateBasicSchedule(basketCourses.length, additionalElectivesCount);

  const [controlsOpen, setControlsOpen] = useState(false);
  const [enrolCliOpen, setEnrolCliOpen] = useState(false);
  const [uenrollImportOpen, setUenrollImportOpen] = useState(false);
  const sidebarResize = useSidebarResize();
  const sidebarWidth = sidebarResize.width;

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

  const noTimeslotCourses =
    currentSchedule?.enrollments
      .filter((enrollment) => enrollment.times.length === 0)
      .map((enrollment) => {
        const title = cache?.getCourse(enrollment.courseCode)?.title.trim();
        return {
          code: enrollment.courseCode,
          title: title || null,
        };
      }) ?? [];

  const noTimeslotBanner =
    noTimeslotCourses.length > 0 ? (
      <Alert
        icon={<IconInfoCircle size={16} />}
        radius="md"
        py="xs"
        data-testid="no-timeslot-banner"
        style={{
          flexShrink: 0,
          backgroundColor: "var(--app-info-soft)",
          border: "1px solid var(--app-info)",
        }}
      >
        <Group gap={6} align="center" wrap="wrap">
          <Text size="xs" fw={600} style={{ color: "var(--app-text)" }}>
            {tr("calendarPage.noTimeslotCourses.title")}
          </Text>
          {noTimeslotCourses.map((course) => (
            <Badge
              key={course.code}
              size="sm"
              variant="light"
              color="gray"
              title={course.title ? `${course.code}: ${course.title}` : course.code}
            >
              {course.code}
            </Badge>
          ))}
        </Group>
      </Alert>
    ) : null;

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
    analytics.capture("schedule_exported", { target: "ics" });
    const ics = buildScheduleIcs({
      schedule: currentSchedule,
      cache,
      startDate: timetableStartDate,
      endDate: timetableEndDate,
    });
    const filename = `uoplan-schedule-${currentSeed}-${timetableStartDate}-to-${timetableEndDate}.ics`;
    downloadTextFile(filename, ics, "text/calendar;charset=utf-8");
  };

  const calendarTitle = tr("calendarPage.title");
  const calendarSubtitle = tr(hasProgram ? "calendarPage.subtitle" : "basicCalendar.subtitle");

  const sidebarControls = (
    <>
      {onExit ? (
        <UnstyledButton
          onClick={onExit}
          aria-label={tr("planner.title")}
          style={{ alignSelf: "flex-start", color: "var(--mantine-color-dimmed)" }}
        >
          <Group gap={2} wrap="nowrap">
            <IconChevronLeft size={15} stroke={1.8} />
            <Text size="sm" c="dimmed">
              {tr("planner.title")}
            </Text>
          </Group>
        </UnstyledButton>
      ) : openedFromPlanner ? (
        <BackButton fallbackTo="/schedule/graph" fallbackLabel={tr("planner.title")} />
      ) : (
        <BackButton fallbackTo="/personalize" />
      )}
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

      <PersonalizeBanner variant="sidebar" />

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
            <ScheduleNavigationButtons
              canGoPrevious={canGoPrevious}
              canUseSeedNavigation={canUseSeedNavigation}
              generationOptionsDirty={generationOptionsDirty}
              nextLabel={nextLabel}
              scheduleGenerating={scheduleGenerating}
              onNext={handleNext}
              onPrevious={handlePrevious}
            />
          )}
          {noTimeslotBanner}
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
            <CalendarShareAction
              show={Boolean(indices)}
              copied={shareCopied}
              onCopy={handleCopyShare}
            />
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
              <ScheduleNavigationButtons
                canGoPrevious={canGoPrevious}
                canUseSeedNavigation={canUseSeedNavigation}
                generationOptionsDirty={generationOptionsDirty}
                nextLabel={nextLabel}
                scheduleGenerating={scheduleGenerating}
                onNext={handleNext}
                onPrevious={handlePrevious}
              />
            </Stack>
          )}

          <Divider color="var(--app-border)" />

          {noTimeslotBanner}

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
    </>
  );

  return (
    <>
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
              ref={sidebarResize.asideRef}
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
            <SidebarResizeHandle controller={sidebarResize} />
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
            onSwap={(enrollmentIndex, newCourseCode) => {
              analytics.capture("schedule_swapped_course", { courseCode: newCourseCode });
              void swapCourseInSchedule(enrollmentIndex, normalizeCourseCode(newCourseCode));
            }}
            colorMap={currentColorMap}
            weekGroups={weekGroups}
            weekIndex={weekIndex}
            setWeekIndex={setWeekIndex}
          />
        </Box>

        {/* Mobile week navigation bar (above the bottom nav) */}
        {isMobile && weekGroups.length > 0 && (
          <Box
            style={{
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 12px",
              backgroundColor: "var(--app-surface)",
              borderTop: "var(--app-border-width) solid var(--app-border)",
            }}
          >
            <ActionIcon
              variant="subtle"
              color="gray"
              size="md"
              radius="md"
              aria-label={tr("calendarView.previousWeek")}
              disabled={weekIndex === 0}
              onClick={() => setWeekIndex(weekIndex - 1)}
            >
              <IconChevronLeft size={18} />
            </ActionIcon>
            <Text size="xs" c="dimmed" style={{ flex: 1, textAlign: "center" }}>
              {formatWeekLabel(weekGroups, weekIndex)}
            </Text>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="md"
              radius="md"
              aria-label={tr("calendarView.nextWeek")}
              disabled={weekIndex === weekGroups.length - 1}
              onClick={() => setWeekIndex(weekIndex + 1)}
            >
              <IconChevronRight size={18} />
            </ActionIcon>
          </Box>
        )}

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
      <GenerationErrorModal
        error={generationErrorDetail}
        onClose={() => setGenerationErrorDetail(null)}
      />
    </>
  );
}
