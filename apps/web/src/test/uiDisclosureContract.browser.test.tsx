import { useState } from "react";
import { page } from "vitest/browser";
import { expect, test } from "vitest";

import { Accordion, Collapse, Tabs } from "@uoplan/ui";

import { renderWithProviders } from "./renderWithProviders";

/**
 * Component-contract resolution proof for the disclosure-tier primitives (web
 * side): Tabs, Accordion, Collapse. Each splits into `.web.tsx` (Mantine) and
 * `.native.tsx` (React Native); this confirms Vite resolves the `.web.tsx`
 * variant and the contract behaviours work. Native variants are covered by RNTL
 * tests in apps/native.
 */

function ControlledTabs() {
  const [value, setValue] = useState("a");
  return (
    <Tabs
      testID="contract-tabs"
      value={value}
      onChange={setValue}
      items={[
        { value: "a", label: "Tab A", content: <div>PANEL A</div> },
        { value: "b", label: "Tab B", content: <div>PANEL B</div> },
      ]}
    />
  );
}

test("@uoplan/ui Tabs resolves + switches the active panel", async () => {
  await renderWithProviders(<ControlledTabs />);
  await expect.element(page.getByText("PANEL A")).toBeVisible();
  await page.getByText("Tab B").click();
  await expect.element(page.getByText("PANEL B")).toBeVisible();
});

test("@uoplan/ui Accordion resolves + expands a section on click", async () => {
  await renderWithProviders(
    <Accordion
      testID="contract-accordion"
      items={[
        { value: "one", label: "Section one", content: <div>BODY ONE</div> },
        { value: "two", label: "Section two", content: <div>BODY TWO</div> },
      ]}
    />,
  );
  await expect.element(page.getByText("Section one")).toBeInTheDocument();
  await page.getByText("Section two").click();
  await expect.element(page.getByText("BODY TWO")).toBeVisible();
});

test("@uoplan/ui Collapse resolves + reveals its content when open", async () => {
  await renderWithProviders(
    <Collapse open testID="contract-collapse">
      <div>COLLAPSE BODY</div>
    </Collapse>,
  );
  await expect.element(page.getByText("COLLAPSE BODY")).toBeVisible();
});
