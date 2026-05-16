import { Drawer } from "@mantine/core";
import type { ReactNode } from "react";

const SURFACE_STYLE = {
  backgroundColor: "rgba(30, 30, 32, 0.98)",
  borderTop: "2px solid #2C2E33",
};

export type CalendarMobileDrawerProps = {
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
  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="bottom"
      size="auto"
      title={title}
      overlayProps={{ backgroundOpacity: 0.5 }}
      styles={{
        content: {
          ...SURFACE_STYLE,
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        },
        header: {
          ...SURFACE_STYLE,
          flexShrink: 0,
          borderBottom: "1px solid rgba(134, 142, 150, 0.2)",
        },
        title: {
          color: "#F8F9FA",
          fontFamily: '"DM Serif Display", serif',
          fontWeight: 400,
        },
        close: { color: "#868e96" },
        body: {
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
          overscrollBehavior: "contain",
          paddingTop: 8,
          paddingBottom: "max(12px, env(safe-area-inset-bottom, 0px))",
        },
      }}
      aria-label={ariaLabel}
    >
      {children}
    </Drawer>
  );
}
