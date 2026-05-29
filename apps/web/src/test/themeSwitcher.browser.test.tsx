import { page, userEvent } from "vitest/browser";
import { expect, test } from "vitest";

import { ThemeSwitcher } from "../components/shared/ThemeSwitcher";
import { renderWithProviders } from "./renderWithProviders";

/**
 * Exercises the PillSelect-based theme dropdown end-to-end in a real browser:
 * opening the trigger surfaces the options and submitting one applies the theme
 * (reflected on <html data-app-theme>).
 */
test("theme dropdown lists options and applies the chosen theme", async () => {
  // Harness seeds selection="dark"; start from a known state.
  document.documentElement.setAttribute("data-app-theme", "dark");

  await renderWithProviders(<ThemeSwitcher />);

  const trigger = page.getByRole("button", { name: /theme/i });
  await trigger.click();

  const lightOption = page.getByRole("option", { name: /light/i });
  await expect.element(lightOption).toBeInTheDocument();
  await lightOption.click();

  await expect.poll(() => document.documentElement.getAttribute("data-app-theme")).toBe("light");

  // Trigger reflects the new selection.
  await expect.element(page.getByRole("button", { name: /theme/i })).toHaveTextContent(/light/i);

  // Avoid leaking theme state into sibling browser tests.
  await userEvent.click(document.body);
});
