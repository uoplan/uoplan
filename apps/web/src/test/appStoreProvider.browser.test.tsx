import { page } from "vitest/browser";
import { expect, test } from "vitest";

import { createTestAppServices } from "@uoplan/store/testServices";
import { useAppStore, useAppStoreApi } from "../store/appStore";
import { renderWithProviders } from "./renderWithProviders";

/**
 * Validates the instantiable-store seam: each render gets an isolated store, selector
 * subscriptions re-render on change, and useAppStoreApi() dispatches into that same store.
 */
function CourseCountProbe() {
  const count = useAppStore((s) => s.coursesThisSemester);
  const store = useAppStoreApi();
  return (
    <button type="button" onClick={() => store.getState().setCoursesThisSemester(count + 1)}>
      count: {count}
    </button>
  );
}

test("selector reads seeded state and re-renders when an action mutates the store", async () => {
  const { store } = await renderWithProviders(<CourseCountProbe />, {
    initialState: { coursesThisSemester: 3 },
  });

  const button = page.getByRole("button", { name: /count:/ });
  await expect.element(button).toHaveTextContent("count: 3");

  await button.click();
  await expect.element(button).toHaveTextContent("count: 4");
  expect(store.getState().coursesThisSemester).toBe(4);
});

test("each render is backed by an isolated store (no cross-test leakage)", async () => {
  const { store } = await renderWithProviders(<CourseCountProbe />);
  // Fresh store uses the default, not the value seeded by the previous test.
  expect(store.getState().coursesThisSemester).toBe(5);
  await expect.element(page.getByRole("button", { name: /count:/ })).toHaveTextContent("count: 5");
});

test("renderWithProviders accepts package test services", async () => {
  const services = createTestAppServices({
    navigation: {
      toCalendar: () => {},
    },
  });

  const { store } = await renderWithProviders(<CourseCountProbe />, { services });

  expect(store.getState().coursesThisSemester).toBe(5);
  await expect.element(page.getByRole("button", { name: /count:/ })).toHaveTextContent("count: 5");
});
