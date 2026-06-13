import { fireEvent, render } from "@testing-library/react-native";

import { WelcomeScreen } from "@uoplan/app";
import { NavigationProvider } from "@uoplan/navigation";
import type { NavigationAdapter } from "@uoplan/navigation";

// End-to-end proof of the write-once stack on the NATIVE shell: the shared
// WelcomeScreen (authored in @uoplan/app) resolves the React Native `.native.tsx`
// ui variants and drives the navigation contract. A mock adapter stands in for
// the Expo Router NativeNavigationProvider the real app supplies.
function mockAdapter(overrides?: Partial<NavigationAdapter>): NavigationAdapter {
  return {
    navigate: jest.fn(),
    goBack: jest.fn(),
    canGoBack: () => false,
    currentPath: () => "/",
    ...overrides,
  };
}

describe("WelcomeScreen (native variant)", () => {
  it("renders the shared screen via native ui variants", async () => {
    const { getByTestId, getByText } = await render(
      <NavigationProvider adapter={mockAdapter()}>
        <WelcomeScreen />
      </NavigationProvider>,
    );
    expect(getByTestId("welcome-screen")).toBeTruthy();
    expect(getByText("Plan your degree, one term at a time")).toBeTruthy();
  });

  it("navigates through the contract on press", async () => {
    const navigate = jest.fn();
    const { getByTestId } = await render(
      <NavigationProvider adapter={mockAdapter({ navigate })}>
        <WelcomeScreen />
      </NavigationProvider>,
    );
    await fireEvent.press(getByTestId("welcome-open-explore"));
    expect(navigate).toHaveBeenCalledWith({ name: "explore" });
  });
});
