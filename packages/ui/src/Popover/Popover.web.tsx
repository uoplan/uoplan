import { Popover as MantinePopover } from "@mantine/core";

import type { PopoverProps } from "./Popover.types";

/** Web (Mantine) implementation of the Popover contract. */
export function Popover({ opened, onChange, target, children, testID }: PopoverProps) {
  return (
    <MantinePopover opened={opened} onChange={onChange} withinPortal>
      <MantinePopover.Target>
        {/* Plain anchor span: Mantine positions the dropdown against it. The
            consumer's `target` owns toggling (its onPress flips `opened`). */}
        <span style={{ display: "inline-flex" }}>{target}</span>
      </MantinePopover.Target>
      <MantinePopover.Dropdown data-testid={testID}>{children}</MantinePopover.Dropdown>
    </MantinePopover>
  );
}
