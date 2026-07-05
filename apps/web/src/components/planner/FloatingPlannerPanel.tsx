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
import { CALENDAR_OVERLAY_LEFT_WIDTH, CALENDAR_OVERLAY_MARGIN } from "./plannerCalendarOverlay";
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
  /**
   * When true, the panel abandons its floating/draggable behaviour and docks to
   * the left of the canvas (enlarged, full-height minus margins) as the sidebar
   * of the "open in calendar" overlay. Dragging, resizing and collapsing are
   * disabled; the header carries only the term title (the minimize control lives
   * on the calendar card).
   */
  calendarMode?: boolean;
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
  calendarMode = false,
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
  // Suppresses the position/size CSS transition during an active drag/resize so
  // the panel tracks the pointer instantly; the transition only plays when
  // docking into / out of calendar mode.
  const [interacting, setInteracting] = useState(false);
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
      // Dragging is disabled while docked as the calendar overlay sidebar.
      if (calendarMode) return;
      // Ignore drags that start on a button (collapse / reset / clear).
      if ((event.target as HTMLElement).closest("button")) return;
      const panel = panelRef.current;
      if (!panel) return;
      event.preventDefault();
      setInteracting(true);
      dragRef.current = {
        pointerId: event.pointerId,
        offsetX: event.clientX - position.x,
        offsetY: event.clientY - position.y,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [calendarMode, position.x, position.y],
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
      setInteracting(false);
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
    setInteracting(true);
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
      setInteracting(false);
      const next = clampSize(
        r.startW + (event.clientX - r.startX),
        r.startH + (event.clientY - r.startY),
      );
      setSize(next);
      setPanelSize(next);
    },
    [clampSize, setPanelSize],
  );

  const effectiveCollapsed = calendarMode ? false : collapsed;

  const dockedStyle = {
    left: CALENDAR_OVERLAY_MARGIN,
    top: CALENDAR_OVERLAY_MARGIN,
    width: CALENDAR_OVERLAY_LEFT_WIDTH,
    height: `calc(100% - ${CALENDAR_OVERLAY_MARGIN * 2}px)`,
    maxHeight: "none" as const,
  };
  const floatStyle = {
    left: position.x,
    top: position.y,
    ...(size ? { width: size.width } : {}),
    ...(size && !collapsed ? { height: size.height, maxHeight: "none" as const } : {}),
  };

  return (
    <div
      ref={panelRef}
      className={styles.floatingPanel}
      data-collapsed={effectiveCollapsed || undefined}
      data-calendar-mode={calendarMode || undefined}
      data-interacting={interacting || undefined}
      style={calendarMode ? dockedStyle : floatStyle}
    >
      <div
        className={styles.floatingPanelHeader}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {calendarMode ? null : (
          <IconGripVertical size={16} className={styles.floatingPanelGrip} aria-hidden />
        )}
        <span className={styles.floatingPanelTitle}>{title}</span>
        <div className={styles.floatingPanelHeaderActions}>
          {calendarMode ? null : (
            <>
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
            </>
          )}
        </div>
      </div>
      {effectiveCollapsed ? null : <div className={styles.floatingPanelBody}>{children}</div>}
      {effectiveCollapsed || calendarMode ? null : (
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
