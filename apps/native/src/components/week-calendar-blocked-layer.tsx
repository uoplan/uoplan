import { useCallback, useEffect, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";

import type { BlockedTimeWindow, DayOfWeek } from "@uoplan/core";

import { Fonts, Surface } from "@/constants/theme";
import {
  BLOCKED_TIME_LONG_PRESS_MS,
  BLOCKED_TIME_MOVE_THRESHOLD_PX,
  blockTopHeight,
  buildCreateBlockedTimeDraft,
  moveBlockedTimeDraft,
  resizeBlockedTimeDraft,
  shouldCommitBlockedTimeDraft,
  yToCalendarMinutes,
  type CalendarGestureLayout,
  type ResizeEdge,
} from "@/lib/blocked-time-gestures";

const HANDLE_HIT_PX = 18;
const BLOCK_INSET_PX = 3;
const BLOCKED_TIME_LABEL = "Blocked time";

export interface IndexedBlockedTime {
  index: number;
  block: BlockedTimeWindow;
}

interface WeekCalendarBlockedLayerProps {
  day: DayOfWeek;
  blocks: IndexedBlockedTime[];
  layout: CalendarGestureLayout;
  editable: boolean;
  onCreate: (block: BlockedTimeWindow) => void;
  onUpdate: (index: number, block: BlockedTimeWindow) => void;
}

export function WeekCalendarBlockedLayer({
  day,
  blocks,
  layout,
  editable,
  onCreate,
  onUpdate,
}: WeekCalendarBlockedLayerProps) {
  const activeIndex = useSharedValue(-2);
  const draftTop = useSharedValue(0);
  const draftHeight = useSharedValue(0);
  const draftVisible = useSharedValue(false);
  const anchorMinutes = useSharedValue(0);
  const startGridY = useSharedValue(0);
  const commitPending = useSharedValue(false);

  const setDraft = useCallback(
    (block: BlockedTimeWindow) => {
      const box = blockTopHeight(block, layout);
      draftTop.value = box.top;
      draftHeight.value = box.height;
      draftVisible.value = true;
    },
    [draftHeight, draftTop, draftVisible, layout],
  );

  const clearDraft = useCallback(() => {
    activeIndex.value = -2;
    draftVisible.value = false;
    commitPending.value = false;
  }, [activeIndex, commitPending, draftVisible]);

  useEffect(() => {
    if (commitPending.value) clearDraft();
  }, [blocks, clearDraft, commitPending]);

  const createGesture = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .minDistance(BLOCKED_TIME_MOVE_THRESHOLD_PX)
        .activateAfterLongPress(BLOCKED_TIME_LONG_PRESS_MS)
        .onStart((event) => {
          if (!editable) return;
          const blockedHit = blocks.some(({ block }) => {
            const box = blockTopHeight(block, layout);
            return event.y >= box.top && event.y <= box.top + box.height;
          });
          if (blockedHit) return;
          const anchor = yToCalendarMinutes(event.y, layout);
          activeIndex.value = -1;
          anchorMinutes.value = anchor;
          startGridY.value = event.y;
          setDraft(buildCreateBlockedTimeDraft(day, anchor, event.y, layout));
        })
        .onUpdate((event) => {
          if (!editable || activeIndex.value !== -1) return;
          setDraft(
            buildCreateBlockedTimeDraft(
              day,
              anchorMinutes.value,
              startGridY.value + event.translationY,
              layout,
            ),
          );
        })
        .onEnd((event) => {
          if (!editable || activeIndex.value !== -1) return;
          const draft = buildCreateBlockedTimeDraft(
            day,
            anchorMinutes.value,
            startGridY.value + event.translationY,
            layout,
          );
          if (shouldCommitBlockedTimeDraft(draft)) {
            commitPending.value = true;
            onCreate(draft);
          } else {
            clearDraft();
          }
        })
        .onFinalize(() => {
          if (activeIndex.value === -1 && !commitPending.value) clearDraft();
        }),
    [
      activeIndex,
      anchorMinutes,
      blocks,
      clearDraft,
      commitPending,
      day,
      editable,
      layout,
      onCreate,
      setDraft,
      startGridY,
    ],
  );

  const draftStyle = useAnimatedStyle(() => ({
    opacity: draftVisible.value && activeIndex.value === -1 ? 0.86 : 0,
    top: draftTop.value,
    height: draftVisible.value && activeIndex.value === -1 ? draftHeight.value : 0,
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={editable ? "box-none" : "none"}>
      {editable ? (
        <GestureDetector gesture={createGesture}>
          <Animated.View style={StyleSheet.absoluteFill} />
        </GestureDetector>
      ) : null}
      {blocks.map(({ block, index }) => (
        <BlockedTimeBlock
          key={`${index}-${block.day}-${block.startMinutes}-${block.endMinutes}`}
          block={block}
          index={index}
          layout={layout}
          editable={editable}
          activeIndex={activeIndex}
          draftTop={draftTop}
          draftHeight={draftHeight}
          draftVisible={draftVisible}
          anchorMinutes={anchorMinutes}
          startGridY={startGridY}
          commitPending={commitPending}
          setDraft={setDraft}
          clearDraft={clearDraft}
          onUpdate={onUpdate}
        />
      ))}
      <Animated.View
        pointerEvents="none"
        style={[styles.block, styles.draftBlock, draftStyle]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
    </View>
  );
}

interface BlockedTimeBlockProps {
  block: BlockedTimeWindow;
  index: number;
  layout: CalendarGestureLayout;
  editable: boolean;
  activeIndex: SharedValue<number>;
  draftTop: SharedValue<number>;
  draftHeight: SharedValue<number>;
  draftVisible: SharedValue<boolean>;
  anchorMinutes: SharedValue<number>;
  startGridY: SharedValue<number>;
  commitPending: SharedValue<boolean>;
  setDraft: (block: BlockedTimeWindow) => void;
  clearDraft: () => void;
  onUpdate: (index: number, block: BlockedTimeWindow) => void;
}

function BlockedTimeBlock({
  block,
  index,
  layout,
  editable,
  activeIndex,
  draftTop,
  draftHeight,
  draftVisible,
  anchorMinutes,
  startGridY,
  commitPending,
  setDraft,
  clearDraft,
  onUpdate,
}: BlockedTimeBlockProps) {
  const box = blockTopHeight(block, layout);
  const bodyTop = Math.min(HANDLE_HIT_PX, Math.max(0, box.height / 3));
  const bodyBottom = bodyTop;
  const timeLabel = `${formatMinutes(block.startMinutes)}–${formatMinutes(block.endMinutes)}`;

  const blockStyle = useAnimatedStyle(() => {
    const active = activeIndex.value === index && draftVisible.value;
    return {
      top: active ? draftTop.value : box.top,
      height: active ? draftHeight.value : box.height,
    };
  });

  const moveGesture = useBlockGesture({
    block,
    index,
    layout,
    editable,
    edge: null,
    regionOffsetY: bodyTop,
    boxTop: box.top,
    activeIndex,
    anchorMinutes,
    startGridY,
    commitPending,
    setDraft,
    clearDraft,
    onUpdate,
  });
  const topGesture = useBlockGesture({
    block,
    index,
    layout,
    editable,
    edge: "top",
    regionOffsetY: 0,
    boxTop: box.top,
    activeIndex,
    anchorMinutes,
    startGridY,
    commitPending,
    setDraft,
    clearDraft,
    onUpdate,
  });
  const bottomGesture = useBlockGesture({
    block,
    index,
    layout,
    editable,
    edge: "bottom",
    regionOffsetY: Math.max(0, box.height - HANDLE_HIT_PX),
    boxTop: box.top,
    activeIndex,
    anchorMinutes,
    startGridY,
    commitPending,
    setDraft,
    clearDraft,
    onUpdate,
  });

  return (
    <Animated.View
      accessibilityLabel={BLOCKED_TIME_LABEL}
      accessible
      style={[styles.block, blockStyle]}
    >
      <View style={styles.blockTint} pointerEvents="none">
        <Text style={styles.blockTitle} numberOfLines={1}>
          {BLOCKED_TIME_LABEL}
        </Text>
        <Text style={styles.blockTime} numberOfLines={1}>
          {timeLabel}
        </Text>
      </View>
      {editable ? (
        <>
          <GestureDetector gesture={topGesture}>
            <Animated.View style={[styles.handle, styles.topHandle]} />
          </GestureDetector>
          <GestureDetector gesture={moveGesture}>
            <Animated.View style={[styles.moveHandle, { top: bodyTop, bottom: bodyBottom }]} />
          </GestureDetector>
          <GestureDetector gesture={bottomGesture}>
            <Animated.View style={[styles.handle, styles.bottomHandle]} />
          </GestureDetector>
        </>
      ) : null}
    </Animated.View>
  );
}

interface UseBlockGestureInput {
  block: BlockedTimeWindow;
  index: number;
  layout: CalendarGestureLayout;
  editable: boolean;
  edge: ResizeEdge | null;
  regionOffsetY: number;
  boxTop: number;
  activeIndex: SharedValue<number>;
  anchorMinutes: SharedValue<number>;
  startGridY: SharedValue<number>;
  commitPending: SharedValue<boolean>;
  setDraft: (block: BlockedTimeWindow) => void;
  clearDraft: () => void;
  onUpdate: (index: number, block: BlockedTimeWindow) => void;
}

function useBlockGesture({
  block,
  index,
  layout,
  editable,
  edge,
  regionOffsetY,
  boxTop,
  activeIndex,
  anchorMinutes,
  startGridY,
  commitPending,
  setDraft,
  clearDraft,
  onUpdate,
}: UseBlockGestureInput) {
  return useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .minDistance(BLOCKED_TIME_MOVE_THRESHOLD_PX)
        .activateAfterLongPress(BLOCKED_TIME_LONG_PRESS_MS)
        .onStart((event) => {
          if (!editable) return;
          const gridY = boxTop + regionOffsetY + event.y;
          activeIndex.value = index;
          anchorMinutes.value = yToCalendarMinutes(gridY, layout);
          startGridY.value = gridY;
          setDraft(block);
        })
        .onUpdate((event) => {
          if (!editable || activeIndex.value !== index) return;
          const currentY = startGridY.value + event.translationY;
          setDraft(
            edge
              ? resizeBlockedTimeDraft(block, edge, currentY, layout)
              : moveBlockedTimeDraft(block, anchorMinutes.value, currentY, layout),
          );
        })
        .onEnd((event) => {
          if (!editable || activeIndex.value !== index) return;
          const currentY = startGridY.value + event.translationY;
          const draft = edge
            ? resizeBlockedTimeDraft(block, edge, currentY, layout)
            : moveBlockedTimeDraft(block, anchorMinutes.value, currentY, layout);
          if (draft.startMinutes !== block.startMinutes || draft.endMinutes !== block.endMinutes) {
            commitPending.value = true;
            onUpdate(index, draft);
          } else {
            clearDraft();
          }
        })
        .onFinalize(() => {
          if (activeIndex.value === index && !commitPending.value) clearDraft();
        }),
    [
      activeIndex,
      anchorMinutes,
      block,
      boxTop,
      clearDraft,
      commitPending,
      edge,
      editable,
      index,
      layout,
      onUpdate,
      regionOffsetY,
      setDraft,
      startGridY,
    ],
  );
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  block: {
    position: "absolute",
    left: BLOCK_INSET_PX,
    right: BLOCK_INSET_PX,
    zIndex: 2,
    borderRadius: 5,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.faint,
    backgroundColor: Surface.translucentStrong,
    overflow: "hidden",
  },
  draftBlock: {
    borderStyle: "dashed",
  },
  blockTint: {
    flex: 1,
    paddingHorizontal: 5,
    paddingVertical: 3,
    justifyContent: "center",
    gap: 1,
  },
  blockTitle: {
    fontFamily: Fonts.monoMedium,
    fontSize: 9.5,
    fontWeight: "700",
    color: Surface.dimmed,
  },
  blockTime: {
    fontFamily: Fonts.mono,
    fontSize: 8.5,
    color: Surface.faint,
  },
  handle: {
    position: "absolute",
    left: 0,
    right: 0,
    height: HANDLE_HIT_PX,
    zIndex: 3,
  },
  topHandle: {
    top: 0,
  },
  bottomHandle: {
    bottom: 0,
  },
  moveHandle: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 2,
  },
});
