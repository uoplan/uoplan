import { page } from "vitest/browser";
import { expect, test } from "vitest";

import { GenerationOptionsFields } from "./GenerationOptionsFields";
import { makeGenerationOptionsProps } from "./testHelpers";
import { renderWithProviders } from "../../../test/renderWithProviders";

function baseProps() {
  return makeGenerationOptionsProps({
    courseOptions: [{ value: "CSI 2110", label: "CSI 2110" }],
    countMax: 8,
    minStartMinutes: 8 * 60,
    maxEndMinutes: 18 * 60,
  });
}

test("surfaces common scheduling options and tucks filters behind a disclosure", async () => {
  await renderWithProviders(
    <GenerationOptionsFields
      {...baseProps()}
      secondaryOptionsDisclosure={{
        heading: "More options",
        badgeLabel: "Optional",
        collapseId: "test-more-options-collapse",
      }}
    />,
  );

  await expect.element(page.getByText("Courses you want")).toBeInTheDocument();
  await expect.element(page.getByText("Courses this semester")).toBeInTheDocument();
  // Common scheduling preferences are now surfaced directly, not hidden.
  await expect.element(page.getByText("Earliest class start")).toBeInTheDocument();
  await expect.element(page.getByText("Compressed schedule")).toBeInTheDocument();
  await expect.element(page.getByText("Prefer courses with better feedback")).toBeInTheDocument();

  const toggle = page.getByRole("button", { name: /More options/i });
  await expect.element(toggle).toHaveAttribute("aria-expanded", "false");
  await expect.element(toggle).toHaveAttribute("aria-controls", "test-more-options-collapse");

  await toggle.click();
  await expect.element(toggle).toHaveAttribute("aria-expanded", "true");
  await expect.element(page.getByText("French immersion stream")).toBeInTheDocument();
});
