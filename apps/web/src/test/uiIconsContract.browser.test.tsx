import { page } from "vitest/browser";
import { expect, test, vi } from "vitest";

import { ActionIcon, Indicator, ThemeIcon } from "@uoplan/ui";

import { renderWithProviders } from "./renderWithProviders";

/**
 * Component-contract resolution proof for the icon-tier primitives (web side):
 * ActionIcon, ThemeIcon, Indicator. Each splits into `.web.tsx` (Mantine) and
 * `.native.tsx` (React Native); this confirms Vite resolves the `.web.tsx`
 * variant and the contract behaviours work. Native variants are covered by
 * RNTL tests in apps/native.
 */

test("@uoplan/ui ActionIcon resolves + fires onPress", async () => {
  const onPress = vi.fn();
  await renderWithProviders(
    <ActionIcon testID="contract-action" label="refresh" onPress={onPress}>
      <span>R</span>
    </ActionIcon>,
  );
  const el = page.getByTestId("contract-action");
  await expect.element(el).toBeInTheDocument();
  await el.click();
  expect(onPress).toHaveBeenCalledTimes(1);
});

test("@uoplan/ui ThemeIcon resolves + frames its child", async () => {
  await renderWithProviders(
    <ThemeIcon testID="contract-theme-icon" tone="success">
      <span>TI</span>
    </ThemeIcon>,
  );
  await expect.element(page.getByTestId("contract-theme-icon")).toBeInTheDocument();
  await expect.element(page.getByText("TI")).toBeInTheDocument();
});

test("@uoplan/ui Indicator resolves + shows label over its child", async () => {
  await renderWithProviders(
    <Indicator label={3} tone="danger">
      <span>inbox</span>
    </Indicator>,
  );
  await expect.element(page.getByText("inbox")).toBeInTheDocument();
  await expect.element(page.getByText("3")).toBeInTheDocument();
});
