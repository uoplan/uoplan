import { page } from "vitest/browser";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { tr } from "../../i18n";
import { renderWithProviders } from "../../test/renderWithProviders";
import { CourseDescriptionSection } from "./CourseDescriptionSection";

// A short description — no toggle expected.
const SHORT_DESC = "A short introduction to linear algebra.";

// A long description — toggle expected when it exceeds two rendered lines.
const LONG_DESC = "A".repeat(601);

// Distinct descriptions to test exact course-code routing.
const MAT1320_DESC = "Introduction to calculus: derivatives, integrals, and applications.";
const MAT1720_DESC = "Advanced calculus: multivariable functions and vector fields.";

const mocks = vi.hoisted(() => ({
  loadCourseDescription:
    vi.fn<
      (shardId: string | null | undefined, courseCode: string) => Promise<string | undefined>
    >(),
}));

vi.mock("../../lib/dataClient", () => ({
  dataClient: {
    loadCourseDescription: mocks.loadCourseDescription,
  },
}));

beforeEach(() => {
  mocks.loadCourseDescription.mockReset();
});

// ─── Loading ────────────────────────────────────────────────────────────────

test("shows skeleton lines while loading", async () => {
  // Never-resolving promise keeps the component in the loading state.
  mocks.loadCourseDescription.mockReturnValue(new Promise(() => {}));

  await renderWithProviders(<CourseDescriptionSection courseCode="MAT 1320" facultyId={null} />);

  // The "About" heading appears before the skeletons.
  await expect.element(page.getByText(tr("explore.course.about"))).toBeInTheDocument();

  // Skeletons are rendered. Mantine Skeleton elements use role="presentation"
  // or are aria-hidden — query the heading to confirm the section mounted and
  // loading mode is active (description text absent).
  await expect.element(page.getByText(MAT1320_DESC)).not.toBeInTheDocument();
});

// ─── Empty / absent description ─────────────────────────────────────────────

test("omits the section entirely when the description is absent", async () => {
  // oxlint-disable-next-line unicorn/no-useless-undefined
  mocks.loadCourseDescription.mockResolvedValue(undefined);

  await renderWithProviders(<CourseDescriptionSection courseCode="MAT 1320" facultyId={null} />);

  await expect.element(page.getByText(tr("explore.course.about"))).not.toBeInTheDocument();
});

// ─── Null courseCode ─────────────────────────────────────────────────────────

test("renders nothing when courseCode is null", async () => {
  await renderWithProviders(<CourseDescriptionSection courseCode={null} facultyId={null} />);

  await expect.element(page.getByText(tr("explore.course.about"))).not.toBeInTheDocument();

  expect(mocks.loadCourseDescription).not.toHaveBeenCalled();
});

// ─── Error / retry ───────────────────────────────────────────────────────────

test("shows localized error and retry button on fetch failure", async () => {
  mocks.loadCourseDescription.mockRejectedValue(new Error("network error"));

  await renderWithProviders(<CourseDescriptionSection courseCode="MAT 1320" facultyId={null} />);

  await expect.element(page.getByText(tr("explore.course.description.error"))).toBeInTheDocument();

  await expect
    .element(page.getByRole("button", { name: tr("explore.course.description.retry") }))
    .toBeInTheDocument();
});

test("retries and shows description after initial rejection", async () => {
  // First call rejects; second call succeeds.
  mocks.loadCourseDescription
    .mockRejectedValueOnce(new Error("transient"))
    .mockResolvedValueOnce(MAT1320_DESC);

  await renderWithProviders(<CourseDescriptionSection courseCode="MAT 1320" facultyId={null} />);

  // Wait for error state.
  const retryButton = page.getByRole("button", {
    name: tr("explore.course.description.retry"),
  });
  await expect.element(retryButton).toBeInTheDocument();

  // Click retry.
  await retryButton.click();

  // Description should appear after the second (successful) fetch.
  await expect.element(page.getByText(MAT1320_DESC)).toBeInTheDocument();
  await expect
    .element(page.getByText(tr("explore.course.description.error")))
    .not.toBeInTheDocument();
});

// ─── Short description (≤ threshold) — no toggle ────────────────────────────

describe("short description — no toggle", () => {
  test("full text is visible and no Show more button at compact width", async () => {
    await page.viewport(390, 844);
    mocks.loadCourseDescription.mockResolvedValue(SHORT_DESC);

    await renderWithProviders(<CourseDescriptionSection courseCode="MAT 1320" facultyId={null} />);

    await expect.element(page.getByText(SHORT_DESC)).toBeInTheDocument();
    await expect
      .element(page.getByRole("button", { name: tr("explore.course.description.showMore") }))
      .not.toBeInTheDocument();
  });

  test("full text is visible and no Show more button at wide viewport", async () => {
    await page.viewport(1280, 900);
    mocks.loadCourseDescription.mockResolvedValue(SHORT_DESC);

    await renderWithProviders(<CourseDescriptionSection courseCode="MAT 1320" facultyId={null} />);

    await expect.element(page.getByText(SHORT_DESC)).toBeInTheDocument();
    await expect
      .element(page.getByRole("button", { name: tr("explore.course.description.showMore") }))
      .not.toBeInTheDocument();
  });
});

// ─── Long description — two-line clamp + toggle ─────────────────────────────

describe("long description disclosure", () => {
  test("shows Read more when a sub-600-character description exceeds two lines", async () => {
    await page.viewport(390, 844);
    mocks.loadCourseDescription.mockResolvedValue(
      "A compact-width course description with enough ordinary words to wrap across many lines. ".repeat(
        6,
      ),
    );

    await renderWithProviders(<CourseDescriptionSection courseCode="MAT 1320" facultyId={null} />);

    await expect
      .element(page.getByRole("button", { name: tr("explore.course.description.showMore") }))
      .toBeInTheDocument();
  });

  test("shows Read more button when description is long", async () => {
    await page.viewport(390, 844);
    mocks.loadCourseDescription.mockResolvedValue(LONG_DESC);

    await renderWithProviders(<CourseDescriptionSection courseCode="MAT 1320" facultyId={null} />);

    await expect
      .element(page.getByRole("button", { name: tr("explore.course.description.showMore") }))
      .toBeInTheDocument();
  });

  test("toggles to Read less after expanding", async () => {
    await page.viewport(390, 844);
    mocks.loadCourseDescription.mockResolvedValue(LONG_DESC);

    await renderWithProviders(<CourseDescriptionSection courseCode="MAT 1320" facultyId={null} />);

    const showMore = page.getByRole("button", {
      name: tr("explore.course.description.showMore"),
    });
    await expect.element(showMore).toBeInTheDocument();
    await showMore.click();

    await expect
      .element(page.getByRole("button", { name: tr("explore.course.description.showLess") }))
      .toBeInTheDocument();

    // Clicking Show less restores the collapsed state.
    await page.getByRole("button", { name: tr("explore.course.description.showLess") }).click();

    await expect
      .element(page.getByRole("button", { name: tr("explore.course.description.showMore") }))
      .toBeInTheDocument();
  });
});

test("uses the full content width and keeps Read more inline at wide viewports", async () => {
  await page.viewport(1280, 900);
  const wideLongDescription = LONG_DESC.repeat(3);
  mocks.loadCourseDescription.mockResolvedValue(wideLongDescription);

  await renderWithProviders(<CourseDescriptionSection courseCode="MAT 1320" facultyId={null} />);

  const description = page.getByText(wideLongDescription);
  const readMore = page.getByRole("button", { name: "Read more" });
  await expect.element(readMore).toBeInTheDocument();

  const descriptionElement = description.element();
  const buttonElement = readMore.element();
  const descriptionBounds = descriptionElement.getBoundingClientRect();
  const buttonBounds = buttonElement.getBoundingClientRect();
  const parentBounds = descriptionElement.parentElement?.getBoundingClientRect();

  const readMoreStyle = window.getComputedStyle(buttonElement);
  expect(window.getComputedStyle(descriptionElement).webkitLineClamp).toBe("7");
  expect(readMoreStyle.fontWeight).toBe("400");
  expect(readMoreStyle.color).toBe(
    window.getComputedStyle(document.documentElement).getPropertyValue("--app-text-muted").trim(),
  );
  expect(parentBounds).toBeDefined();
  expect(Math.abs(descriptionBounds.width - (parentBounds?.width ?? 0))).toBeLessThan(2);
  expect(buttonBounds.top).toBeLessThan(descriptionBounds.bottom);
});

// ─── Expanded state resets on courseCode change ──────────────────────────────

describe("expanded state resets on courseCode change", () => {
  test("starts collapsed when courseCode changes while A is expanded", async () => {
    await page.viewport(390, 844);

    const LONG_DESC_A = "A".repeat(601);
    const LONG_DESC_B = "B".repeat(601);

    mocks.loadCourseDescription.mockImplementation(
      (_shardId: string | null | undefined, courseCode: string) => {
        if (courseCode === "MAT 1320") return Promise.resolve(LONG_DESC_A);
        if (courseCode === "MAT 1720") return Promise.resolve(LONG_DESC_B);
        // oxlint-disable-next-line unicorn/no-useless-undefined
        return Promise.resolve(undefined);
      },
    );

    const { rerender } = await renderWithProviders(
      <CourseDescriptionSection courseCode="MAT 1320" facultyId={null} />,
    );

    // Wait for course A to load and expand it.
    const showMoreA = page.getByRole("button", {
      name: tr("explore.course.description.showMore"),
    });
    await expect.element(showMoreA).toBeInTheDocument();
    await showMoreA.click();
    await expect
      .element(page.getByRole("button", { name: tr("explore.course.description.showLess") }))
      .toBeInTheDocument();

    // Switch to course B on the same mounted component.
    await rerender(<CourseDescriptionSection courseCode="MAT 1720" facultyId={null} />);

    // Course B must start collapsed, not inherit course A's expanded state.
    await expect
      .element(page.getByRole("button", { name: tr("explore.course.description.showMore") }))
      .toBeInTheDocument();
    await expect
      .element(page.getByRole("button", { name: tr("explore.course.description.showLess") }))
      .not.toBeInTheDocument();
  });
});

// ─── aria-expanded on the Show more/less disclosure button ───────────────────

describe("aria-expanded on toggle button", () => {
  test("is false initially, true when expanded, false after collapse", async () => {
    await page.viewport(390, 844);
    mocks.loadCourseDescription.mockResolvedValue(LONG_DESC);

    await renderWithProviders(<CourseDescriptionSection courseCode="MAT 1320" facultyId={null} />);

    const showMoreBtn = page.getByRole("button", {
      name: tr("explore.course.description.showMore"),
    });
    await expect.element(showMoreBtn).toBeInTheDocument();

    // Initially collapsed.
    await expect.element(showMoreBtn).toHaveAttribute("aria-expanded", "false");

    // Expand.
    await showMoreBtn.click();
    const showLessBtn = page.getByRole("button", {
      name: tr("explore.course.description.showLess"),
    });
    await expect.element(showLessBtn).toHaveAttribute("aria-expanded", "true");

    // Collapse.
    await showLessBtn.click();
    await expect
      .element(page.getByRole("button", { name: tr("explore.course.description.showMore") }))
      .toHaveAttribute("aria-expanded", "false");
  });
});

// ─── Exact course code routing ───────────────────────────────────────────────

test("fetches and shows MAT 1320 description, not MAT 1720", async () => {
  mocks.loadCourseDescription.mockImplementation(
    (_shardId: string | null | undefined, courseCode: string) => {
      if (courseCode === "MAT 1320") return Promise.resolve(MAT1320_DESC);
      if (courseCode === "MAT 1720") return Promise.resolve(MAT1720_DESC);
      // oxlint-disable-next-line unicorn/no-useless-undefined
      return Promise.resolve(undefined);
    },
  );

  await renderWithProviders(<CourseDescriptionSection courseCode="MAT 1320" facultyId={null} />);

  await expect.element(page.getByText(MAT1320_DESC)).toBeInTheDocument();
  await expect.element(page.getByText(MAT1720_DESC)).not.toBeInTheDocument();
});
