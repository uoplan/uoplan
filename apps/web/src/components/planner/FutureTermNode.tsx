import { memo } from "react";
import { ActionIcon, Badge, Button, Loader, NumberInput, Tooltip } from "@mantine/core";
import {
  IconArrowsDiagonal,
  IconCalendarEvent,
  IconRefresh,
  IconSchool,
  IconX,
} from "@tabler/icons-react";
import { Handle, NodeResizeControl, Position } from "@xyflow/react";
import type { Node, NodeProps, ResizeParams } from "@xyflow/react";
import { tr } from "../../i18n";
import { useDataCache, useProfessorRatings } from "../../store/hooks";
import { plannerTermCount, useGraphPlannerStore } from "../../store/graphPlannerStore";
import type { PlannerTermStatus } from "../../store/graphPlannerStore";
import type { PlannerBandData } from "../../lib/graphPlanner/buildPlannerGraph";
import { PLANNER_FUTURE_MIN_SIZE } from "../../lib/graphPlanner/buildPlannerGraph";
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
 * Enable / count / regenerate / disable controls for a future term. Marked
 * `nodrag nopan` so interacting with them never drags the container node.
 */
function FutureControls({ termId, enabled }: { termId: string; enabled: boolean }) {
  const actions = usePlannerActions();
  const count = useGraphPlannerStore((s) => plannerTermCount(s, termId));
  const running = actions.runningTermId === termId;

  if (!enabled) {
    if (!actions.hasProgram) {
      return (
        <Button
          className="nodrag nopan"
          size="compact-xs"
          variant="light"
          leftSection={<IconSchool size={14} />}
          onClick={actions.goToPersonalize}
        >
          {tr("planner.band.pickProgram")}
        </Button>
      );
    }
    return (
      <Button
        className="nodrag nopan"
        size="compact-xs"
        variant="light"
        disabled={actions.isGenerating}
        onClick={() => actions.enableTerm(termId)}
      >
        {tr("planner.band.enable")}
      </Button>
    );
  }

  return (
    <div className={`${styles.bandControls} nodrag nopan`}>
      <NumberInput
        size="xs"
        w={72}
        min={1}
        max={12}
        value={count}
        disabled={actions.isGenerating}
        onChange={(v) =>
          actions.changeCount(termId, typeof v === "number" ? v : Number(v) || count)
        }
        aria-label={tr("planner.band.courseCount")}
      />
      {running ? (
        <Loader size="xs" />
      ) : (
        <Tooltip label={tr("planner.band.regenerate")} withArrow>
          <ActionIcon
            size="sm"
            variant="subtle"
            disabled={actions.isGenerating}
            onClick={() => actions.regenerateTerm(termId)}
            aria-label={tr("planner.band.regenerate")}
          >
            <IconRefresh size={15} />
          </ActionIcon>
        </Tooltip>
      )}
      <Tooltip label={tr("planner.band.openInCalendar")} withArrow>
        <ActionIcon
          size="sm"
          variant="subtle"
          disabled={actions.isGenerating}
          onClick={() => actions.openInCalendar(termId)}
          aria-label={tr("planner.band.openInCalendar")}
        >
          <IconCalendarEvent size={15} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label={tr("planner.band.disable")} withArrow>
        <ActionIcon
          size="sm"
          variant="subtle"
          color="red"
          disabled={actions.isGenerating}
          onClick={() => actions.disableTerm(termId)}
          aria-label={tr("planner.band.disable")}
        >
          <IconX size={15} />
        </ActionIcon>
      </Tooltip>
    </div>
  );
}

/**
 * The calendar body of an enabled future term. Reads the term's retained
 * schedule bundle from the planner store and renders it in the same read-only
 * week calendar the rest of the app uses, so the graph shows the real timetable.
 * Falls back to a hint while generating, when the term came back empty, or when
 * an older persisted plan has no retained schedule to draw.
 */
function FutureTermBody({
  termId,
  courseCount,
  running,
}: {
  termId: string;
  courseCount: number;
  running: boolean;
}) {
  const cache = useDataCache();
  const professorRatings = useProfessorRatings();
  const bundle = useGraphPlannerStore((s) => s.resultByTermId[termId]);

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
  const schedule = bundle?.currentSchedule ?? null;
  if (!schedule) {
    return <div className={styles.calendarHintBody}>{tr("planner.future.noPreview")}</div>;
  }
  return (
    <div className={`${styles.calendarBody} nodrag nowheel`}>
      <PlannerTermCalendar
        schedule={schedule}
        cache={cache}
        colorMap={bundle?.currentColorMap}
        professorRatings={professorRatings}
      />
    </div>
  );
}

/**
 * A future term rendered as a React Flow container node whose body is a
 * read-only week calendar of the term's generated schedule. Prerequisite edges
 * from earlier terms (completed course chips or earlier term calendars) land on
 * the left target handle; the right source handle feeds later terms. The header
 * stays a drag handle while the enable/count/regenerate controls opt out of
 * dragging via `nodrag`.
 */
function FutureTermNodeImpl({ id, data }: NodeProps<FutureFlowNode>) {
  const running = usePlannerActions().runningTermId === data.termId;
  const active = data.enabled || running;
  const setNodeSize = useGraphPlannerStore((s) => s.setNodeSize);

  return (
    <div className={styles.container} data-active={active}>
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
        {data.termId ? <FutureControls termId={data.termId} enabled={data.enabled} /> : null}
      </div>
      {data.enabled && data.termId ? (
        <FutureTermBody termId={data.termId} courseCount={data.courseCount} running={running} />
      ) : null}
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
