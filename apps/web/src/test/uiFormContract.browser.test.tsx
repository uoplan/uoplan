import { page } from "vitest/browser";
import { expect, test } from "vitest";

import { Alert, Anchor, Checkbox, Pill, Progress, Skeleton, Switch, TextInput } from "@uoplan/ui";

import { renderWithProviders } from "./renderWithProviders";

/**
 * Component-contract resolution proof for the form/feedback primitives (web
 * side): Anchor, TextInput, Checkbox, Switch, Alert, Progress, Skeleton, Pill.
 * Each splits into `.web.tsx` (Mantine) and `.native.tsx` (React Native); this
 * confirms Vite resolves the `.web.tsx` variant and `testID` maps onto
 * `data-testid`. Native variants are covered by RNTL tests in apps/native.
 */

test("@uoplan/ui Anchor resolves to the Mantine (.web) variant + onPress", async () => {
  let pressed = 0;
  await renderWithProviders(
    <Anchor testID="contract-anchor" onPress={() => (pressed += 1)}>
      link
    </Anchor>,
  );
  const el = page.getByTestId("contract-anchor");
  await expect.element(el).toBeInTheDocument();
  await el.click();
  expect(pressed).toBe(1);
});

test("@uoplan/ui TextInput resolves + reports edits", async () => {
  let latest = "";
  await renderWithProviders(
    <TextInput testID="contract-input" onChangeText={(t) => (latest = t)} placeholder="type" />,
  );
  const el = page.getByTestId("contract-input");
  await expect.element(el).toBeInTheDocument();
  await el.fill("hello");
  expect(latest).toBe("hello");
});

test("@uoplan/ui Checkbox resolves + reports toggle", async () => {
  let checked = false;
  await renderWithProviders(
    <Checkbox testID="contract-checkbox" onChange={(c) => (checked = c)} label="agree" />,
  );
  const el = page.getByTestId("contract-checkbox");
  await expect.element(el).toBeInTheDocument();
  await el.click();
  expect(checked).toBe(true);
});

test("@uoplan/ui Switch resolves to the Mantine (.web) variant", async () => {
  let checked = false;
  await renderWithProviders(<Switch testID="contract-switch" onChange={(c) => (checked = c)} />);
  const el = page.getByTestId("contract-switch");
  await expect.element(el).toBeInTheDocument();
  await el.click();
  expect(checked).toBe(true);
});

test("@uoplan/ui Alert resolves to the Mantine (.web) variant", async () => {
  await renderWithProviders(
    <Alert testID="contract-alert" tone="warning" title="heads up">
      something happened
    </Alert>,
  );
  const el = page.getByTestId("contract-alert");
  await expect.element(el).toBeInTheDocument();
  await expect.element(el).toHaveTextContent("something happened");
});

test("@uoplan/ui Progress resolves to the Mantine (.web) variant", async () => {
  await renderWithProviders(<Progress testID="contract-progress" value={42} />);
  await expect.element(page.getByTestId("contract-progress")).toBeInTheDocument();
});

test("@uoplan/ui Skeleton resolves to the Mantine (.web) variant", async () => {
  await renderWithProviders(<Skeleton testID="contract-skeleton" height={24} />);
  await expect.element(page.getByTestId("contract-skeleton")).toBeInTheDocument();
});

test("@uoplan/ui Pill resolves to the Mantine (.web) variant", async () => {
  await renderWithProviders(<Pill testID="contract-pill">filter</Pill>);
  const el = page.getByTestId("contract-pill");
  await expect.element(el).toBeInTheDocument();
  await expect.element(el).toHaveTextContent("filter");
});
