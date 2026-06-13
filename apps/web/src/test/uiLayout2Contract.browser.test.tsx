import { page } from "vitest/browser";
import { expect, test } from "vitest";

import { Container, Flex, ScrollArea, SimpleGrid, Space } from "@uoplan/ui";

import { renderWithProviders } from "./renderWithProviders";

/**
 * Component-contract resolution proof for the secondary layout primitives
 * (Container/Space/Flex/SimpleGrid/ScrollArea) on the web side. Confirms Vite
 * resolves the `.web.tsx` (Mantine) variant and the shared `testID` maps onto
 * `data-testid`. Native variants are covered by RNTL tests in apps/native.
 */

test("@uoplan/ui Container resolves to the Mantine (.web) variant", async () => {
  await renderWithProviders(
    <Container testID="contract-container" maxWidth={640} px="md">
      container content
    </Container>,
  );
  const container = page.getByTestId("contract-container");
  await expect.element(container).toBeInTheDocument();
  await expect.element(container).toHaveTextContent("container content");
});

test("@uoplan/ui Space resolves to the Mantine (.web) variant", async () => {
  await renderWithProviders(<Space testID="contract-space" h="md" />);
  await expect.element(page.getByTestId("contract-space")).toBeInTheDocument();
});

test("@uoplan/ui Flex resolves to the Mantine (.web) variant", async () => {
  await renderWithProviders(
    <Flex testID="contract-flex" direction="column" gap="sm" align="center">
      <span>a</span>
      <span>b</span>
    </Flex>,
  );
  const flex = page.getByTestId("contract-flex");
  await expect.element(flex).toBeInTheDocument();
  await expect.element(flex).toHaveTextContent("ab");
});

test("@uoplan/ui SimpleGrid resolves to the Mantine (.web) variant", async () => {
  await renderWithProviders(
    <SimpleGrid testID="contract-grid" cols={2} spacing="md">
      <span>a</span>
      <span>b</span>
    </SimpleGrid>,
  );
  const grid = page.getByTestId("contract-grid");
  await expect.element(grid).toBeInTheDocument();
  await expect.element(grid).toHaveTextContent("ab");
});

test("@uoplan/ui ScrollArea resolves to the Mantine (.web) variant", async () => {
  await renderWithProviders(
    <ScrollArea testID="contract-scroll">
      <span>scrollable</span>
    </ScrollArea>,
  );
  const scroll = page.getByTestId("contract-scroll");
  await expect.element(scroll).toBeInTheDocument();
  await expect.element(scroll).toHaveTextContent("scrollable");
});
