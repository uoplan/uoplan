import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Drawer, Group } from "@mantine/core";

const SURFACE = "var(--app-surface)";

const DISMISS_DISTANCE = 80;
const DISMISS_VELOCITY = 0.5;

export interface BottomDrawerProps {
  opened: boolean;
  onClose: () => void;
  /** Visible heading rendered in the sticky header. */
  title?: ReactNode;
  /** Accessible label for the dialog (used when there is no visible title). */
  ariaLabel?: string;
  /** Show the built-in close button (default: true). */
  withCloseButton?: boolean;
  /** Extra controls rendered in the header, before the close button. */
  headerActions?: ReactNode;
  /** Overlay darkness, 0-1 (default: 0.45). */
  overlayOpacity?: number;
  /** Maximum sheet height (default: "85dvh"). */
  maxHeight?: string;
  /** Allow swipe-down-to-dismiss when the body is scrolled to the top (default: true). */
  dismissible?: boolean;
  /** Extra styles applied to the scrolling body (e.g. padding). */
  bodyStyle?: CSSProperties;
  /** Body content. The body scrolls; callers control inner padding via `bodyStyle`. */
  children: ReactNode;
}

/**
 * Mobile bottom-sheet drawer with the shared fixes baked in.
 *
 * Mantine's `Drawer.Content` forwards its flat `style`/`className` prop to BOTH
 * the content element AND the full-screen `inner` wrapper (see DrawerContent →
 * ModalBaseContent). Styling the sheet via that prop therefore leaks the surface
 * background across the whole viewport (a full-width strip behind the sheet) and
 * mis-sizes the content. This component routes ALL styling through the `styles`
 * API instead, which is correctly scoped per element, anchors the sheet to the
 * bottom at full width, keeps the `inner` wrapper transparent, and rounds only
 * the top corners. Includes optional swipe-down-to-dismiss.
 */
export function BottomDrawer({
  opened,
  onClose,
  title,
  ariaLabel,
  withCloseButton = true,
  headerActions,
  overlayOpacity = 0.45,
  maxHeight = "85dvh",
  dismissible = true,
  bodyStyle,
  children,
}: BottomDrawerProps) {
  const hasHeader = title != null || withCloseButton || headerActions != null;

  const [dragOffset, setDragOffset] = useState(0);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startTime = useRef(0);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!opened) setDragOffset(0);
  }, [opened]);

  function handleTouchStart(e: React.TouchEvent) {
    if (!dismissible) return;
    // Only start a dismiss drag when the body is scrolled to the top.
    if (bodyRef.current && bodyRef.current.scrollTop > 0) return;
    startY.current = e.touches[0].clientY;
    startTime.current = Date.now();
    isDragging.current = true;
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!isDragging.current) return;

    const delta = e.touches[0].clientY - startY.current;
    if (delta <= 0) return;

    // Don't steal scroll once the body has scrolled away from the top.
    if (bodyRef.current && bodyRef.current.scrollTop > 0) {
      isDragging.current = false;
      setDragOffset(0);
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
    <Drawer.Root
      opened={opened}
      onClose={onClose}
      position="bottom"
      size="auto"
      styles={{
        inner: {
          top: "auto",
          bottom: 0,
          left: 0,
          right: 0,
          height: "auto",
          background: "transparent",
          justifyContent: "center",
          alignItems: "flex-end",
        },
        content: {
          backgroundColor: SURFACE,
          width: "100%",
          maxWidth: "100%",
          maxHeight,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          borderTopLeftRadius: "var(--app-radius-lg)",
          borderTopRightRadius: "var(--app-radius-lg)",
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          borderTop: "1px solid var(--app-border)",
          transform: dragOffset ? `translateY(${dragOffset}px)` : undefined,
          transition: isDragging.current
            ? "none"
            : "transform 0.25s cubic-bezier(0.32, 0.72, 0, 1)",
        },
        header: {
          backgroundColor: SURFACE,
          borderBottom: "1px solid var(--app-border)",
          minHeight: 0,
          paddingTop: "var(--mantine-spacing-xs)",
          paddingBottom: "var(--mantine-spacing-xs)",
          flexShrink: 0,
        },
        title: {
          color: "var(--app-text)",
          fontWeight: 600,
          fontSize: "var(--mantine-font-size-md)",
        },
        close: { color: "var(--app-text-dim)" },
        body: {
          backgroundColor: SURFACE,
          flex: 1,
          minHeight: 0,
          padding: 0,
          overflowY: "auto",
          overscrollBehavior: "contain",
          ...bodyStyle,
        },
      }}
    >
      <Drawer.Overlay backgroundOpacity={overlayOpacity} />
      <Drawer.Content
        aria-label={ariaLabel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          aria-hidden
          style={{
            width: 36,
            height: 4,
            borderRadius: 2,
            background: "var(--app-border-strong)",
            margin: "10px auto 0",
            flexShrink: 0,
          }}
        />
        {hasHeader ? (
          <Drawer.Header>
            {title != null ? <Drawer.Title>{title}</Drawer.Title> : <span />}
            {headerActions != null || withCloseButton ? (
              <Group gap={4} wrap="nowrap">
                {headerActions}
                {withCloseButton ? <Drawer.CloseButton /> : null}
              </Group>
            ) : null}
          </Drawer.Header>
        ) : null}
        <Drawer.Body ref={bodyRef}>{children}</Drawer.Body>
      </Drawer.Content>
    </Drawer.Root>
  );
}
