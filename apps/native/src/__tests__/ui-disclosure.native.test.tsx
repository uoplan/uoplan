import { fireEvent, render } from "@testing-library/react-native";

import { Accordion, Collapse, Tabs, Text } from "@uoplan/ui";

// Proves jest-expo resolves the `.native.tsx` variants of the disclosure-tier
// primitives (same as the Metro device bundle) and RNTL mounts them. Mirrors
// the web browser disclosure contract test in apps/web.
describe("@uoplan/ui disclosure-tier primitives (native variants)", () => {
  it("Tabs renders the active panel + switches on press", async () => {
    const onChange = jest.fn();
    const { getByText, queryByText } = await render(
      <Tabs
        value="a"
        onChange={onChange}
        items={[
          { value: "a", label: "Tab A", content: <Text>PANEL A</Text> },
          { value: "b", label: "Tab B", content: <Text>PANEL B</Text> },
        ]}
      />,
    );
    expect(getByText("PANEL A")).toBeTruthy();
    expect(queryByText("PANEL B")).toBeNull();
    await fireEvent.press(getByText("Tab B"));
    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("Accordion expands a section on press", async () => {
    const { getByText, queryByText } = await render(
      <Accordion
        items={[
          { value: "one", label: "Section one", content: <Text>BODY ONE</Text> },
          { value: "two", label: "Section two", content: <Text>BODY TWO</Text> },
        ]}
      />,
    );
    expect(queryByText("BODY ONE")).toBeNull();
    await fireEvent.press(getByText("Section one"));
    expect(getByText("BODY ONE")).toBeTruthy();
  });

  it("Collapse shows content only when open", async () => {
    const closed = await render(
      <Collapse open={false}>
        <Text>COLLAPSE BODY</Text>
      </Collapse>,
    );
    expect(closed.queryByText("COLLAPSE BODY")).toBeNull();

    const opened = await render(
      <Collapse open>
        <Text>COLLAPSE BODY</Text>
      </Collapse>,
    );
    expect(opened.queryByText("COLLAPSE BODY")).toBeTruthy();
  });
});
