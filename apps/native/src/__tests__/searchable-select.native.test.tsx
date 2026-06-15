import { fireEvent, render, waitFor } from "@testing-library/react-native";

import { SearchableMultiSelect, SearchableSelect } from "@/components/searchable-select";

const OPTIONS = [
  { value: "csi", label: "Computer Science", description: "Faculty of Engineering" },
  { value: "mat", label: "Mathematics", description: "Faculty of Science" },
  { value: "psy", label: "Psychology", description: "Faculty of Social Sciences" },
];

describe("SearchableSelect (native)", () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    const original = console.error;
    consoleError = jest.spyOn(console, "error").mockImplementation((message, ...args) => {
      if (typeof message === "string" && message.includes("overlapping act() calls")) {
        return;
      }
      original(message, ...args);
    });
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it("filters options by search text and selects one value", async () => {
    const onChange = jest.fn();
    const { findByPlaceholderText, getByTestId, getByText, queryByText } = await render(
      <SearchableSelect
        testID="program-picker"
        title="Program"
        placeholder="Pick a program"
        searchPlaceholder="Search programs"
        value={null}
        options={OPTIONS}
        onChange={onChange}
      />,
    );

    fireEvent.press(getByTestId("program-picker"));
    fireEvent.changeText(await findByPlaceholderText("Search programs"), "math");

    await waitFor(() => expect(queryByText("Computer Science")).toBeNull());
    expect(getByText("Mathematics")).toBeTruthy();

    fireEvent.press(getByText("Mathematics"));

    expect(onChange).toHaveBeenCalledWith("mat");
  });

  it("toggles multi-select values without closing the sheet", async () => {
    const onChange = jest.fn();
    const { findByPlaceholderText, getByTestId, getByText } = await render(
      <SearchableMultiSelect
        testID="course-picker"
        title="Completed courses"
        placeholder="Add courses"
        searchPlaceholder="Search courses"
        values={["csi"]}
        options={OPTIONS}
        onChange={onChange}
      />,
    );

    fireEvent.press(getByTestId("course-picker"));
    fireEvent.changeText(await findByPlaceholderText("Search courses"), "psy");
    fireEvent.press(getByText("Psychology"));

    expect(onChange).toHaveBeenCalledWith(["csi", "psy"]);
    expect(getByText("Done")).toBeTruthy();
    fireEvent.press(getByText("Done"));
  });
});
