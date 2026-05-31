import { Drawer } from "@mantine/core";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

const SURFACE_STYLE = {
  backgroundColor: "var(--app-surface)",
  borderTop: "var(--app-border-width) solid var(--app-border)",
};

const DISMISS_DISTANCE = 80;
const DISMISS_VELOCITY = 0.5;

type CalendarMobileDrawerProps = {
  opened: boolean;
  onClose: () => void;
  title: string;
  ariaLabel: string;
  children: ReactNode;
};

export function CalendarMobileDrawer({
  opened,
  onClose,
  title,
  ariaLabel,
  children,
}: CalendarMobileDrawerProps) {
  const [dragOffset, setDragOffset] = useState(0);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startTime = useRef(0);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!opened) setDragOffset(0);
  }, [opened]);

  function handleTouchStart(e: React.TouchEvent) {
    startY.current = e.touches[0].clientY;
    startTime.current = Date.now();
    isDragging.current = true;
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!isDragging.current) return;

    const delta = e.touches[0].clientY - startY.current;
    if (delta <= 0) return;

    // Don't steal scroll when body is scrolled down
    if (bodyRef.current && bodyRef.current.scrollTop > 0) {
      isDragging.current = false;
      return;
    }

    setDragOffset(delta);
  }

  function handleTouchEnd() {
    if (!isDragging.current) return;
    isDragging.current = false;

    const elapsed = Date.now() - startTime.current;
    const velocity = elapsed > 0 ? dragOffset / elapsed : 0;

    if (dragOffset > DISMISS_DISTANCE || velocity > DISMISS_VELOCITY) {
      setDragOffset(0);
      onClose();
    } else {
      setDragOffset(0);
    }
  }

  return (
    <Drawer.Root opened={opened} onClose={onClose} position="bottom" size="auto">
      <Drawer.Overlay backgroundOpacity={0.5} />
      <Drawer.Content
        aria-label={ariaLabel}
        style={{
          ...SURFACE_STYLE,
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          transform: `translateY(${dragOffset}px)`,
          transition: isDragging.current
            ? "none"
            : "transform 0.25s cubic-bezier(0.32, 0.72, 0, 1)",
        }}
      >
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}
        >
          <div
            style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              background: "var(--app-border-strong)",
              margin: "10px auto 0",
              flexShrink: 0,
            }}
          />
          <Drawer.Header
            style={{
              ...SURFACE_STYLE,
              borderBottom: "var(--app-border-width) solid var(--app-border)",
              flexShrink: 0,
            }}
          >
            <Drawer.Title
              style={{
                color: "var(--app-text)",
                fontFamily: "var(--app-font-heading)",
                fontWeight: 400,
              }}
            >
              {title}
            </Drawer.Title>
            <Drawer.CloseButton style={{ color: "var(--app-text-dim)" }} />
          </Drawer.Header>
          <Drawer.Body
            style={{
              flex: 1,
              minHeight: 0,
              overflow: "hidden",
              padding: 0,
            }}
          >
            <div
              ref={bodyRef}
              style={{
                height: "100%",
                overflowY: "auto",
                overflowX: "hidden",
                overscrollBehavior: "contain",
                paddingTop: 8,
                paddingBottom: "max(12px, env(safe-area-inset-bottom, 0px))",
                paddingLeft: 16,
                paddingRight: 16,
              }}
            >
              {children}
            </div>
          </Drawer.Body>
        </div>
      </Drawer.Content>
    </Drawer.Root>
  );
}
