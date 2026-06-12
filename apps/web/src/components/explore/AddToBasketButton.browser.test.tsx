import { page } from "vitest/browser";
import { expect, test } from "vitest";

import { renderWithProviders } from "../../test/renderWithProviders";
import { AddToBasketButton } from "../basket/AddToBasketButton";

test("toggles a course in the basket from the icon affordance", async () => {
  const { store } = await renderWithProviders(<AddToBasketButton code="CSI 2110" />);

  const button = page.getByRole("button", { name: "Add to basket" });
  await button.click();

  expect(store.getState().basketCourses).toEqual(["CSI 2110"]);
  await expect.element(page.getByRole("button", { name: "In basket" })).toBeInTheDocument();

  await page.getByRole("button", { name: "In basket" }).click();

  expect(store.getState().basketCourses).toEqual([]);
});

test("renders labeled copy for page-level basket actions", async () => {
  await renderWithProviders(<AddToBasketButton code="CSI 2110" variant="labeled" />);

  await expect.element(page.getByRole("button", { name: "Add to basket" })).toBeInTheDocument();
});
