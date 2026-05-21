import { useEffect, useRef, useState } from "react";

const DISMISS_DISTANCE = 80;
const DISMISS_VELOCITY = 0.5;

type UseDragToDismissOptions = {
  opened: boolean;
  onClose: () => void;
  scrollRef?: React.RefObject<HTMLElement | null>;
};

export function useDragToDismiss({ opened, onClose, scrollRef }: UseDragToDismissOptions) {
  const [dragOffset, setDragOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startTime = useRef(0);
  const currentOffset = useRef(0);

  useEffect(() => {
    if (!opened) {
      setDragOffset(0);
      setDragging(false);
    }
  }, [opened]);

  function onTouchStart(e: React.TouchEvent) {
    startY.current = e.touches[0].clientY;
    startTime.current = Date.now();
    isDragging.current = true;
    currentOffset.current = 0;
    setDragging(true);
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!isDragging.current) return;

    const delta = e.touches[0].clientY - startY.current;
    if (delta <= 0) return;

    if (scrollRef?.current && scrollRef.current.scrollTop > 0) {
      isDragging.current = false;
      setDragging(false);
      return;
    }

    currentOffset.current = delta;
    setDragOffset(delta);
  }

  function onTouchEnd() {
    if (!isDragging.current) return;
    isDragging.current = false;
    setDragging(false);

    const elapsed = Date.now() - startTime.current;
    const velocity = elapsed > 0 ? currentOffset.current / elapsed : 0;

    if (currentOffset.current > DISMISS_DISTANCE || velocity > DISMISS_VELOCITY) {
      setDragOffset(0);
      onClose();
    } else {
      setDragOffset(0);
    }
  }

  return {
    dragOffset,
    dragging,
    handlers: { onTouchStart, onTouchMove, onTouchEnd },
  };
}
