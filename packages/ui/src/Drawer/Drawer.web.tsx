import { Drawer as MantineDrawer } from "@mantine/core";

import type { DrawerProps } from "./Drawer.types";

/** Web (Mantine) implementation of the Drawer contract. */
export function Drawer({
  opened,
  onClose,
  title,
  position = "right",
  children,
  testID,
}: DrawerProps) {
  return (
    <MantineDrawer
      opened={opened}
      onClose={onClose}
      title={title}
      position={position}
      data-testid={testID}
    >
      {children}
    </MantineDrawer>
  );
}
