import { page } from "vitest/browser";
import { expect, test } from "vitest";

import { Button } from "@uoplan/ui";

import { renderWithProviders } from "./renderWithProviders";

/**
 * Component-contract resolution proof (web side).
 *
 * `@uoplan/ui` exports a single `Button` whose implementation is split into
 * `Button.web.tsx` (Mantine) and `Button.native.tsx` (React Native). This test
 * confirms that Vite's `resolve.extensions` picks the `.web.tsx` variant: a real
 * Mantine button renders (it carries the `mantine-Button-root` class), the
 * contract's platform-neutral `onPress` maps onto the web `onClick`, and the
 * `testID` maps onto `data-testid`. The Metro/native side is proven separately
 * by the Expo bundle + simulator.
 */
test("@uoplan/ui Button resolves to the Mantine (.web) variant", async () => {
  let pressed = 0;
  await renderWithProviders(
    <Button testID="contract-button" onPress={() => (pressed += 1)}>
      contract button
    </Button>,
  );

  const button = page.getByTestId("contract-button");
  await expect.element(button).toBeInTheDocument();
  await expect.element(button).toHaveClass(/mantine-Button-root/);

  await button.click();
  expect(pressed).toBe(1);
});
