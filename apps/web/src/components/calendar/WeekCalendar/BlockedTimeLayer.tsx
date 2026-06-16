import { useCallback, useRef, useState } from "react";
import type { DayOfWeekCode } from "@uoplan/core";
import type { BlockedTime } from "../../../store/types";
import { tr } from "../../../i18n";
import {
  CAL_END_MINUTES,
  CAL_START_MINUTES,
  clampToCalendarRange,
  minutesToPercent,
  percentToMinutes,
  snapMinutes,
} from "./weekCalendarLayout";

const MIN_BLOCK_MINUTES = 30;
const MOVE_THRESHOLD_PX = 6;
const LONG_PRESS_MS = 350;
const BLOCKED_TIME_RESIZE_START_LABEL_ID = "calendar.blockedTime.resizeStart";
const BLOCKED_TIME_RESIZE_END_LABEL_ID = "calendar.blockedTime.resizeEnd";
const BLOCKED_TIME_REMOVE_LABEL_ID = "calendar.blockedTime.remove";

type GestureKind = "create" | "move" | "resize-top" | "resize-bottom";

interface Gesture {
  kind: GestureKind;
  pointerId: number;
  pointerType: string;
  originClientY: number;
  latestClientY: number;
  /** Anchor minute for create, original block bounds for move/resize. */
  anchorMinutes: number;
  originStart: number;
  originEnd: number;
  blockId: string | null;
  rectTop: number;
  rectHeight: number;
  active: boolean;
  moved: boolean;
  longPress: boolean;
  longPressTimer: number | null;
}

interface Draft {
  blockId: string | null;
  startMinutes: number;
  endMinutes: number;
}

interface BlockedTimeLayerProps {
  day: DayOfWeekCode;
  blocks: BlockedTime[];
  onCommitCreate: (day: DayOfWeekCode, startMinutes: number, endMinutes: number) => void;
  onCommitUpdate: (id: string, startMinutes: number, endMinutes: number) => void;
  onRequestRemove: (block: BlockedTime) => void;
}

export function BlockedTimeLayer({
  day,
  blocks,
  onCommitCreate,
  onCommitUpdate,
  onRequestRemove,
}: BlockedTimeLayerProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  const clientYToMinutes = useCallback((clientY: number, rectTop: number, rectHeight: number) => {
    const pct = ((clientY - rectTop) / rectHeight) * 100;
    return clampToCalendarRange(snapMinutes(percentToMinutes(pct)));
  }, []);

  const clearLongPress = (g: Gesture) => {
    if (g.longPressTimer != null) {
      window.clearTimeout(g.longPressTimer);
      g.longPressTimer = null;
    }
  };

  const computeDraft = useCallback(
    (g: Gesture, clientY: number): Draft => {
      if (g.kind === "create") {
        const cur = clientYToMinutes(clientY, g.rectTop, g.rectHeight);
        return {
          blockId: null,
          startMinutes: Math.min(g.anchorMinutes, cur),
          endMinutes: Math.max(g.anchorMinutes, cur),
        };
      }
      if (g.kind === "resize-top") {
        const cur = clientYToMinutes(clientY, g.rectTop, g.rectHeight);
        return {
          blockId: g.blockId,
          startMinutes: Math.max(CAL_START_MINUTES, Math.min(cur, g.originEnd - MIN_BLOCK_MINUTES)),
          endMinutes: g.originEnd,
        };
      }
      if (g.kind === "resize-bottom") {
        const cur = clientYToMinutes(clientY, g.rectTop, g.rectHeight);
        return {
          blockId: g.blockId,
          startMinutes: g.originStart,
          endMinutes: Math.min(CAL_END_MINUTES, Math.max(cur, g.originStart + MIN_BLOCK_MINUTES)),
        };
      }
      // move: shift whole block, preserving duration, clamped to the visible range.
      const cur = clientYToMinutes(clientY, g.rectTop, g.rectHeight);
      const delta = cur - g.anchorMinutes;
      const dur = g.originEnd - g.originStart;
      const start = Math.max(
        CAL_START_MINUTES,
        Math.min(g.originStart + delta, CAL_END_MINUTES - dur),
      );
      return { blockId: g.blockId, startMinutes: start, endMinutes: start + dur };
    },
    [clientYToMinutes],
  );

  const beginActive = useCallback(
    (g: Gesture, clientY: number) => {
      g.active = true;
      // Re-anchor to the activation point so pre-activation drift (e.g. during a
      // touch long-press) is not counted as drag movement.
      if (g.kind === "create" || g.kind === "move") {
        g.anchorMinutes = clientYToMinutes(clientY, g.rectTop, g.rectHeight);
      }
      g.originClientY = clientY;
      rootRef.current?.setPointerCapture(g.pointerId);
      if (g.kind !== "create") {
        setDraft(computeDraft(g, clientY));
      }
    },
    [clientYToMinutes, computeDraft],
  );

  const startGesture = useCallback(
    (e: React.PointerEvent, kind: GestureKind, block: BlockedTime | null) => {
      if (gestureRef.current) return;
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;
      e.stopPropagation();

      const anchorMinutes =
        kind === "create" || kind === "move"
          ? clientYToMinutes(e.clientY, rect.top, rect.height)
          : 0;

      const g: Gesture = {
        kind,
        pointerId: e.pointerId,
        pointerType: e.pointerType,
        originClientY: e.clientY,
        latestClientY: e.clientY,
        anchorMinutes,
        originStart: block?.startMinutes ?? anchorMinutes,
        originEnd: block?.endMinutes ?? anchorMinutes,
        blockId: block?.id ?? null,
        rectTop: rect.top,
        rectHeight: rect.height,
        active: false,
        moved: false,
        longPress: false,
        longPressTimer: null,
      };
      gestureRef.current = g;

      if (e.pointerType === "touch") {
        // Defer activation so a quick swipe still scrolls the calendar.
        g.longPressTimer = window.setTimeout(() => {
          g.longPress = true;
          beginActive(g, g.latestClientY);
        }, LONG_PRESS_MS);
      } else {
        beginActive(g, e.clientY);
      }
    },
    [beginActive, clientYToMinutes],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const g = gestureRef.current;
      if (!g || g.pointerId !== e.pointerId) return;
      g.latestClientY = e.clientY;

      const dist = Math.abs(e.clientY - g.originClientY);
      if (dist > MOVE_THRESHOLD_PX) {
        if (!g.active && g.pointerType === "touch" && !g.longPress) {
          // User scrolled before long-press fired: abandon the gesture.
          clearLongPress(g);
          gestureRef.current = null;
          return;
        }
        g.moved = true;
      }
      if (!g.active) return;
      e.preventDefault();
      setDraft(computeDraft(g, e.clientY));
    },
    [computeDraft],
  );

  const endGesture = useCallback(
    (e: React.PointerEvent) => {
      const g = gestureRef.current;
      if (!g || g.pointerId !== e.pointerId) return;
      clearLongPress(g);
      gestureRef.current = null;
      if (rootRef.current?.hasPointerCapture(e.pointerId)) {
        rootRef.current.releasePointerCapture(e.pointerId);
      }

      const finalDraft = g.active ? computeDraft(g, e.clientY) : null;
      setDraft(null);

      if (!g.active) {
        // A tap/click that never activated: remove if it landed on a block.
        if (g.kind !== "create" && g.blockId && !g.moved) {
          const block = blocks.find((b) => b.id === g.blockId);
          if (block) onRequestRemove(block);
        }
        return;
      }

      if (g.kind === "create") {
        if (finalDraft && finalDraft.endMinutes - finalDraft.startMinutes >= MIN_BLOCK_MINUTES) {
          onCommitCreate(day, finalDraft.startMinutes, finalDraft.endMinutes);
        }
        return;
      }

      // move / resize
      if (g.blockId) {
        const changed =
          finalDraft != null &&
          (finalDraft.startMinutes !== g.originStart || finalDraft.endMinutes !== g.originEnd);
        if (changed) {
          onCommitUpdate(g.blockId, finalDraft.startMinutes, finalDraft.endMinutes);
        } else if (g.kind === "move") {
          // A click on the block body (no real movement) opens the remove modal.
          const block = blocks.find((b) => b.id === g.blockId);
          if (block) onRequestRemove(block);
        }
      }
    },
    [blocks, computeDraft, day, onCommitCreate, onCommitUpdate, onRequestRemove],
  );

  const handlePointerCancel = useCallback((e: React.PointerEvent) => {
    const g = gestureRef.current;
    if (!g || g.pointerId !== e.pointerId) return;
    clearLongPress(g);
    gestureRef.current = null;
    setDraft(null);
  }, []);

  const resizeBlockWithKeyboard = useCallback(
    (e: React.KeyboardEvent, block: BlockedTime, edge: "start" | "end") => {
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      e.preventDefault();
      e.stopPropagation();

      const delta = e.key === "ArrowUp" ? -MIN_BLOCK_MINUTES : MIN_BLOCK_MINUTES;
      const nextStart =
        edge === "start"
          ? Math.max(
              CAL_START_MINUTES,
              Math.min(block.startMinutes + delta, block.endMinutes - MIN_BLOCK_MINUTES),
            )
          : block.startMinutes;
      const nextEnd =
        edge === "end"
          ? Math.min(
              CAL_END_MINUTES,
              Math.max(block.endMinutes + delta, block.startMinutes + MIN_BLOCK_MINUTES),
            )
          : block.endMinutes;

      if (nextStart !== block.startMinutes || nextEnd !== block.endMinutes) {
        onCommitUpdate(block.id, nextStart, nextEnd);
      }
    },
    [onCommitUpdate],
  );

  const handleResizeKeyDown = useCallback(
    (e: React.KeyboardEvent, blockId: string, edge: "start" | "end") => {
      e.stopPropagation();
      const block = blocks.find((bl) => bl.id === blockId);
      if (block) resizeBlockWithKeyboard(e, block, edge);
    },
    [blocks, resizeBlockWithKeyboard],
  );

  const renderedBlocks = blocks.map((b) =>
    draft && draft.blockId === b.id
      ? { id: b.id, day, startMinutes: draft.startMinutes, endMinutes: draft.endMinutes }
      : b,
  );

  return (
    <div
      ref={rootRef}
      className="cal-blocked-layer"
      onPointerDown={(e) => startGesture(e, "create", null)}
      onPointerMove={handlePointerMove}
      onPointerUp={endGesture}
      onPointerCancel={handlePointerCancel}
    >
      {renderedBlocks.map((b) => {
        const top = minutesToPercent(b.startMinutes);
        const height = minutesToPercent(b.endMinutes) - top;
        return (
          <div
            key={b.id}
            className="cal-blocked"
            data-block-id={b.id}
            style={{ top: `${top}%`, height: `${height}%` }}
            // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- semantic grouping wrapper for the resize sliders + remove button; not a fieldset
            role="group"
            aria-label={tr("calendar.blockedTime.label")}
            onPointerDown={(e) => {
              const block = blocks.find((bl) => bl.id === b.id);
              if (block) startGesture(e, "move", block);
            }}
          >
            <button
              type="button"
              className="cal-blocked-body"
              aria-label={tr(BLOCKED_TIME_REMOVE_LABEL_ID)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  const block = blocks.find((bl) => bl.id === b.id);
                  if (block) onRequestRemove(block);
                }
              }}
            />
            <div
              className="cal-blocked-handle cal-blocked-handle-top"
              // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- custom drag-resize slider handle, not a native range input
              role="slider"
              tabIndex={0}
              aria-label={tr(BLOCKED_TIME_RESIZE_START_LABEL_ID)}
              aria-orientation="vertical"
              aria-valuemin={CAL_START_MINUTES}
              aria-valuemax={b.endMinutes - MIN_BLOCK_MINUTES}
              aria-valuenow={b.startMinutes}
              onPointerDown={(e) => {
                const block = blocks.find((bl) => bl.id === b.id);
                if (block) startGesture(e, "resize-top", block);
              }}
              onKeyDown={(e) => handleResizeKeyDown(e, b.id, "start")}
            />
            <div
              className="cal-blocked-handle cal-blocked-handle-bottom"
              // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- custom drag-resize slider handle, not a native range input
              role="slider"
              tabIndex={0}
              aria-label={tr(BLOCKED_TIME_RESIZE_END_LABEL_ID)}
              aria-orientation="vertical"
              aria-valuemin={b.startMinutes + MIN_BLOCK_MINUTES}
              aria-valuemax={CAL_END_MINUTES}
              aria-valuenow={b.endMinutes}
              onPointerDown={(e) => {
                const block = blocks.find((bl) => bl.id === b.id);
                if (block) startGesture(e, "resize-bottom", block);
              }}
              onKeyDown={(e) => handleResizeKeyDown(e, b.id, "end")}
            />
          </div>
        );
      })}
      {draft && draft.blockId === null && (
        <div
          className="cal-blocked cal-blocked-draft"
          style={{
            top: `${minutesToPercent(draft.startMinutes)}%`,
            height: `${minutesToPercent(draft.endMinutes) - minutesToPercent(draft.startMinutes)}%`,
          }}
        />
      )}
    </div>
  );
}
