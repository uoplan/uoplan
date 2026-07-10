import { page } from "vitest/browser";
import { expect, test, vi } from "vitest";

import { renderWithProviders } from "../../test/renderWithProviders";
import { tr } from "../../i18n";
import { EMPTY_FILTERS } from "../../lib/explore/exploreFilters";
import { ExploreFilterPopoverContent } from "./ExploreFilterPopoverContent";

test("gives the delivery filter radiogroup an accessible name", async () => {
  await renderWithProviders(
    <ExploreFilterPopoverContent filterKey="delivery" filters={EMPTY_FILTERS} onChange={vi.fn()} />,
  );

  await expect
    .element(page.getByRole("radiogroup", { name: tr("explore.filter.delivery") }))
    .toBeInTheDocument();
});
