import { page } from "vitest/browser";
import { expect, test, vi } from "vitest";

import { Notification, Table } from "@uoplan/ui";

import { renderWithProviders } from "./renderWithProviders";

/**
 * Component-contract resolution proof for the data/feedback tier primitives (web
 * side): Table, Notification. Each splits into `.web.tsx` (Mantine) and
 * `.native.tsx` (React Native); this confirms Vite resolves the `.web.tsx`
 * variant and the contract behaviours work. Native variants are covered by RNTL
 * tests in apps/native.
 */

test("@uoplan/ui Table resolves + renders headers and cells", async () => {
  await renderWithProviders(
    <Table
      testID="contract-table"
      columns={[
        { key: "code", header: "Code" },
        { key: "grade", header: "Grade" },
      ]}
      rows={[
        { code: "CSI 2110", grade: "A+" },
        { code: "MAT 1320", grade: "B" },
      ]}
    />,
  );
  await expect.element(page.getByText("Code")).toBeVisible();
  await expect.element(page.getByText("CSI 2110")).toBeVisible();
  await expect.element(page.getByText("A+")).toBeVisible();
});

test("@uoplan/ui Notification resolves + closes on press", async () => {
  const onClose = vi.fn();
  await renderWithProviders(
    <Notification testID="contract-notification" title="Saved" tone="success" onClose={onClose}>
      Your changes were saved.
    </Notification>,
  );
  await expect.element(page.getByText("Saved", { exact: true })).toBeVisible();
  await expect.element(page.getByText("Your changes were saved.")).toBeVisible();
  await page.getByRole("button").click();
  expect(onClose).toHaveBeenCalledTimes(1);
});
