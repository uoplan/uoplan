import { Tabs as MantineTabs } from "@mantine/core";

import type { TabsProps } from "./Tabs.types";

/** Web (Mantine) implementation of the Tabs contract. */
export function Tabs({ value, onChange, items, testID }: TabsProps) {
  return (
    <MantineTabs
      value={value}
      onChange={(next) => {
        if (next != null) onChange(next);
      }}
      data-testid={testID}
    >
      <MantineTabs.List>
        {items.map((item) => (
          <MantineTabs.Tab key={item.value} value={item.value}>
            {item.label}
          </MantineTabs.Tab>
        ))}
      </MantineTabs.List>
      {items.map((item) => (
        <MantineTabs.Panel key={item.value} value={item.value} pt="sm">
          {item.content}
        </MantineTabs.Panel>
      ))}
    </MantineTabs>
  );
}
