import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActionIcon, Tooltip } from "@mantine/core";
import {
  IconChevronDown,
  IconChevronUp,
  IconGripVertical,
  IconLayoutGrid,
  IconTrash,
} from "@tabler/icons-react";
import { tr, useTr } from "../../i18n";
import { useGraphPlannerStore } from "../../store/graphPlannerStore";
import styles from "./planner.module.css";

const DEFAULT_OFFSET = 16;
const EDGE_GAP = 12;
const RESIZE_MIN_W = 260;
const RESIZE_MIN_H = 220;

interface FloatingPlannerPanelProps {
  title: string;
  onResetLayout: () => void;
  onClearPlan: () => void;
  clearDisabled: boolean;
  children: ReactNode;
}

/**
 * The graph's planner controls rendered as a detached, movable, collapsible card
 * floating over the full-screen canvas (top-left by default, with a gap so it
 * reads as separate). The header is a drag handle; the reset-layout / clear-plan
 * icon buttons and the collapse toggle live there too. Position and collapsed
 * state persist in the planner store. Dragging is clamped to the canvas so the
 * panel can't be lost off-screen.
 */
export function FloatingPlannerPanel({
  title,
  onResetLayout,
  onClearPlan,
  clearDisabled,
  children,
}: FloatingPlannerPanelProps) {
  useTr();
  const storedPosition = useGraphPlannerStore((s) => s.panelPosition);
  const storedSize = useGraphPlannerStore((s) => s.panelSize);
  const collapsed = useGraphPlannerStore((s) => s.panelCollapsed);
  const setPanelPosition = useGraphPlannerStore((s) => s.setPanelPosition);
  const setPanelSize = useGraphPlannerStore((s) => s.setPanelSize);
  const setPanelCollapsed = useGraphPlannerStore((s) => s.setPanelCollapsed);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<{ x: number; y: number }>(
    storedPosition ?? { x: DEFAULT_OFFSET, y: DEFAULT_OFFSET },
  );
  const [size, setSize] = useState<{ width: number; height: number } | null>(storedSize);
  const dragRef = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null);
  const resizeRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startW: number;
    startH: number;
  } | null>(null);

  // Keep local position in sync when the store changes externally (e.g. reset
  // layout re-anchors the panel), but not mid-drag.
  useEffect(() => {
    if (dragRef.current) return;
    setPosition(storedPosition ?? { x: DEFAULT_OFFSET, y: DEFAULT_OFFSET });
  }, [storedPosition]);

  // Same for the resized size (reset layout clears it back to the default).
  useEffect(() => {
    if (resizeRef.current) return;
    setSize(storedSize);
  }, [storedSize]);

  const clampToParent = useCallback((x: number, y: number) => {
    const panel = panelRef.current;
    const parent = panel?.offsetParent as HTMLElement | null;
    if (!panel || !parent) return { x, y };
    const maxX = Math.max(EDGE_GAP, parent.clientWidth - panel.offsetWidth - EDGE_GAP);
    const maxY = Math.max(EDGE_GAP, parent.clientHeight - panel.offsetHeight - EDGE_GAP);
    return {
      x: Math.min(Math.max(EDGE_GAP, x), maxX),
      y: Math.min(Math.max(EDGE_GAP, y), maxY),
    };
  }, []);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      // Ignore drags that start on a button (collapse / reset / clear).
      if ((event.target as HTMLElement).closest("button")) return;
      const panel = panelRef.current;
      if (!panel) return;
      event.preventDefault();
      dragRef.current = {
        pointerId: event.pointerId,
        offsetX: event.clientX - position.x,
        offsetY: event.clientY - position.y,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [position.x, position.y],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      setPosition(clampToParent(event.clientX - drag.offsetX, event.clientY - drag.offsetY));
    },
    [clampToParent],
  );

  const endDrag = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      dragRef.current = null;
      const next = clampToParent(event.clientX - drag.offsetX, event.clientY - drag.offsetY);
      setPosition(next);
      setPanelPosition(next);
    },
    [clampToParent, setPanelPosition],
  );

  const clampSize = useCallback(
    (width: number, height: number) => {
      const parent = panelRef.current?.offsetParent as HTMLElement | null;
      let maxW = Number.POSITIVE_INFINITY;
      let maxH = Number.POSITIVE_INFINITY;
      if (parent) {
        maxW = Math.max(RESIZE_MIN_W, parent.clientWidth - position.x - EDGE_GAP);
        maxH = Math.max(RESIZE_MIN_H, parent.clientHeight - position.y - EDGE_GAP);
      }
      return {
        width: Math.min(Math.max(RESIZE_MIN_W, width), maxW),
        height: Math.min(Math.max(RESIZE_MIN_H, height), maxH),
      };
    },
    [position.x, position.y],
  );

  const handleResizeDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const panel = panelRef.current;
    if (!panel) return;
    event.preventDefault();
    event.stopPropagation();
    resizeRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startW: panel.offsetWidth,
      startH: panel.offsetHeight,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  const handleResizeMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const r = resizeRef.current;
      if (!r || r.pointerId !== event.pointerId) return;
      setSize(
        clampSize(r.startW + (event.clientX - r.startX), r.startH + (event.clientY - r.startY)),
      );
    },
    [clampSize],
  );

  const endResize = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const r = resizeRef.current;
      if (!r || r.pointerId !== event.pointerId) return;
      resizeRef.current = null;
      const next = clampSize(
        r.startW + (event.clientX - r.startX),
        r.startH + (event.clientY - r.startY),
      );
      setSize(next);
      setPanelSize(next);
    },
    [clampSize, setPanelSize],
  );

  return (
    <div
      ref={panelRef}
      className={styles.floatingPanel}
      data-collapsed={collapsed || undefined}
      style={{
        left: position.x,
        top: position.y,
        ...(size ? { width: size.width } : {}),
        ...(size && !collapsed ? { height: size.height, maxHeight: "none" } : {}),
      }}
    >
      <div
        className={styles.floatingPanelHeader}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <IconGripVertical size={16} className={styles.floatingPanelGrip} aria-hidden />
        <span className={styles.floatingPanelTitle}>{title}</span>
        <div className={styles.floatingPanelHeaderActions}>
          <Tooltip label={tr("planner.controls.resetLayout")} withArrow>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              aria-label={tr("planner.controls.resetLayout")}
              onClick={onResetLayout}
            >
              <IconLayoutGrid size={15} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={tr("planner.clearPlan")} withArrow>
            <ActionIcon
              variant="subtle"
              color="red"
              size="sm"
              disabled={clearDisabled}
              aria-label={tr("planner.clearPlan")}
              onClick={onClearPlan}
            >
              <IconTrash size={15} />
            </ActionIcon>
          </Tooltip>
          <Tooltip
            label={collapsed ? tr("planner.panel.expand") : tr("planner.panel.collapse")}
            withArrow
          >
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              aria-label={collapsed ? tr("planner.panel.expand") : tr("planner.panel.collapse")}
              onClick={() => setPanelCollapsed(!collapsed)}
            >
              {collapsed ? <IconChevronDown size={15} /> : <IconChevronUp size={15} />}
            </ActionIcon>
          </Tooltip>
        </div>
      </div>
      {collapsed ? null : <div className={styles.floatingPanelBody}>{children}</div>}
      {collapsed ? null : (
        <div
          className={styles.floatingPanelResize}
          role="presentation"
          title={tr("planner.panel.resize")}
          onPointerDown={handleResizeDown}
          onPointerMove={handleResizeMove}
          onPointerUp={endResize}
          onPointerCancel={endResize}
        />
      )}
    </div>
  );
}
