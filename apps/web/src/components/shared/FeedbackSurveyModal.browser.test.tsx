import { page, userEvent } from "vitest/browser";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { FeedbackSurveyModal } from "./FeedbackSurveyModal";
import { renderWithProviders } from "../../test/renderWithProviders";

const STORAGE_KEY = "uoplan:feedback-survey:v1";

beforeEach(() => localStorage.removeItem(STORAGE_KEY));
afterEach(() => {
  vi.restoreAllMocks();
  localStorage.removeItem(STORAGE_KEY);
});

test("dismissal stays saved when the prompt mounts again", async () => {
  const view = await renderWithProviders(<FeedbackSurveyModal />);
  await page.getByRole("button", { name: "No thanks", exact: true }).last().click();
  await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
  expect(localStorage.getItem(STORAGE_KEY)).toBe("dismissed");
  await view.rerender(<></>);
  await view.rerender(<FeedbackSurveyModal />);
  await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
});

test("opening the survey saves dismissal before navigating", async () => {
  const view = await renderWithProviders(<FeedbackSurveyModal />);
  const link = page.getByRole("link", { name: "Give feedback" });
  await expect.element(link).toHaveAttribute("target", "_blank");
  await expect
    .element(link)
    .toHaveAttribute(
      "href",
      "https://docs.google.com/forms/d/e/1FAIpQLSc-7tD_e1OEyM602hbog1e8OJmkBVZFm4UIwM9MZfOUon_NPg/viewform",
    );
  link.elements()[0].addEventListener("click", (event) => event.preventDefault(), { once: true });
  await link.click();
  expect(localStorage.getItem(STORAGE_KEY)).toBe("dismissed");
  await view.rerender(<></>);
  await view.rerender(<FeedbackSurveyModal />);
  await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
});

test("Escape also saves dismissal", async () => {
  await renderWithProviders(<FeedbackSurveyModal />);
  await expect.element(page.getByRole("dialog")).toBeInTheDocument();
  await userEvent.keyboard("{Escape}");
  await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
  expect(localStorage.getItem(STORAGE_KEY)).toBe("dismissed");
});

test("blocked storage still allows dismissal for this visit", async () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new DOMException("Storage is blocked", "SecurityError");
  });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("Storage is blocked", "SecurityError");
  });
  await renderWithProviders(<FeedbackSurveyModal />);
  await page.getByRole("button", { name: "No thanks", exact: true }).last().click();
  await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
});
