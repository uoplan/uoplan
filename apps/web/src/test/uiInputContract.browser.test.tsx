import { page } from "vitest/browser";
import { expect, test } from "vitest";

import { Modal, NumberInput, Radio, SegmentedControl } from "@uoplan/ui";

import { renderWithProviders } from "./renderWithProviders";

/**
 * Component-contract resolution proof for the input/overlay primitives (web
 * side): NumberInput, Radio, SegmentedControl, Modal. Each splits into
 * `.web.tsx` (Mantine) and `.native.tsx` (React Native); this confirms Vite
 * resolves the `.web.tsx` variant and `testID` maps onto `data-testid`. Native
 * variants are covered by RNTL tests in apps/native.
 */

test("@uoplan/ui NumberInput resolves + reports edits", async () => {
  let latest: number | undefined;
  await renderWithProviders(
    <NumberInput testID="contract-number" onChange={(n) => (latest = n)} placeholder="count" />,
  );
  const el = page.getByTestId("contract-number");
  await expect.element(el).toBeInTheDocument();
  await el.fill("7");
  expect(latest).toBe(7);
});

test("@uoplan/ui Radio resolves + reports selection", async () => {
  let selected = "";
  await renderWithProviders(
    <Radio
      testID="contract-radio"
      onChange={(v) => (selected = v)}
      data={[
        { value: "a", label: "Option A" },
        { value: "b", label: "Option B" },
      ]}
    />,
  );
  await expect.element(page.getByTestId("contract-radio")).toBeInTheDocument();
  await page.getByText("Option B").click();
  expect(selected).toBe("b");
});

test("@uoplan/ui SegmentedControl resolves + reports selection", async () => {
  let selected = "";
  await renderWithProviders(
    <SegmentedControl
      testID="contract-segmented"
      value="a"
      onChange={(v) => (selected = v)}
      data={[
        { value: "a", label: "First" },
        { value: "b", label: "Second" },
      ]}
    />,
  );
  await expect.element(page.getByTestId("contract-segmented")).toBeInTheDocument();
  await page.getByText("Second").click();
  expect(selected).toBe("b");
});

test("@uoplan/ui Modal resolves to the Mantine (.web) variant when opened", async () => {
  await renderWithProviders(
    <Modal opened onClose={() => {}} title="Dialog">
      <span>modal body</span>
    </Modal>,
  );
  await expect.element(page.getByText("modal body")).toBeInTheDocument();
  await expect.element(page.getByText("Dialog")).toBeInTheDocument();
});
