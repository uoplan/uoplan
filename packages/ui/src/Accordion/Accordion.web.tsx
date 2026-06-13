import { Accordion as MantineAccordion } from "@mantine/core";

import type { AccordionProps } from "./Accordion.types";

/** Web (Mantine) implementation of the Accordion contract. */
export function Accordion({ items, multiple, defaultOpen = [], testID }: AccordionProps) {
  const children = items.map((item) => (
    <MantineAccordion.Item key={item.value} value={item.value}>
      <MantineAccordion.Control>{item.label}</MantineAccordion.Control>
      <MantineAccordion.Panel>{item.content}</MantineAccordion.Panel>
    </MantineAccordion.Item>
  ));

  if (multiple) {
    return (
      <MantineAccordion multiple defaultValue={defaultOpen} data-testid={testID}>
        {children}
      </MantineAccordion>
    );
  }

  return (
    <MantineAccordion defaultValue={defaultOpen[0] ?? null} data-testid={testID}>
      {children}
    </MantineAccordion>
  );
}
