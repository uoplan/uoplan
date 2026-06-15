import { fireEvent, render } from "@testing-library/react-native";

import { SearchableSelect } from "@/components/searchable-select";

const OPTIONS = [
  { value: "mat", label: "Mathematics", description: "Faculty of Science" },
  { value: "psy", label: "Psychology", description: "Faculty of Social Sciences" },
];

describe("SearchableSelect clear action", () => {
  it("can be hidden for required selects", async () => {
    const { findByPlaceholderText, getByTestId, queryByText } = await render(
      <SearchableSelect
        testID="term-picker"
        title="Term"
        placeholder="Pick a term"
        searchPlaceholder="Search terms"
        value="mat"
        options={OPTIONS}
        onChange={() => {}}
        clearable={false}
      />,
    );

    fireEvent.press(getByTestId("term-picker"));
    await findByPlaceholderText("Search terms");

    expect(queryByText("Clear")).toBeNull();
  });
});
