import { cleanup, fireEvent, render, waitFor } from "@testing-library/react-native";
import type { ComponentProps } from "react";

import {
  ExploreFiltersDrawer,
  type ExploreFilterOption,
  type ExploreFilterState,
} from "@/components/explore/explore-filters-drawer";

const EMPTY: ExploreFilterState = {
  levels: [],
  languages: [],
  disciplines: [],
  difficulty: null,
  minRating: null,
  minFeedback: null,
  termId: null,
  contributesToRequirements: false,
  sortKey: "relevance",
  sortDir: "desc",
};

const DISCIPLINES: ExploreFilterOption<string>[] = Array.from({ length: 15 }, (_, i) => ({
  value: `D${i}`,
  label: i === 0 ? "Mathematics" : i === 1 ? "Computer Science" : `Discipline ${i}`,
}));

afterEach(cleanup);

async function renderDrawer(overrides: Partial<ComponentProps<typeof ExploreFiltersDrawer>> = {}) {
  return render(
    <ExploreFiltersDrawer
      opened
      activeFilter="discipline"
      filters={EMPTY}
      levelOptions={[]}
      languageOptions={[]}
      disciplineOptions={DISCIPLINES}
      difficultyOptions={[]}
      ratingOptions={[]}
      feedbackOptions={[]}
      termOptions={[]}
      requirementsAvailable={false}
      onApply={jest.fn()}
      onClose={jest.fn()}
      {...overrides}
    />,
  );
}

describe("ExploreFiltersDrawer search (native)", () => {
  it("shows a search box for a large section and filters the options", async () => {
    const { findByPlaceholderText, getByText, queryByText } = await renderDrawer();

    fireEvent.changeText(await findByPlaceholderText("Search discipline"), "comp");

    await waitFor(() => expect(queryByText("Mathematics")).toBeNull());
    expect(getByText("Computer Science")).toBeTruthy();
  });

  it("hides the search box for a small section", async () => {
    const { queryByPlaceholderText } = await renderDrawer({
      activeFilter: "level",
      disciplineOptions: [],
      levelOptions: [
        { value: 1000, label: "1000 level" },
        { value: 2000, label: "2000 level" },
      ],
    });

    expect(queryByPlaceholderText("Search course level")).toBeNull();
  });

  it("shows the requirements smart filter toggle when a program is selected", async () => {
    const { findByText } = await renderDrawer({
      activeFilter: "requirements",
      requirementsAvailable: true,
    });

    expect(await findByText("Fits my requirements")).toBeTruthy();
  });
});
