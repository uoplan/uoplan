import { memo } from "react";
import type { Node, NodeProps } from "@xyflow/react";
import { tr } from "../../i18n";
import type { PlannerBandData } from "../../lib/graphPlanner/buildPlannerGraph";
import styles from "./planner.module.css";

type BandFlowNode = Node<PlannerBandData, "termBand">;

/**
 * A completed term rendered as a passive, labelled background block. The
 * student's courses for that term are laid out on top as independent,
 * freely-draggable top-level nodes (see {@link buildPlannerGraph}); this block
 * only provides the term's backdrop + label and never intercepts pointer input.
 */
function TermBandNodeImpl({ data }: NodeProps<BandFlowNode>) {
  return (
    <div className={styles.band}>
      <span className={styles.bandLabel}>{data.label}</span>
      {data.courseCount > 0 ? (
        <span className={styles.bandMeta}>
          {tr("planner.band.courses", { count: data.courseCount })}
        </span>
      ) : null}
    </div>
  );
}

export const TermBandNode = memo(TermBandNodeImpl);
