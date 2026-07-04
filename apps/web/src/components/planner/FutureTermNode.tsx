import { memo } from "react";
import { ActionIcon, Badge, Button, Loader, NumberInput, Tooltip } from "@mantine/core";
import { IconCalendarEvent, IconRefresh, IconSchool, IconX } from "@tabler/icons-react";
import type { Node, NodeProps } from "@xyflow/react";
import { tr } from "../../i18n";
import { plannerTermCount, useGraphPlannerStore } from "../../store/graphPlannerStore";
import type { PlannerTermStatus } from "../../store/graphPlannerStore";
import type { PlannerBandData } from "../../lib/graphPlanner/buildPlannerGraph";
import { usePlannerActions } from "./plannerActionsContext";
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
 * A future term rendered as a React Flow container (parent) node. Its generated
 * course children are clamped inside it (`extent: "parent"`) so a regeneration
 * moves them as a group; the container header stays a drag handle while the
 * enable/count/regenerate controls opt out of dragging via `nodrag`.
 */
function FutureTermNodeImpl({ data }: NodeProps<FutureFlowNode>) {
  const running = usePlannerActions().runningTermId === data.termId;
  const active = data.enabled || running;

  return (
    <div className={styles.container} data-active={active}>
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
      {data.enabled && data.courseCount === 0 && !running ? (
        <div className={styles.containerHint}>{tr("planner.future.emptyHint")}</div>
      ) : null}
    </div>
  );
}

export const FutureTermNode = memo(FutureTermNodeImpl);
