import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AnimatePresence, m } from "framer-motion";
import { Modal, UnstyledButton } from "@mantine/core";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import { IconAdjustments } from "@tabler/icons-react";
import { useShallow } from "zustand/react/shallow";
import "@xyflow/react/dist/style.css";
import { i18n, tr, useTr } from "../../i18n";
import { useActiveProgram, useDataCache, useStoreApi, useTerms } from "../../store/hooks";
import { plannerTermCount, useGraphPlannerStore } from "../../store/graphPlannerStore";
import { useGraphPlanner } from "../../lib/graphPlanner/useGraphPlanner";
import { buildPlannerGraph } from "../../lib/graphPlanner/buildPlannerGraph";
import { planCoursesFromCalendar } from "../../lib/graphPlanner/calendarBridge";
import { downloadAllTermsIcs, downloadTermIcs } from "../../lib/graphPlanner/downloadPlannerIcs";
import { formatTermLabel, formatTranscriptTermLabel } from "../../lib/term/termLabel";
import { PlannerCanvas } from "./PlannerCanvas";
import { PlannerSidebar } from "./PlannerSidebar";
import { PlannerEmptyState } from "./PlannerEmptyState";
import { FloatingPlannerPanel } from "./FloatingPlannerPanel";
import { CalendarPage } from "../calendar/CalendarPage";
import { BottomDrawer } from "../shared/BottomDrawer";
import { PlannerActionsProvider } from "./plannerActionsContext";
import type { PlannerActions } from "./plannerActionsContext";
import { computeFutureTermColumns } from "./plannerColumns";
import { CALENDAR_OVERLAY_CARD_LEFT, CALENDAR_OVERLAY_MARGIN } from "./plannerCalendarOverlay";
import styles from "./planner.module.css";

export function DegreePlannerPage() {
  useTr();
  const locale = i18n.locale;
  const navigate = useNavigate();
  const cache = useDataCache();
  const program = useActiveProgram();
  const terms = useTerms();
  const storeApi = useStoreApi();

  const { completedCourseTerms, hasTranscript, defaultCount, enabledTermIds, generatedByTermId } =
    useGraphPlannerStore(
      useShallow((s) => ({
        completedCourseTerms: s.completedCourseTerms,
        hasTranscript: s.hasTranscript,
        defaultCount: s.defaultCount,
        enabledTermIds: s.enabledTermIds,
        generatedByTermId: s.generatedByTermId,
      })),
    );
  const clearPlannedTerms = useGraphPlannerStore((s) => s.clearPlannedTerms);
  const nodePositions = useGraphPlannerStore((s) => s.nodePositions);
  const nodeSizes = useGraphPlannerStore((s) => s.nodeSizes);
  const setNodePosition = useGraphPlannerStore((s) => s.setNodePosition);
  const resetLayout = useGraphPlannerStore((s) => s.resetLayout);
  const setGeneratedTerm = useGraphPlannerStore((s) => s.setGeneratedTerm);
  const setTermResult = useGraphPlannerStore((s) => s.setTermResult);
  const setCountForTerm = useGraphPlannerStore((s) => s.setCountForTerm);
  const beginCalendarLink = useGraphPlannerStore((s) => s.beginCalendarLink);
  const endCalendarLink = useGraphPlannerStore((s) => s.endCalendarLink);
  const setSelectedTermId = useGraphPlannerStore((s) => s.setSelectedTermId);
  const selectedTermId = useGraphPlannerStore((s) => s.selectedTermId);

  const planner = useGraphPlanner();

  const futureColumns = useMemo(
    () =>
      computeFutureTermColumns(terms ?? [], completedCourseTerms, {
        enabledTermIds,
        generatedByTermId,
      }),
    [terms, completedCourseTerms, enabledTermIds, generatedByTermId],
  );

  const graph = useMemo(() => {
    const completedTerms = completedCourseTerms.map((term) => ({
      ...term,
      label: formatTranscriptTermLabel(term),
    }));
    const futureTerms = futureColumns.map((col) => ({
      termId: col.termId,
      label: formatTermLabel(col.termId),
      enabled: col.enabled,
      courses: col.courses,
      status: col.status,
    }));
    return buildPlannerGraph({
      completedTerms,
      futureTerms,
      cache,
      positions: nodePositions,
      sizes: nodeSizes,
    });
    // `locale` is a dep because `formatTermLabel` reads the active i18n locale.
    // oxlint-disable-next-line react/exhaustive-deps
  }, [futureColumns, completedCourseTerms, cache, nodePositions, nodeSizes, locale]);

  const goToPersonalize = useCallback(() => {
    void navigate({ to: "/personalize" });
  }, [navigate]);

  // Which future term is expanded into the in-page calendar overlay (null = none).
  const [expandedTermId, setExpandedTermId] = useState<string | null>(null);

  // Open a future term in the single-term calendar view so the student can tweak
  // it closely. We treat every earlier planned term as already completed (so the
  // calendar generates exactly like the graph — and like the normal flow with
  // those courses taken), forward this term's exact schedule so it opens showing
  // the same timetable, and carry its course count over. The real basket is left
  // untouched. The student's real generation context is snapshotted so returning
  // restores it, and persistence is suppressed while linked so the hypothetical
  // completed set never overwrites their saved state.
  const openInCalendar = useCallback(
    async (termId: string) => {
      const pstate = useGraphPlannerStore.getState();
      const bundle = pstate.resultByTermId[termId];
      const count = plannerTermCount(pstate, termId);
      const before = storeApi.getState();
      // Snapshot the real generation context so returning restores it exactly.
      beginCalendarLink(termId, {
        completedCourses: before.completedCourses,
        selectedTermId: before.selectedTermId,
        schedulesData: before.schedulesData,
        cache: before.cache,
        coursesThisSemester: before.coursesThisSemester,
        remainingRequirements: before.remainingRequirements,
        requirementTreeWithStatus: before.requirementTreeWithStatus,
        completedRequirementsList: before.completedRequirementsList,
        selectedPerRequirement: before.selectedPerRequirement,
        selectedOptionsPerRequirement: before.selectedOptionsPerRequirement,
        prereqEligibleCourses: before.prereqEligibleCourses,
        filteredPrereqEligibleCourses: before.filteredPrereqEligibleCourses,
        unassignedCompletedCourses: before.unassignedCompletedCourses,
      });
      // Fold every earlier enabled term's picks into the completed set, mirroring
      // useGraphPlanner.regenerateFrom, so this term generates as if the prior
      // ones were already taken.
      const threshold = Number(termId);
      const effectiveCompleted = new Set(before.completedCourses);
      for (const id of pstate.enabledTermIds) {
        if (Number(id) < threshold) {
          for (const code of pstate.generatedByTermId[id]?.courses ?? []) {
            effectiveCompleted.add(code);
          }
        }
      }
      // Apply the hypothetical completed set, then switch to this term.
      // setSelectedTermId rebuilds the cache + recomputes all requirement state
      // from completedCourses, so setting it first makes the calendar (options
      // panel + generation) treat prior terms as done. It also wipes
      // `currentSchedule`, so the forwarded schedule is applied afterwards.
      storeApi.setState({ completedCourses: [...effectiveCompleted] });
      await storeApi.getState().setSelectedTermId(termId);
      const next = storeApi.getState();
      if (bundle) {
        // Show the term's exact schedule from the graph, without regenerating.
        next.applyPlannerTermSchedule(bundle, count);
      } else {
        // No retained schedule (e.g. after a reload cleared the in-memory map):
        // carry the count over and let the student generate against this context.
        next.setCoursesThisSemester(count);
      }
      // Expand the calendar in place over the graph instead of navigating away.
      setExpandedTermId(termId);
    },
    [storeApi, beginCalendarLink],
  );

  // Fold whatever the student ended up with for the linked term back into the
  // planner: its schedule becomes the term's displayed plan (and re-openable
  // bundle) and any course-count change carries back. Then restore the real
  // generation context snapshotted on open. The real basket was never touched, so
  // there is nothing to restore there. Shared by the overlay-close handler and a
  // mount-time safety net (for a reload that happened mid-link).
  const reconcileLinkedTerm = useCallback(() => {
    const planner = useGraphPlannerStore.getState();
    const linked = planner.linkedCalendarTermId;
    if (!linked) return;
    const store = storeApi.getState();
    if (store.selectedTermId === linked && planner.enabledTermIds.includes(linked)) {
      const plan = planCoursesFromCalendar(store.currentSchedule, store.basketCourses);
      const newCount = store.coursesThisSemester;
      setCountForTerm(linked, newCount);
      // Keep the exact calendar schedule so re-opening this term still matches.
      setTermResult(linked, {
        currentSchedule: store.currentSchedule,
        swapPool: store.swapPool,
        chosenCourseToRequirementId: store.chosenCourseToRequirementId,
        currentPoolMap: store.currentPoolMap,
        currentColorMap: store.currentColorMap,
        generationError: store.generationError,
      });
      if (plan.length > 0) {
        setGeneratedTerm({
          termId: linked,
          courses: plan,
          requestedCount: newCount,
          status: "ok",
          generatedAt: Date.now(),
        });
      }
    }
    // Restore the student's real generation context (completed set, requirement
    // state, term, count) so the planner reflects their true progress again.
    const snapshot = planner.preLinkCompletedContext;
    if (snapshot) storeApi.setState({ ...snapshot });
    endCalendarLink();
  }, [storeApi, setCountForTerm, setTermResult, setGeneratedTerm, endCalendarLink]);

  const closeExpandedCalendar = useCallback(() => {
    reconcileLinkedTerm();
    setExpandedTermId(null);
  }, [reconcileLinkedTerm]);

  // Safety net: if the app was reloaded while a term was linked into the calendar
  // (the in-memory snapshot is gone but the persisted link id remains), clear the
  // stale link on mount so the planner isn't stuck suppressing persistence.
  useEffect(() => {
    reconcileLinkedTerm();
    // Reconcile once on mount only.
    // oxlint-disable-next-line react/exhaustive-deps
  }, []);

  const handleNodePositionCommit = useCallback(
    (id: string, pos: { x: number; y: number }) => setNodePosition(id, pos),
    [setNodePosition],
  );

  const downloadTerm = useCallback(
    (termId: string) => {
      const bundle = useGraphPlannerStore.getState().resultByTermId[termId];
      downloadTermIcs({ termId, label: formatTermLabel(termId), bundle }, cache);
    },
    [cache],
  );

  const downloadAllTerms = useCallback(() => {
    const pstate = useGraphPlannerStore.getState();
    const terms = pstate.enabledTermIds.map((termId) => ({
      termId,
      label: formatTermLabel(termId),
      bundle: pstate.resultByTermId[termId],
    }));
    downloadAllTermsIcs(terms, cache);
  }, [cache]);

  const actions = useMemo<PlannerActions>(
    () => ({
      hasProgram: program !== null,
      isGenerating: planner.isGenerating,
      runningTermId: planner.runningTermId,
      selectedTermId,
      enableTerm: (id) => void planner.enableTerm(id),
      disableTerm: (id) => void planner.disableTerm(id),
      changeCount: (id, count) => void planner.changeCount(id, count),
      regenerateTerm: (id) => void planner.regenerateFrom(id),
      previousTerm: (id) => void planner.previousTermVariant(id),
      openInCalendar: (id) => void openInCalendar(id),
      selectTerm: setSelectedTermId,
      downloadTerm,
      downloadAllTerms,
      goToPersonalize,
    }),
    [
      program,
      planner,
      selectedTermId,
      openInCalendar,
      setSelectedTermId,
      downloadTerm,
      downloadAllTerms,
      goToPersonalize,
    ],
  );

  const [drawerOpened, drawer] = useDisclosure(false);
  const isMobile = useMediaQuery("(max-width: 768px)", false, { getInitialValueInEffect: false });

  const hasContent = graph.courseNodes.length > 0 || graph.bandNodes.length > 0;

  // Clicking a term node focuses it in the panel; on mobile also surface the
  // drawer so the newly-focused term's controls are immediately reachable.
  const handleSelectTerm = useCallback(
    (termId: string) => {
      setSelectedTermId(termId);
      if (isMobile) drawer.open();
    },
    [setSelectedTermId, isMobile, drawer],
  );

  // Desktop only: the "open in calendar" experience is a floating two-card
  // overlay above the dimmed graph; mobile keeps the fullscreen Modal.
  const calendarMode = expandedTermId !== null && !isMobile;

  // Leaving the linked term's tab (Overview or another term) exits calendar
  // mode, mirroring the minimize control and keeping the tab + overlay in sync.
  useEffect(() => {
    if (expandedTermId !== null && selectedTermId !== expandedTermId) {
      closeExpandedCalendar();
    }
  }, [selectedTermId, expandedTermId, closeExpandedCalendar]);

  // Esc closes the desktop calendar overlay (the mobile Modal handles its own).
  useEffect(() => {
    if (!calendarMode) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeExpandedCalendar();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [calendarMode, closeExpandedCalendar]);

  const renderSidebar = (showLayoutActions: boolean, sidebarCalendarMode = false) => (
    <PlannerSidebar
      hasProgram={program !== null}
      hasTranscript={hasTranscript}
      isGenerating={planner.isGenerating}
      hasEnabledTerms={enabledTermIds.length > 0}
      defaultCount={defaultCount}
      onDefaultCountChange={planner.setDefaultCount}
      onRegenerateAll={() => void planner.regenerateAll()}
      onClearPlan={clearPlannedTerms}
      onResetLayout={resetLayout}
      onPersonalize={goToPersonalize}
      showLayoutActions={showLayoutActions}
      calendarMode={sidebarCalendarMode}
    />
  );

  return (
    <PlannerActionsProvider value={actions}>
      <div className={styles.page}>
        {hasContent ? (
          <div className={styles.body}>
            <div className={styles.canvasWrap}>
              <PlannerCanvas
                graph={graph}
                onNodePositionCommit={handleNodePositionCommit}
                onResetLayout={resetLayout}
                onSelectTerm={handleSelectTerm}
              />
              {isMobile ? (
                <UnstyledButton
                  className={styles.mobilePanelTrigger}
                  onClick={drawer.open}
                  aria-label={tr("planner.options.title")}
                >
                  <IconAdjustments size={17} />
                  {tr("planner.title")}
                </UnstyledButton>
              ) : (
                <FloatingPlannerPanel
                  title={
                    calendarMode && expandedTermId
                      ? formatTermLabel(expandedTermId)
                      : tr("planner.title")
                  }
                  onResetLayout={resetLayout}
                  onClearPlan={clearPlannedTerms}
                  clearDisabled={planner.isGenerating || enabledTermIds.length === 0}
                  calendarMode={calendarMode}
                  onExitCalendar={closeExpandedCalendar}
                >
                  {renderSidebar(false, calendarMode)}
                </FloatingPlannerPanel>
              )}

              <AnimatePresence>
                {calendarMode && expandedTermId
                  ? [
                      <m.div
                        key="calendar-scrim"
                        className={styles.calendarScrim}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        onClick={closeExpandedCalendar}
                        aria-hidden
                      />,
                      <m.div
                        key="calendar-card"
                        className={styles.calendarCard}
                        style={{
                          top: CALENDAR_OVERLAY_MARGIN,
                          right: CALENDAR_OVERLAY_MARGIN,
                          bottom: CALENDAR_OVERLAY_MARGIN,
                          left: CALENDAR_OVERLAY_CARD_LEFT,
                          transformOrigin: "left center",
                        }}
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.97 }}
                        transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                      >
                        <CalendarPage variant="embedded" onExit={closeExpandedCalendar} />
                      </m.div>,
                    ]
                  : null}
              </AnimatePresence>
            </div>
          </div>
        ) : (
          <PlannerEmptyState hasProgram={program !== null} onPersonalize={goToPersonalize} />
        )}
      </div>

      <BottomDrawer
        opened={drawerOpened && isMobile}
        onClose={drawer.close}
        title={tr("planner.title")}
      >
        <div className={styles.mobileDrawerBody}>{renderSidebar(true)}</div>
      </BottomDrawer>

      <Modal
        opened={expandedTermId !== null && isMobile}
        onClose={closeExpandedCalendar}
        fullScreen
        withCloseButton={false}
        padding={0}
        zIndex={150}
        transitionProps={{ transition: "scale", duration: 160 }}
        styles={{ body: { height: "100dvh", padding: 0 } }}
        aria-label={expandedTermId ? formatTermLabel(expandedTermId) : tr("calendarPage.title")}
      >
        {expandedTermId ? <CalendarPage onExit={closeExpandedCalendar} /> : null}
      </Modal>
    </PlannerActionsProvider>
  );
}
