import { useCallback, useEffect, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ActionIcon, Box, Drawer, Group, Text } from "@mantine/core";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import { IconAdjustments } from "@tabler/icons-react";
import { useShallow } from "zustand/react/shallow";
import "@xyflow/react/dist/style.css";
import { i18n, tr, useTr } from "../../i18n";
import { useActiveProgram, useDataCache, useStoreApi, useTerms } from "../../store/hooks";
import { useProgramSelection } from "../../store/hooks/useProgramSelection";
import { plannerTermCount, useGraphPlannerStore } from "../../store/graphPlannerStore";
import { useGraphPlanner } from "../../lib/graphPlanner/useGraphPlanner";
import { buildPlannerGraph } from "../../lib/graphPlanner/buildPlannerGraph";
import { planCoursesFromCalendar } from "../../lib/graphPlanner/calendarBridge";
import { formatTermLabel, formatTranscriptTermLabel } from "../../lib/term/termLabel";
import { PlannerCanvas } from "./PlannerCanvas";
import { PlannerSidebar } from "./PlannerSidebar";
import { PlannerEmptyState } from "./PlannerEmptyState";
import { SidebarResizeHandle } from "../shared/SidebarResizeHandle";
import { useSidebarResize } from "../shared/useSidebarResize";
import { PlannerActionsProvider } from "./plannerActionsContext";
import type { PlannerActions } from "./plannerActionsContext";
import { computeFutureTermColumns } from "./plannerColumns";
import styles from "./planner.module.css";

export function DegreePlannerPage() {
  useTr();
  const locale = i18n.locale;
  const navigate = useNavigate();
  const cache = useDataCache();
  const program = useActiveProgram();
  const { studentPrograms } = useProgramSelection();
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
  const setNodePosition = useGraphPlannerStore((s) => s.setNodePosition);
  const resetLayout = useGraphPlannerStore((s) => s.resetLayout);
  const setGeneratedTerm = useGraphPlannerStore((s) => s.setGeneratedTerm);
  const setTermResult = useGraphPlannerStore((s) => s.setTermResult);
  const setCountForTerm = useGraphPlannerStore((s) => s.setCountForTerm);
  const beginCalendarLink = useGraphPlannerStore((s) => s.beginCalendarLink);
  const endCalendarLink = useGraphPlannerStore((s) => s.endCalendarLink);

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
      studentPrograms,
      positions: nodePositions,
    });
    // `locale` is a dep because `formatTermLabel` reads the active i18n locale.
    // oxlint-disable-next-line react/exhaustive-deps
  }, [futureColumns, completedCourseTerms, cache, studentPrograms, nodePositions, locale]);

  const goToPersonalize = useCallback(() => {
    void navigate({ to: "/personalize" });
  }, [navigate]);

  // Open a future term in the single-term calendar view so the student can tweak
  // it closely. We forward *only* this term's exact generated schedule (so the
  // calendar matches the graph) and its course count; the real basket is left
  // untouched. We snapshot the prior course count so returning restores it.
  const openInCalendar = useCallback(
    async (termId: string) => {
      const pstate = useGraphPlannerStore.getState();
      const bundle = pstate.resultByTermId[termId];
      const count = plannerTermCount(pstate, termId);
      const before = storeApi.getState();
      // Remember only the real course count so returning restores it; the basket
      // is never modified here, so nothing else needs snapshotting.
      beginCalendarLink(termId, before.coursesThisSemester);
      // Switch the calendar to this term. This wipes `currentSchedule` and
      // recomputes requirement state, so the forwarded schedule must be applied
      // afterwards.
      await before.setSelectedTermId(termId);
      const next = storeApi.getState();
      if (bundle) {
        // Show the term's exact schedule from the graph, without regenerating.
        next.applyPlannerTermSchedule(bundle, count);
      } else {
        // No retained schedule (e.g. after a reload cleared the in-memory map):
        // just carry the count over and let the student generate.
        next.setCoursesThisSemester(count);
      }
      void navigate({ to: "/schedule" });
    },
    [storeApi, navigate, beginCalendarLink],
  );

  // When returning from the calendar, fold whatever the student ended up with for
  // the linked term back into the planner: its schedule becomes the term's
  // displayed plan (and re-openable bundle) and any course-count change carries
  // back. Then restore the real course count snapshotted on open. The real
  // basket was never touched, so there is nothing to restore there.
  useEffect(() => {
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
    const priorCount = planner.preLinkCoursesThisSemester;
    if (priorCount !== null) store.setCoursesThisSemester(priorCount);
    endCalendarLink();
    // Reconcile once, on mount, after navigating back from the calendar.
    // oxlint-disable-next-line react/exhaustive-deps
  }, []);

  const handleNodePositionCommit = useCallback(
    (id: string, pos: { x: number; y: number }) => setNodePosition(id, pos),
    [setNodePosition],
  );

  const actions = useMemo<PlannerActions>(
    () => ({
      hasProgram: program !== null,
      isGenerating: planner.isGenerating,
      runningTermId: planner.runningTermId,
      enableTerm: (id) => void planner.enableTerm(id),
      disableTerm: (id) => void planner.disableTerm(id),
      changeCount: (id, count) => void planner.changeCount(id, count),
      regenerateTerm: (id) => void planner.regenerateFrom(id),
      openInCalendar: (id) => void openInCalendar(id),
      goToPersonalize,
    }),
    [program, planner, openInCalendar, goToPersonalize],
  );

  const [drawerOpened, drawer] = useDisclosure(false);
  const isMobile = useMediaQuery("(max-width: 768px)", false, { getInitialValueInEffect: false });
  const sidebarResize = useSidebarResize();

  const hasContent = graph.courseNodes.length > 0 || graph.bandNodes.length > 0;

  const sidebar = (
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
    />
  );

  return (
    <PlannerActionsProvider value={actions}>
      <div className={styles.page}>
        {isMobile ? (
          <Group justify="space-between" align="center" px={4}>
            <Text fz="lg" fw={700}>
              {tr("planner.title")}
            </Text>
            <ActionIcon
              variant="light"
              size="lg"
              aria-label={tr("planner.options.title")}
              onClick={drawer.open}
            >
              <IconAdjustments size={18} />
            </ActionIcon>
          </Group>
        ) : null}

        {hasContent ? (
          <div className={styles.body}>
            {isMobile ? null : (
              <>
                <Box
                  className={styles.sidebar}
                  ref={sidebarResize.asideRef}
                  style={{ width: sidebarResize.width }}
                >
                  {sidebar}
                </Box>
                <SidebarResizeHandle controller={sidebarResize} />
              </>
            )}
            <div className={styles.canvasWrap}>
              <PlannerCanvas
                graph={graph}
                onNodePositionCommit={handleNodePositionCommit}
                onResetLayout={resetLayout}
              />
            </div>
          </div>
        ) : (
          <PlannerEmptyState hasProgram={program !== null} onPersonalize={goToPersonalize} />
        )}
      </div>

      <Drawer
        opened={drawerOpened && isMobile}
        onClose={drawer.close}
        position="right"
        size="min(88vw, 360px)"
        title={tr("planner.title")}
      >
        {sidebar}
      </Drawer>
    </PlannerActionsProvider>
  );
}
