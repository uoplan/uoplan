import type { ReactNode } from "react";
import { BottomDrawer } from "../shared/BottomDrawer";

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
  return (
    <BottomDrawer
      opened={opened}
      onClose={onClose}
      title={title}
      ariaLabel={ariaLabel}
      overlayOpacity={0.5}
      maxHeight="85vh"
      bodyStyle={{
        paddingTop: 8,
        paddingBottom: "max(12px, env(safe-area-inset-bottom, 0px))",
        paddingLeft: 16,
        paddingRight: 16,
      }}
    >
      {children}
    </BottomDrawer>
  );
}
