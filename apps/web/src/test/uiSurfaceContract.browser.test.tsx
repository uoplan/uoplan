import { page } from "vitest/browser";
import { expect, test } from "vitest";

import { Badge, Card, Center, Divider, Loader, Paper } from "@uoplan/ui";

import { renderWithProviders } from "./renderWithProviders";

/**
 * Component-contract resolution proof for the surface/feedback primitives (web
 * side): Paper, Card, Divider, Center, Badge, Loader. Each splits into
 * `.web.tsx` (Mantine) and `.native.tsx` (React Native); this confirms Vite
 * resolves the `.web.tsx` variant and the shared `testID` maps onto
 * `data-testid`. Native variants are covered by RNTL tests in apps/native.
 */

test("@uoplan/ui Paper resolves to the Mantine (.web) variant", async () => {
  await renderWithProviders(
    <Paper testID="contract-paper" p="md" withBorder>
      paper content
    </Paper>,
  );
  const el = page.getByTestId("contract-paper");
  await expect.element(el).toBeInTheDocument();
  await expect.element(el).toHaveTextContent("paper content");
});

test("@uoplan/ui Card resolves to the Mantine (.web) variant", async () => {
  await renderWithProviders(<Card testID="contract-card">card content</Card>);
  const el = page.getByTestId("contract-card");
  await expect.element(el).toBeInTheDocument();
  await expect.element(el).toHaveTextContent("card content");
});

test("@uoplan/ui Divider resolves to the Mantine (.web) variant", async () => {
  await renderWithProviders(<Divider testID="contract-divider" />);
  await expect.element(page.getByTestId("contract-divider")).toBeInTheDocument();
});

test("@uoplan/ui Center resolves to the Mantine (.web) variant", async () => {
  await renderWithProviders(<Center testID="contract-center">centered</Center>);
  const el = page.getByTestId("contract-center");
  await expect.element(el).toBeInTheDocument();
  await expect.element(el).toHaveTextContent("centered");
});

test("@uoplan/ui Badge resolves to the Mantine (.web) variant", async () => {
  await renderWithProviders(
    <Badge testID="contract-badge" tone="accent">
      new
    </Badge>,
  );
  const el = page.getByTestId("contract-badge");
  await expect.element(el).toBeInTheDocument();
  await expect.element(el).toHaveTextContent("new");
});

test("@uoplan/ui Loader resolves to the Mantine (.web) variant", async () => {
  await renderWithProviders(<Loader testID="contract-loader" />);
  await expect.element(page.getByTestId("contract-loader")).toBeInTheDocument();
});
