import { Drawer, ScrollArea } from "@mantine/core";
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
        content: { ...SURFACE_STYLE, maxHeight: "85vh" },
        header: {
          ...SURFACE_STYLE,
          borderBottom: "1px solid rgba(134, 142, 150, 0.2)",
        },
        title: {
          color: "#F8F9FA",
          fontFamily: '"DM Serif Display", serif',
          fontWeight: 400,
        },
        close: { color: "#868e96" },
        body: { paddingTop: 8 },
      }}
      aria-label={ariaLabel}
    >
      <ScrollArea.Autosize mah="calc(85vh - 60px)" type="auto" offsetScrollbars>
        {children}
      </ScrollArea.Autosize>
    </Drawer>
  );
}
