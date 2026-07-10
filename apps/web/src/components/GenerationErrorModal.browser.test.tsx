import { page } from "vitest/browser";
import { expect, test } from "vitest";

import type { GenerationErrorState } from "@uoplan/store/types";
import { GenerationErrorModal } from "./GenerationErrorModal";
import { renderWithProviders } from "../test/renderWithProviders";

const ERROR: GenerationErrorState = {
  message: {
    kind: "unassigned-completed",
    count: 2,
    preview: ["CSI 2110", "MAT 1320"],
    overflow: 0,
  },
  details: {
    emptyPools: [{ label: "Science electives", requirementId: "sci" }],
    totalAvailable: 1,
    totalNeeded: 3,
  },
};

test("shows the full message and detail blocks when open", async () => {
  await renderWithProviders(<GenerationErrorModal error={ERROR} onClose={() => {}} />);

  // The modal carries the full (non-truncated) message including the course list.
  await expect.element(page.getByText(/CSI 2110/)).toBeInTheDocument();
  // ...and the structured detail blocks (empty pool name).
  await expect.element(page.getByText(/Science electives/).first()).toBeInTheDocument();
});

test("renders nothing interactive when there is no error", async () => {
  await renderWithProviders(<GenerationErrorModal error={null} onClose={() => {}} />);
  expect(page.getByText(/CSI 2110/).query()).toBeNull();
});
