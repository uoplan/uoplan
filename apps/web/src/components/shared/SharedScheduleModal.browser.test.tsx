import type { DecodedState } from "@uoplan/core";
import { page } from "vitest/browser";
import { expect, test } from "vitest";

import { SharedScheduleModal } from "./SharedScheduleModal";
import { renderWithProviders } from "../../test/renderWithProviders";

test("renders the destructive shared-schedule action inline with the neutral action", async () => {
  await renderWithProviders(<SharedScheduleModal />, {
    initialState: { pendingSharedState: {} as DecodedState },
  });

  const loadButton = page.getByRole("button", { name: "Load shared schedule" });
  const keepMineButton = page.getByRole("button", { name: "Keep mine" });

  await expect.element(loadButton).toBeInTheDocument();
  await expect.element(keepMineButton).toBeInTheDocument();

  const loadButtonElement = loadButton.elements()[0] as HTMLElement;
  const keepMineButtonElement = keepMineButton.elements()[0] as HTMLElement;
  const buttonGroup = loadButtonElement.parentElement;

  expect(loadButtonElement.style.getPropertyValue("--button-bg")).toContain("red");
  expect(buttonGroup).toBe(keepMineButtonElement.parentElement);
  expect(buttonGroup?.style.getPropertyValue("--group-wrap")).toBe("nowrap");
});
