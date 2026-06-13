import { fireEvent, render } from "@testing-library/react-native";

import { Button } from "@uoplan/ui";

// Proves the T0 native test loop end-to-end: jest-expo resolves the `.native.tsx`
// variant of a `@uoplan/ui` primitive (same as the Metro device bundle), RNTL
// mounts it, and press handling works. This is the template every native
// primitive/screen render test follows.
describe("@uoplan/ui Button (native variant)", () => {
  it("renders its label and handles onPress", async () => {
    const onPress = jest.fn();
    const { getByText, getByTestId } = await render(
      <Button testID="contract-button" onPress={onPress}>
        shared button
      </Button>,
    );

    expect(getByText("shared button")).toBeTruthy();
    await fireEvent.press(getByTestId("contract-button"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
