import { useState } from "react";
import { page } from "vitest/browser";
import { expect, test, vi } from "vitest";

import { Button, Drawer, Menu, MultiSelect, Popover, Select, Tooltip } from "@uoplan/ui";

import { renderWithProviders } from "./renderWithProviders";

/**
 * Component-contract resolution proof for the overlay/select-tier primitives (web
 * side): Tooltip, Popover, Menu, Select, MultiSelect, Drawer. Each splits into
 * `.web.tsx` (Mantine) and `.native.tsx` (React Native); this confirms Vite
 * resolves the `.web.tsx` variant and the contract behaviours work. Native
 * variants are covered by RNTL tests in apps/native.
 */

test("@uoplan/ui Tooltip resolves + renders its target", async () => {
  await renderWithProviders(
    <Tooltip label="Helpful hint">
      <Button>Hover me</Button>
    </Tooltip>,
  );
  await expect.element(page.getByText("Hover me")).toBeVisible();
});

function ControlledPopover() {
  const [opened, setOpened] = useState(false);
  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      target={<Button onPress={() => setOpened((o) => !o)}>Open popover</Button>}
    >
      <div>POPOVER BODY</div>
    </Popover>
  );
}

test("@uoplan/ui Popover resolves + opens its dropdown on target press", async () => {
  await renderWithProviders(<ControlledPopover />);
  await page.getByText("Open popover").click();
  await expect.element(page.getByText("POPOVER BODY")).toBeVisible();
});

test("@uoplan/ui Menu resolves + fires onSelect for the chosen item", async () => {
  const onSelect = vi.fn();
  await renderWithProviders(
    <Menu
      target={<Button>Open menu</Button>}
      items={[
        { value: "a", label: "Action A", onSelect },
        { value: "b", label: "Action B", onSelect: () => {} },
      ]}
    />,
  );
  await page.getByText("Open menu").click();
  await page.getByText("Action A").click();
  expect(onSelect).toHaveBeenCalledTimes(1);
});

function ControlledSelect() {
  const [value, setValue] = useState<string | null>(null);
  return (
    <>
      <div data-testid="select-value">{value ?? ""}</div>
      <Select
        value={value}
        onChange={setValue}
        placeholder="Pick one"
        data={[
          { value: "x", label: "Option X" },
          { value: "y", label: "Option Y" },
        ]}
      />
    </>
  );
}

test("@uoplan/ui Select resolves + selects an option", async () => {
  await renderWithProviders(<ControlledSelect />);
  await page.getByPlaceholder("Pick one").click();
  await page.getByText("Option Y").click();
  await expect.element(page.getByTestId("select-value")).toHaveTextContent("y");
});

function ControlledMultiSelect() {
  const [value, setValue] = useState<string[]>([]);
  return (
    <>
      <div data-testid="multiselect-value">{value.join(",")}</div>
      <MultiSelect
        value={value}
        onChange={setValue}
        placeholder="Pick many"
        data={[
          { value: "x", label: "Choice X" },
          { value: "y", label: "Choice Y" },
        ]}
      />
    </>
  );
}

test("@uoplan/ui MultiSelect resolves + selects an option", async () => {
  await renderWithProviders(<ControlledMultiSelect />);
  await page.getByPlaceholder("Pick many").click();
  await page.getByText("Choice X").click();
  await expect.element(page.getByTestId("multiselect-value")).toHaveTextContent("x");
});

function ControlledDrawer() {
  const [opened, setOpened] = useState(false);
  return (
    <>
      <Button onPress={() => setOpened(true)}>Open drawer</Button>
      <Drawer opened={opened} onClose={() => setOpened(false)} title="Panel">
        <div>DRAWER BODY</div>
      </Drawer>
    </>
  );
}

test("@uoplan/ui Drawer resolves + reveals content when opened", async () => {
  await renderWithProviders(<ControlledDrawer />);
  await page.getByText("Open drawer").click();
  await expect.element(page.getByText("DRAWER BODY")).toBeVisible();
});
