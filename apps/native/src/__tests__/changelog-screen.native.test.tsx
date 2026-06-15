import { render, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import ChangelogScreen from "@/app/more/changelog";

jest.mock("expo-router", () => ({
  useRouter: () => ({
    back: jest.fn(),
  }),
}));

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

it("renders parsed release cards from the generated changelog", async () => {
  const { getByText, getAllByText } = await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ChangelogScreen />
    </SafeAreaProvider>,
  );

  await waitFor(() => expect(getByText("Changelog")).toBeTruthy());
  // The screen heading + at least one section badge should render.
  expect(getAllByText("Features").length).toBeGreaterThan(0);
});
