import { page } from "vitest/browser";
import { expect, test } from "vitest";

import { AppDataLoader } from "../components/shared/AppDataLoader";
import { renderWithProviders } from "./renderWithProviders";

/**
 * Harness sanity test for Vitest Browser Mode.
 *
 * Verifies the provider harness (Mantine + Lingui + MotionConfig) renders a
 * real Mantine component in a real browser, and that the i18n catalog and
 * Mantine styles are wired up. Deeper component coverage lands in Phase 5
 * once the store/router/data seams exist.
 */
test("renders AppDataLoader with a clamped progress value", async () => {
  await renderWithProviders(<AppDataLoader progress={150} />);

  // Progress is clamped to 100%.
  await expect.element(page.getByText("100%")).toBeInTheDocument();
  // The accessible <main> region is present.
  await expect.element(page.getByRole("main")).toBeInTheDocument();
});
