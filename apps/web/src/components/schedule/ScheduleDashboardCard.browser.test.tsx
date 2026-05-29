import { page } from "vitest/browser";
import { expect, test, vi } from "vitest";

import { ScheduleDashboardCard } from "./ScheduleDashboardCard";
import { renderWithProviders } from "../../test/renderWithProviders";

test("an expandable card calls onToggle and exposes its expanded state", async () => {
  const onToggle = vi.fn();
  await renderWithProviders(
    <ScheduleDashboardCard
      label="Term"
      status="attention"
      summary="Choose a term"
      open={false}
      onToggle={onToggle}
      expandableContent={<div data-testid="panel">panel body</div>}
    />,
  );

  const header = page.getByRole("button");
  await expect.element(header).toHaveAttribute("aria-expanded", "false");
  await header.click();
  expect(onToggle).toHaveBeenCalledOnce();
});

test("an open card renders its expandable content", async () => {
  await renderWithProviders(
    <ScheduleDashboardCard
      label="Term"
      status="attention"
      summary="Choose a term"
      open
      onToggle={vi.fn()}
      expandableContent={<div data-testid="panel">panel body</div>}
    />,
  );

  await expect.element(page.getByRole("button")).toHaveAttribute("aria-expanded", "true");
  await expect.element(page.getByTestId("panel")).toBeInTheDocument();
});

test("a gated (locked) card is not interactive and never opens", async () => {
  const onToggle = vi.fn();
  await renderWithProviders(
    <ScheduleDashboardCard
      label="Program & courses"
      status="empty"
      summary="Program not selected"
      gateMessage="Pick a term first"
      open={false}
      onToggle={onToggle}
      expandableContent={<div data-testid="panel">panel body</div>}
    />,
  );

  // Locked cards expose no toggle button and surface the gate message.
  expect(page.getByRole("button").elements()).toHaveLength(0);
  await expect.element(page.getByText("Pick a term first")).toBeInTheDocument();
});
