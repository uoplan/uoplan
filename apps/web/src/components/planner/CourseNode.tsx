import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import type { Node, NodeProps } from "@xyflow/react";
import { tr } from "../../i18n";
import type { PlannerNodeData } from "../../lib/graphPlanner/buildPlannerGraph";
import styles from "./planner.module.css";

type CourseFlowNode = Node<PlannerNodeData, "course">;

function CourseNodeImpl({ data }: NodeProps<CourseFlowNode>) {
  return (
    <div className={styles.node} data-status={data.status} title={data.title || data.code}>
      <Handle
        type="target"
        position={Position.Left}
        className={styles.handle}
        isConnectable={false}
      />
      <span className={styles.nodeHeadRow}>
        <span className={styles.nodeCode}>{data.code}</span>
        {data.term ? <span className={styles.nodeTerm}>{data.term}</span> : null}
      </span>
      {data.title ? <span className={styles.nodeTitle}>{data.title}</span> : null}
      {data.status === "missingPrereq" ? (
        <span className={styles.nodeWarn}>{tr("planner.node.missingPrereq")}</span>
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

export const CourseNode = memo(CourseNodeImpl);
