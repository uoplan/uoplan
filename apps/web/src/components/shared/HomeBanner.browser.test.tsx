import { page } from "vitest/browser";
import { afterEach, expect, test, vi } from "vitest";
import { RouterProvider } from "@tanstack/react-router";

import { HomeBanner } from "./HomeBanner";
import { HOME_BANNERS } from "./homeBanners";
import { renderWithProviders } from "../../test/renderWithProviders";
import { createTestRouter } from "../../test/testRouter";

// The test providers force `MotionConfig reducedMotion="always"`, so HomeBanner
// renders its reduced-motion path: a single static banner (no auto-rotation, no
// duplicated DOM), which keeps these assertions deterministic. The starting
// banner is still chosen randomly, which we pin per-test via `startAt`. The
// vertical-slide rotation itself is verified manually on the dev server.

/** Mount HomeBanner on every route so the home-page gate can be exercised. */
function buildRouter(initialEntries: string[]) {
  return createTestRouter({
    initialEntries,
    layout: <HomeBanner />,
    routes: {
      "/": <div>HOME PAGE</div>,
      "/explore": <div>EXPLORE PAGE</div>,
    },
  });
}

/**
 * Force a deterministic starting banner: the rotator picks
 * `HOME_BANNERS[floor(random() * length)]`, so `random() = index / length`
 * lands on `index`.
 */
function startAt(index: number) {
  vi.spyOn(Math, "random").mockReturnValue(index / HOME_BANNERS.length);
}

afterEach(() => {
  vi.restoreAllMocks();
});

test("shows the seeded random banner on the home page (donation → /donate)", async () => {
  startAt(0); // donate
  const router = buildRouter(["/"]);
  await renderWithProviders(<RouterProvider router={router} />);

  await expect.element(page.getByText("HOME PAGE")).toBeInTheDocument();
  await expect.element(page.getByRole("note")).toBeInTheDocument();
  await expect.element(page.getByRole("link")).toHaveAttribute("href", "/donate");
});

test("starts on whichever banner the random seed selects (Android → mailto)", async () => {
  startAt(1); // android closed test
  const router = buildRouter(["/"]);
  await renderWithProviders(<RouterProvider router={router} />);

  await expect
    .element(page.getByRole("link"))
    .toHaveAttribute("href", "mailto:admin@uoplan.party?subject=Android%20closed%20test");
});

test("renders nothing when not on the home page", async () => {
  startAt(0);
  const router = buildRouter(["/explore"]);
  await renderWithProviders(<RouterProvider router={router} />);

  await expect.element(page.getByText("EXPLORE PAGE")).toBeInTheDocument();
  expect(page.getByRole("note").elements()).toHaveLength(0);
});

test("dismissing hides the banner for the session", async () => {
  startAt(0);
  const router = buildRouter(["/"]);
  await renderWithProviders(<RouterProvider router={router} />);

  const dismiss = page.getByRole("button", { name: "Dismiss" });
  await expect.element(dismiss).toBeInTheDocument();
  await dismiss.click();

  await expect.poll(() => page.getByRole("note").elements().length).toBe(0);
});
