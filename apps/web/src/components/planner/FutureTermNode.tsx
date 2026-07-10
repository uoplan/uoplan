import { memo, useRef } from "react";
import { Badge, Loader } from "@mantine/core";
import { IconArrowsDiagonal } from "@tabler/icons-react";
import { Handle, NodeResizeControl, Position } from "@xyflow/react";
import type { Node, NodeProps, ResizeParams } from "@xyflow/react";
import { tr } from "../../i18n";
import { useDataCache, useProfessorRatings } from "@uoplan/store/hooks";
import { useGraphPlannerStore } from "../../store/graphPlannerStore";
import type { PlannerTermStatus } from "../../store/graphPlannerStore";
import type { PlannerBandData } from "../../lib/graphPlanner/buildPlannerGraph";
import { PLANNER_FUTURE_MIN_SIZE } from "../../lib/graphPlanner/buildPlannerGraph";
import type { GenerateSchedulesResult } from "../../lib/generateSchedulesAction";
import { usePlannerActions } from "./plannerActionsContext";
import { PlannerTermCalendar } from "./PlannerTermCalendar";
import styles from "./planner.module.css";

type FutureFlowNode = Node<PlannerBandData, "futureTerm">;

const STATUS_COLOR: Record<PlannerTermStatus, string> = {
  ok: "green",
  partial: "yellow",
  empty: "gray",
  error: "red",
};

function statusLabel(status: PlannerTermStatus): string {
  switch (status) {
    case "ok":
      return tr("planner.status.ok");
    case "partial":
      return tr("planner.status.partial");
    case "empty":
      return tr("planner.status.empty");
    case "error":
      return tr("planner.status.error");
  }
}

/**
 * The calendar body of an enabled future term. Reads the term's retained
 * schedule bundle from the planner store and renders it in the same read-only
 * week calendar the rest of the app uses, so the graph shows the real timetable.
 * While regenerating it keeps the previous schedule mounted (dimmed, with a
 * spinner) so the schedule-change animation can play instead of the calendar
 * collapsing to a loader. Falls back to a hint when the term came back empty or
 * when an older persisted plan has no retained schedule to draw.
 */
function FutureTermBody({
  termId,
  courseCount,
  status,
  running,
}: {
  termId: string;
  courseCount: number;
  status: PlannerTermStatus | undefined;
  running: boolean;
}) {
  const cache = useDataCache();
  const professorRatings = useProfessorRatings();
  const bundle = useGraphPlannerStore((s) => s.resultByTermId[termId]);

  // Keep the last drawn schedule so a mid-regeneration clear (bundle briefly
  // undefined while the term recomputes) doesn't unmount the calendar. Staying
  // mounted lets PlannerTermCalendar animate the exit -> enter on the new
  // schedule. A term that *settles* with no schedule (empty / error) drops the
  // retained calendar so we show the hint instead of a stale timetable.
  const lastBundleRef = useRef<GenerateSchedulesResult | undefined>(bundle);
  if (bundle?.currentSchedule) lastBundleRef.current = bundle;
  else if (!running && status !== undefined) lastBundleRef.current = undefined;

  const shown = bundle?.currentSchedule ? bundle : lastBundleRef.current;
  const schedule = shown?.currentSchedule ?? null;
  const busy = running || (schedule != null && !bundle?.currentSchedule);

  if (schedule) {
    return (
      <div className={`${styles.calendarBody} nodrag nowheel`}>
        <PlannerTermCalendar
          schedule={schedule}
          cache={cache}
          colorMap={shown?.currentColorMap}
          professorRatings={professorRatings}
        />
        {busy ? (
          <div className={styles.calendarBusy}>
            <Loader size="sm" />
          </div>
        ) : null}
      </div>
    );
  }
  if (running) {
    return (
      <div className={styles.calendarHintBody}>
        <Loader size="sm" />
      </div>
    );
  }
  if (courseCount === 0) {
    return <div className={styles.calendarHintBody}>{tr("planner.future.emptyHint")}</div>;
  }
  return <div className={styles.calendarHintBody}>{tr("planner.future.noPreview")}</div>;
}

/**
 * A future term rendered as a React Flow container node whose body is a
 * read-only week calendar of the term's generated schedule. Prerequisite edges
 * from earlier terms (completed course chips or earlier term calendars) land on
 * the left target handle; the right source handle feeds later terms. The node is
 * a click target that focuses the term in the tabbed panel (highlighted blue
 * while selected); all per-term controls now live in that panel. Disabled terms
 * show a "select to plan" hint instead of a calendar.
 */
function FutureTermNodeImpl({ id, data }: NodeProps<FutureFlowNode>) {
  const running = usePlannerActions().runningTermId === data.termId;
  const selected = useGraphPlannerStore((s) => s.selectedTermId === data.termId);
  const active = data.enabled || running;
  const setNodeSize = useGraphPlannerStore((s) => s.setNodeSize);

  return (
    <div className={styles.container} data-active={active} data-selected={selected || undefined}>
      <Handle
        type="target"
        position={Position.Left}
        className={styles.handle}
        isConnectable={false}
      />
      <div className={styles.containerHeader}>
        <div className={styles.containerTitleRow}>
          <span className={styles.bandLabel}>{data.label}</span>
          {data.enabled && data.status ? (
            <Badge size="xs" variant="light" color={STATUS_COLOR[data.status]}>
              {statusLabel(data.status)}
            </Badge>
          ) : null}
        </div>
      </div>
      {data.enabled && data.termId ? (
        <FutureTermBody
          termId={data.termId}
          courseCount={data.courseCount}
          status={data.status}
          running={running}
        />
      ) : (
        <div className={styles.calendarHintBody}>{tr("planner.future.selectToPlan")}</div>
      )}
      {data.enabled ? (
        <NodeResizeControl
          className={styles.resizeControl}
          minWidth={PLANNER_FUTURE_MIN_SIZE.width}
          minHeight={PLANNER_FUTURE_MIN_SIZE.height}
          onResizeEnd={(_event, params: ResizeParams) =>
            setNodeSize(id, { width: params.width, height: params.height })
          }
        >
          <IconArrowsDiagonal size={13} className={styles.resizeGrip} />
        </NodeResizeControl>
      ) : null}
      <Handle
        type="source"
        position={Position.Right}
        className={styles.handle}
        isConnectable={false}
      />
    </div>
  );
}

export const FutureTermNode = memo(FutureTermNodeImpl);
