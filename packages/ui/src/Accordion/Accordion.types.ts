import type { ReactNode } from "react";

/**
 * Shared prop contract for the Accordion primitive — a stack of expandable
 * sections. Web maps onto Mantine's compound `Accordion`; native onto pressable
 * headers with toggled content. The `items` model (value + label + content)
 * keeps the API platform-neutral; open state is uncontrolled (seeded by
 * `defaultOpen`).
 */
export interface AccordionItem {
  value: string;
  label: string;
  content: ReactNode;
}

export interface AccordionProps {
  /** The sections to render. */
  items: AccordionItem[];
  /** Allow more than one section open at a time. */
  multiple?: boolean;
  /** Section value(s) open on first render. */
  defaultOpen?: string[];
  /** Test hook: maps to `data-testid` (web) / `testID` (native). */
  testID?: string;
}
