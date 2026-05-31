import { page } from "vitest/browser";
import { expect, test } from "vitest";
import { useState } from "react";

import { AnimatedNumber } from "./AnimatedNumber";
import { renderWithProviders } from "../../test/renderWithProviders";

// renderWithProviders wraps children in `MotionConfig reducedMotion="always"`,
// so the count animation is disabled and values resolve immediately.

test("renders the formatted value immediately under reduced motion", async () => {
  await renderWithProviders(<AnimatedNumber value={1234} format={(n) => `$${n}`} />);
  await expect.element(page.getByText("$1234")).toBeInTheDocument();
});

test("renders the placeholder when value is null", async () => {
  await renderWithProviders(
    <AnimatedNumber value={null} format={(n) => String(n)} placeholder="N/A" />,
  );
  await expect.element(page.getByText("N/A")).toBeInTheDocument();
});

test("snaps to the new value when it changes (reduced motion)", async () => {
  function Harness() {
    const [value, setValue] = useState<number | null>(10);
    return (
      <div>
        <button type="button" onClick={() => setValue(42)}>
          bump
        </button>
        <span data-testid="out">
          <AnimatedNumber value={value} format={(n) => `${Math.round(n)} pts`} />
        </span>
      </div>
    );
  }

  await renderWithProviders(<Harness />);
  await expect.element(page.getByText("10 pts")).toBeInTheDocument();

  await page.getByRole("button", { name: "bump" }).click();
  await expect.element(page.getByText("42 pts")).toBeInTheDocument();
});
