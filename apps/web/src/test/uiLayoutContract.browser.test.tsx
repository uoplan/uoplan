import { page } from "vitest/browser";
import { expect, test } from "vitest";

import { Box, Group, Stack, Text, Title } from "@uoplan/ui";

import { renderWithProviders } from "./renderWithProviders";

/**
 * Component-contract resolution proof for the layout/typography primitives
 * (web side). Each primitive splits into `.web.tsx` (Mantine) and `.native.tsx`
 * (React Native); this confirms Vite resolves the `.web.tsx` variant, the
 * shared `testID` maps onto `data-testid`, and Mantine renders. The native
 * variants are covered by RNTL tests in apps/native.
 */

test("@uoplan/ui Box resolves to the Mantine (.web) variant", async () => {
  await renderWithProviders(
    <Box testID="contract-box" p="md">
      box content
    </Box>,
  );
  const box = page.getByTestId("contract-box");
  await expect.element(box).toBeInTheDocument();
  await expect.element(box).toHaveTextContent("box content");
});

test("@uoplan/ui Stack resolves to the Mantine (.web) variant", async () => {
  await renderWithProviders(
    <Stack testID="contract-stack" gap="sm">
      <span>a</span>
      <span>b</span>
    </Stack>,
  );
  const stack = page.getByTestId("contract-stack");
  await expect.element(stack).toBeInTheDocument();
  await expect.element(stack).toHaveClass(/mantine-Stack-root/);
});

test("@uoplan/ui Group resolves to the Mantine (.web) variant", async () => {
  await renderWithProviders(
    <Group testID="contract-group" gap="sm">
      <span>a</span>
      <span>b</span>
    </Group>,
  );
  const group = page.getByTestId("contract-group");
  await expect.element(group).toBeInTheDocument();
  await expect.element(group).toHaveClass(/mantine-Group-root/);
});

test("@uoplan/ui Text resolves to the Mantine (.web) variant", async () => {
  await renderWithProviders(
    <Text testID="contract-text" size="sm" weight="bold">
      shared text
    </Text>,
  );
  const text = page.getByTestId("contract-text");
  await expect.element(text).toBeInTheDocument();
  await expect.element(text).toHaveClass(/mantine-Text-root/);
  await expect.element(text).toHaveTextContent("shared text");
});

test("@uoplan/ui Title resolves to the Mantine (.web) variant", async () => {
  await renderWithProviders(
    <Title testID="contract-title" order={2}>
      shared title
    </Title>,
  );
  const title = page.getByTestId("contract-title");
  await expect.element(title).toBeInTheDocument();
  await expect.element(title).toHaveClass(/mantine-Title-root/);
});
