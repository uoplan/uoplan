import { ActionIcon, Tooltip } from "@mantine/core";
import { IconLayoutGrid, IconMaximize, IconMinus, IconPlus } from "@tabler/icons-react";
import { Panel, useReactFlow } from "@xyflow/react";
import { tr } from "../../i18n";
import styles from "./planner.module.css";

/**
 * Fully custom, theme-aware canvas controls (replaces React Flow's default
 * white control bar, which ignores dark mode). Rendered inside `<ReactFlow>` so
 * it can drive the viewport via {@link useReactFlow}.
 */
export function PlannerControls({ onResetLayout }: { onResetLayout?: () => void }) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  return (
    <Panel position="bottom-left" className={`${styles.controls} nodrag nopan`}>
      <Tooltip label={tr("planner.controls.zoomIn")} withArrow position="right">
        <ActionIcon
          variant="subtle"
          color="gray"
          size="md"
          aria-label={tr("planner.controls.zoomIn")}
          onClick={() => void zoomIn({ duration: 200 })}
        >
          <IconPlus size={16} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label={tr("planner.controls.zoomOut")} withArrow position="right">
        <ActionIcon
          variant="subtle"
          color="gray"
          size="md"
          aria-label={tr("planner.controls.zoomOut")}
          onClick={() => void zoomOut({ duration: 200 })}
        >
          <IconMinus size={16} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label={tr("planner.controls.fit")} withArrow position="right">
        <ActionIcon
          variant="subtle"
          color="gray"
          size="md"
          aria-label={tr("planner.controls.fit")}
          onClick={() => void fitView({ padding: 0.3, duration: 300 })}
        >
          <IconMaximize size={16} />
        </ActionIcon>
      </Tooltip>
      {onResetLayout ? (
        <>
          <div className={styles.controlsDivider} aria-hidden />
          <Tooltip label={tr("planner.controls.resetLayout")} withArrow position="right">
            <ActionIcon
              variant="subtle"
              color="gray"
              size="md"
              aria-label={tr("planner.controls.resetLayout")}
              onClick={onResetLayout}
            >
              <IconLayoutGrid size={16} />
            </ActionIcon>
          </Tooltip>
        </>
      ) : null}
    </Panel>
  );
}
