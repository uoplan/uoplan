import { Menu as MantineMenu } from "@mantine/core";

import type { MenuProps } from "./Menu.types";

/** Web (Mantine) implementation of the Menu contract. */
export function Menu({ target, items, testID }: MenuProps) {
  return (
    <MantineMenu withinPortal>
      <MantineMenu.Target>
        <span style={{ display: "inline-flex" }}>{target}</span>
      </MantineMenu.Target>
      <MantineMenu.Dropdown data-testid={testID}>
        {items.map((item) => (
          <MantineMenu.Item key={item.value} onClick={item.onSelect}>
            {item.label}
          </MantineMenu.Item>
        ))}
      </MantineMenu.Dropdown>
    </MantineMenu>
  );
}
