import { fireEvent, render } from "@testing-library/react-native";

import { Modal, NumberInput, Radio, SegmentedControl, Text } from "@uoplan/ui";

// Proves jest-expo resolves the `.native.tsx` variants of the input/overlay
// primitives (same as the Metro device bundle) and RNTL mounts them. Mirrors
// the web browser input contract test in apps/web.
describe("@uoplan/ui input & overlay primitives (native variants)", () => {
  it("NumberInput renders + reports parsed edits", async () => {
    const onChange = jest.fn();
    const { getByTestId } = await render(
      <NumberInput testID="contract-number" onChange={onChange} placeholder="count" />,
    );
    await fireEvent.changeText(getByTestId("contract-number"), "7");
    expect(onChange).toHaveBeenCalledWith(7);
  });

  it("NumberInput clamps to max", async () => {
    const onChange = jest.fn();
    const { getByTestId } = await render(
      <NumberInput testID="contract-number" onChange={onChange} max={5} />,
    );
    await fireEvent.changeText(getByTestId("contract-number"), "9");
    expect(onChange).toHaveBeenCalledWith(5);
  });

  it("Radio renders options + reports selection", async () => {
    const onChange = jest.fn();
    const { getByText } = await render(
      <Radio
        onChange={onChange}
        data={[
          { value: "a", label: "Option A" },
          { value: "b", label: "Option B" },
        ]}
      />,
    );
    await fireEvent.press(getByText("Option B"));
    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("SegmentedControl renders segments + reports selection", async () => {
    const onChange = jest.fn();
    const { getByText } = await render(
      <SegmentedControl
        value="a"
        onChange={onChange}
        data={[
          { value: "a", label: "First" },
          { value: "b", label: "Second" },
        ]}
      />,
    );
    await fireEvent.press(getByText("Second"));
    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("Modal renders its children when opened", async () => {
    const { getByText } = await render(
      <Modal opened onClose={() => {}} title="Dialog">
        <Text>modal body</Text>
      </Modal>,
    );
    expect(getByText("Dialog")).toBeTruthy();
    expect(getByText("modal body")).toBeTruthy();
  });

  it("Modal hides its children when closed", async () => {
    const { queryByText } = await render(
      <Modal opened={false} onClose={() => {}} title="Dialog">
        <Text>modal body</Text>
      </Modal>,
    );
    expect(queryByText("modal body")).toBeNull();
  });
});
