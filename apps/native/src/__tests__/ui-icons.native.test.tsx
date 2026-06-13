import { fireEvent, render } from "@testing-library/react-native";

import { ActionIcon, Indicator, Text, ThemeIcon } from "@uoplan/ui";

// Proves jest-expo resolves the `.native.tsx` variants of the icon-tier
// primitives (same as the Metro device bundle) and RNTL mounts them. Mirrors
// the web browser icons contract test in apps/web.
describe("@uoplan/ui icon-tier primitives (native variants)", () => {
  it("ActionIcon renders + fires onPress", async () => {
    const onPress = jest.fn();
    const { getByTestId } = await render(
      <ActionIcon testID="contract-action" label="refresh" onPress={onPress}>
        <Text>R</Text>
      </ActionIcon>,
    );
    await fireEvent.press(getByTestId("contract-action"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("ActionIcon does not fire onPress when disabled", async () => {
    const onPress = jest.fn();
    const { getByTestId } = await render(
      <ActionIcon testID="contract-action" label="refresh" disabled onPress={onPress}>
        <Text>R</Text>
      </ActionIcon>,
    );
    await fireEvent.press(getByTestId("contract-action"));
    expect(onPress).not.toHaveBeenCalled();
  });

  it("ThemeIcon frames its child", async () => {
    const { getByText } = await render(
      <ThemeIcon tone="success">
        <Text>TI</Text>
      </ThemeIcon>,
    );
    expect(getByText("TI")).toBeTruthy();
  });

  it("Indicator shows a label over its child", async () => {
    const { getByText } = await render(
      <Indicator label={3} tone="danger">
        <Text>inbox</Text>
      </Indicator>,
    );
    expect(getByText("inbox")).toBeTruthy();
    expect(getByText("3")).toBeTruthy();
  });
});
