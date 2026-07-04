import type { SidebarResizeController } from "./useSidebarResize";
import { SIDEBAR_MAX_WIDTH_PX, SIDEBAR_MIN_WIDTH_PX } from "./useSidebarResize";

/**
 * The vertical drag handle for a resizable desktop sidebar, plus the floating
 * preview line shown while dragging. Place it immediately after the sidebar
 * element (whose ref is `controller.asideRef`) in a horizontal flex/grid row.
 */
export function SidebarResizeHandle({ controller }: { controller: SidebarResizeController }) {
  const { width, previewLineRef, handleProps } = controller;
  return (
    <>
      <div
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- WAI-ARIA window-splitter resize handle, not an <hr>
        role="separator"
        aria-label="Resize sidebar"
        aria-orientation="vertical"
        aria-valuemin={SIDEBAR_MIN_WIDTH_PX}
        aria-valuemax={SIDEBAR_MAX_WIDTH_PX}
        aria-valuenow={Math.round(width)}
        tabIndex={0}
        onKeyDown={handleProps.onKeyDown}
        onPointerDown={handleProps.onPointerDown}
        onPointerMove={handleProps.onPointerMove}
        onPointerUp={handleProps.onPointerUp}
        style={{
          width: 6,
          flexShrink: 0,
          cursor: "col-resize",
          backgroundColor: "var(--app-border)",
          transition: "background-color 0.15s",
          zIndex: 1,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.backgroundColor = "var(--app-border-strong)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.backgroundColor = "var(--app-border)";
        }}
      />
      <div
        ref={previewLineRef}
        aria-hidden="true"
        style={{
          display: "none",
          position: "fixed",
          top: 0,
          bottom: 0,
          width: 2,
          marginLeft: -1,
          backgroundColor: "var(--app-border-strong)",
          pointerEvents: "none",
          zIndex: 1000,
        }}
      />
    </>
  );
}
