import { page } from "vitest/browser";
import { expect, test } from "vitest";

import { Icon, Motion } from "@uoplan/ui";

import { renderWithProviders } from "./renderWithProviders";

/**
 * Component-contract resolution proof for the Icon + Motion primitives (web
 * side). Icon splits into `.web.tsx` (@tabler/icons-react) and `.native.tsx`
 * (SF Symbols); Motion into `.web.tsx` (framer-motion) and `.native.tsx` (RN
 * Animated). This confirms Vite resolves the `.web.tsx` variants and the
 * contract behaviours work. Native variants are covered by RNTL tests.
 */

test("@uoplan/ui Icon resolves + renders an accessible glyph", async () => {
  await renderWithProviders(<Icon name="search" label="Search" testID="contract-icon" />);
  await expect.element(page.getByTestId("contract-icon")).toBeInTheDocument();
  await expect.element(page.getByLabelText("Search")).toBeInTheDocument();
});

test("@uoplan/ui Icon renders distinct glyphs per name", async () => {
  await renderWithProviders(
    <div>
      <Icon name="calendar" testID="icon-cal" />
      <Icon name="heart" testID="icon-heart" />
    </div>,
  );
  await expect.element(page.getByTestId("icon-cal")).toBeInTheDocument();
  await expect.element(page.getByTestId("icon-heart")).toBeInTheDocument();
});

test("@uoplan/ui Motion resolves + renders its children", async () => {
  await renderWithProviders(
    <Motion testID="contract-motion" from={{ opacity: 0, translateY: 8 }} to={{ opacity: 1 }}>
      <span>animated content</span>
    </Motion>,
  );
  await expect.element(page.getByTestId("contract-motion")).toBeInTheDocument();
  await expect.element(page.getByText("animated content")).toBeInTheDocument();
});
