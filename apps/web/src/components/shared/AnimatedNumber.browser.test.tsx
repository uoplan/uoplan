import { page } from "vitest/browser";
import { expect, test } from "vitest";
import type { ReactElement } from "react";
import { useState } from "react";
import { MotionConfig } from "framer-motion";
import { render } from "vitest-browser-react";

import { AnimatedNumber } from "./AnimatedNumber";
import { renderWithProviders } from "../../test/renderWithProviders";

// renderWithProviders wraps children in `MotionConfig reducedMotion="always"`,
// so the count animation is disabled and values resolve immediately.

async function renderLoadHarness(
  ui: ReactElement,
  renderHarness: (ui: ReactElement) => unknown,
  loadedText: string,
) {
  await renderHarness(ui);
  await expect.element(page.getByText("—")).toBeInTheDocument();

  await page.getByRole("button", { name: "load" }).click();
  await expect.element(page.getByText(loadedText)).toBeInTheDocument();
}

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

test("countOnLoad snaps straight to the value under reduced motion", async () => {
  function Harness() {
    const [value, setValue] = useState<number | null>(null);
    return (
      <div>
        <button type="button" onClick={() => setValue(500)}>
          load
        </button>
        <AnimatedNumber
          value={value}
          format={(n) => `$${Math.round(n)}`}
          countOnLoad
          placeholder="—"
        />
      </div>
    );
  }

  await renderLoadHarness(<Harness />, renderWithProviders, "$500");
});

test("countOnLoad counts up from 0 to the loaded value", async () => {
  const seen = new Set<number>();

  function Harness() {
    const [value, setValue] = useState<number | null>(null);
    return (
      <MotionConfig reducedMotion="never">
        <button type="button" onClick={() => setValue(1000)}>
          load
        </button>
        <AnimatedNumber
          value={value}
          format={(n) => {
            const rounded = Math.round(n);
            seen.add(rounded);
            return `$${rounded}`;
          }}
          countOnLoad
          duration={0.6}
          placeholder="—"
        />
      </MotionConfig>
    );
  }

  await renderLoadHarness(<Harness />, render, "$1000");

  // It animated through intermediate values rather than snapping to the target.
  const intermediates = [...seen].filter((n) => n > 0 && n < 1000);
  expect(intermediates.length).toBeGreaterThan(0);
});
