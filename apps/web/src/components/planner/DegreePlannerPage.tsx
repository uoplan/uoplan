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
  const setTermCart = useGraphPlannerStore((s) => s.setTermCart);
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
  // it closely. We snapshot the real cart, seed the calendar with this term's
  // planned courses, and switch it to that term; edits are reconciled back and
  // the real cart is restored on return (effect below).
  const openInCalendar = useCallback(
    async (termId: string) => {
      const pstate = useGraphPlannerStore.getState();
      // Seed the calendar's cart with this term's pinned courses (or, if none
      // were pinned yet, its generated picks) so the student can refine them.
      const pinned = pstate.cartByTerm[termId] ?? [];
      const seed = pinned.length > 0 ? pinned : (pstate.generatedByTermId[termId]?.courses ?? []);
      const count = plannerTermCount(pstate, termId);
      const before = storeApi.getState();
      // Remember the real cart so returning to the planner restores it instead
      // of committing this term's tentative picks to the main flow.
      beginCalendarLink(termId, {
        basketCourses: [...before.basketCourses],
        coursesThisSemester: before.coursesThisSemester,
      });
      await before.setSelectedTermId(termId);
      const next = storeApi.getState();
      next.setBasketCourses(seed);
      next.setCoursesThisSemester(count);
      void navigate({ to: "/schedule" });
    },
    [storeApi, navigate, beginCalendarLink],
  );

  // When returning from the calendar, fold whatever the student ended up with for
  // the linked term back into the planner: the cart becomes the term's pinned
  // courses (forced on regenerate) and the schedule becomes its displayed plan.
  // Then restore the real cart snapshotted when opening, so the term's tentative
  // picks never linger in the main flow's cart.
  useEffect(() => {
    const planner = useGraphPlannerStore.getState();
    const linked = planner.linkedCalendarTermId;
    if (!linked) return;
    const store = storeApi.getState();
    if (store.selectedTermId === linked && planner.enabledTermIds.includes(linked)) {
      setTermCart(linked, [...store.basketCourses]);
      const plan = planCoursesFromCalendar(store.currentSchedule, store.basketCourses);
      if (plan.length > 0) {
        setGeneratedTerm({
          termId: linked,
          courses: plan,
          requestedCount: plannerTermCount(planner, linked),
          status: "ok",
          generatedAt: Date.now(),
        });
      }
    }
    const snapshot = planner.preLinkCart;
    if (snapshot) {
      store.setBasketCourses(snapshot.basketCourses);
      store.setCoursesThisSemester(snapshot.coursesThisSemester);
    }
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
