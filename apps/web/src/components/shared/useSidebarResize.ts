import { useRef } from "react";
import { useLocalStorage } from "@mantine/hooks";
import { CALENDAR_SIDEBAR_WIDTH_PX } from "../calendar/calendarLayout";

/**
 * Shared localStorage key + bounds for the desktop sidebar width, so the
 * calendar and the degree-planner graph resize the same persisted value and
 * stay in sync.
 */
const SIDEBAR_WIDTH_STORAGE_KEY = "uoplan.calendar.sidebarWidth";
export const SIDEBAR_MIN_WIDTH_PX = 220;
export const SIDEBAR_MAX_WIDTH_PX = 600;

function clampSidebarWidth(width: number): number {
  return Math.min(SIDEBAR_MAX_WIDTH_PX, Math.max(SIDEBAR_MIN_WIDTH_PX, width));
}

export interface SidebarResizeController {
  /** Current sidebar width in px (persisted). Apply to the sidebar element. */
  width: number;
  /** Attach to the sidebar element so the drag preview can anchor to its edge. */
  asideRef: React.RefObject<HTMLDivElement | null>;
  /** Attach to the floating drag-preview line. */
  previewLineRef: React.RefObject<HTMLDivElement | null>;
  /** Spread onto the draggable resize handle. */
  handleProps: {
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerMove: (e: React.PointerEvent) => void;
    onPointerUp: () => void;
    onKeyDown: (e: React.KeyboardEvent) => void;
  };
}

/**
 * Encapsulates the draggable/keyboard-resizable sidebar behaviour shared by the
 * calendar and the degree-planner graph: a persisted width, a pointer-drag with
 * a live preview line, and arrow/Home/End keyboard resizing. Render the handle
 * with {@link SidebarResizeHandle}.
 */
export function useSidebarResize(): SidebarResizeController {
  const [width, setWidth] = useLocalStorage<number>({
    key: SIDEBAR_WIDTH_STORAGE_KEY,
    defaultValue: CALENDAR_SIDEBAR_WIDTH_PX,
    getInitialValueInEffect: false,
  });
  const isResizing = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);
  const pendingWidth = useRef(CALENDAR_SIDEBAR_WIDTH_PX);
  const asideRef = useRef<HTMLDivElement>(null);
  const previewLineRef = useRef<HTMLDivElement>(null);

  function positionPreviewLine(next: number) {
    const aside = asideRef.current;
    const line = previewLineRef.current;
    if (!aside || !line) return;
    const asideLeft = aside.getBoundingClientRect().left;
    line.style.left = `${asideLeft + next}px`;
  }

  function onPointerDown(e: React.PointerEvent) {
    isResizing.current = true;
    startX.current = e.clientX;
    startWidth.current = width;
    pendingWidth.current = width;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const line = previewLineRef.current;
    if (line) {
      positionPreviewLine(width);
      line.style.display = "block";
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!isResizing.current) return;
    const delta = e.clientX - startX.current;
    const next = clampSidebarWidth(startWidth.current + delta);
    pendingWidth.current = next;
    positionPreviewLine(next);
  }

  function onPointerUp() {
    if (!isResizing.current) return;
    isResizing.current = false;
    const line = previewLineRef.current;
    if (line) line.style.display = "none";
    setWidth(pendingWidth.current);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const STEP = 16;
    let next: number | null = null;
    if (e.key === "ArrowLeft") next = clampSidebarWidth(width - STEP);
    else if (e.key === "ArrowRight") next = clampSidebarWidth(width + STEP);
    else if (e.key === "Home") next = clampSidebarWidth(0);
    else if (e.key === "End") next = clampSidebarWidth(Number.POSITIVE_INFINITY);
    if (next !== null) {
      e.preventDefault();
      setWidth(next);
    }
  }

  return {
    width,
    asideRef,
    previewLineRef,
    handleProps: { onPointerDown, onPointerMove, onPointerUp, onKeyDown },
  };
}
