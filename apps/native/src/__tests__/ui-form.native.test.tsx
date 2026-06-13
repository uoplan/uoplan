import { fireEvent, render } from "@testing-library/react-native";

import { Alert, Anchor, Checkbox, Pill, Progress, Skeleton, Switch, TextInput } from "@uoplan/ui";

// Proves jest-expo resolves the `.native.tsx` variants of the form/feedback
// primitives (same as the Metro device bundle) and RNTL mounts them. Mirrors
// the web browser form contract test in apps/web.
describe("@uoplan/ui form & feedback primitives (native variants)", () => {
  it("Anchor renders + handles onPress", async () => {
    const onPress = jest.fn();
    const { getByTestId, getByText } = await render(
      <Anchor testID="contract-anchor" onPress={onPress}>
        link
      </Anchor>,
    );
    expect(getByText("link")).toBeTruthy();
    await fireEvent.press(getByTestId("contract-anchor"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("TextInput renders + reports edits", async () => {
    const onChangeText = jest.fn();
    const { getByTestId } = await render(
      <TextInput testID="contract-input" onChangeText={onChangeText} placeholder="type" />,
    );
    await fireEvent.changeText(getByTestId("contract-input"), "hello");
    expect(onChangeText).toHaveBeenCalledWith("hello");
  });

  it("Checkbox renders + reports toggle", async () => {
    const onChange = jest.fn();
    const { getByTestId } = await render(
      <Checkbox testID="contract-checkbox" onChange={onChange} label="agree" />,
    );
    await fireEvent.press(getByTestId("contract-checkbox"));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("Switch renders", async () => {
    const { getByTestId } = await render(<Switch testID="contract-switch" />);
    expect(getByTestId("contract-switch")).toBeTruthy();
  });

  it("Alert renders its title + body", async () => {
    const { getByTestId, getByText } = await render(
      <Alert testID="contract-alert" tone="warning" title="heads up">
        something happened
      </Alert>,
    );
    expect(getByTestId("contract-alert")).toBeTruthy();
    expect(getByText("something happened")).toBeTruthy();
  });

  it("Progress renders", async () => {
    const { getByTestId } = await render(<Progress testID="contract-progress" value={42} />);
    expect(getByTestId("contract-progress")).toBeTruthy();
  });

  it("Skeleton renders", async () => {
    const { getByTestId } = await render(<Skeleton testID="contract-skeleton" height={24} />);
    expect(getByTestId("contract-skeleton")).toBeTruthy();
  });

  it("Pill renders its label", async () => {
    const { getByTestId, getByText } = await render(<Pill testID="contract-pill">filter</Pill>);
    expect(getByTestId("contract-pill")).toBeTruthy();
    expect(getByText("filter")).toBeTruthy();
  });
});
