import { page } from "vitest/browser";
import { expect, test } from "vitest";
import { renderWithProviders } from "../../test/renderWithProviders";
import { ExploreEntityDetailRow, ExploreFeedbackAside } from "./ExploreEntityLayout";

function DetailRowFixture() {
  return (
    <ExploreEntityDetailRow
      aside={
        <ExploreFeedbackAside>
          <div data-testid="prerequisite-canvas" style={{ height: 80, width: "100%" }} />
        </ExploreFeedbackAside>
      }
    >
      <div data-testid="about-content" style={{ height: 80, width: "100%" }} />
    </ExploreEntityDetailRow>
  );
}

test("aligns the prerequisite canvas beside About at the 420px aside width", async () => {
  await page.viewport(1280, 900);
  await renderWithProviders(<DetailRowFixture />);

  const aboutBounds = page.getByTestId("about-content").element().getBoundingClientRect();
  const prerequisiteBounds = page
    .getByTestId("prerequisite-canvas")
    .element()
    .getBoundingClientRect();

  expect(Math.round(prerequisiteBounds.width)).toBe(420);
  expect(prerequisiteBounds.left).toBeGreaterThan(aboutBounds.right);
  expect(Math.abs(prerequisiteBounds.top - aboutBounds.top)).toBeLessThan(2);
});

test("stacks the prerequisite canvas below About on small screens with bottom separation", async () => {
  await page.viewport(390, 844);
  await renderWithProviders(<DetailRowFixture />);

  const about = page.getByTestId("about-content").element();
  const prerequisite = page.getByTestId("prerequisite-canvas").element();
  const aboutBounds = about.getBoundingClientRect();
  const prerequisiteBounds = prerequisite.getBoundingClientRect();
  const row = about.closest("[data-detail-row]");

  expect(prerequisiteBounds.top).toBeGreaterThan(aboutBounds.bottom);
  expect(Math.abs(prerequisiteBounds.width - aboutBounds.width)).toBeLessThan(2);
  expect(Number.parseFloat(window.getComputedStyle(row!).paddingBottom)).toBeGreaterThan(0);
});
