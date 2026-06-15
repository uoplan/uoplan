import type { ComponentType } from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { Linking } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

jest.mock("expo-router", () => ({
  useRouter: () => ({
    back: jest.fn(),
  }),
}));

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function loadDonateScreen(): ComponentType | null {
  try {
    return require("@/app/donate").default as ComponentType;
  } catch {
    return null;
  }
}

async function renderDonateScreen() {
  const DonateScreen = loadDonateScreen();
  expect(DonateScreen).not.toBeNull();
  return await render(
    <SafeAreaProvider initialMetrics={metrics}>
      {DonateScreen ? <DonateScreen /> : null}
    </SafeAreaProvider>,
  );
}

describe("DonateScreen", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("renders the native donation guidance from the web donation page", async () => {
    const { getByText } = await renderDonateScreen();

    expect(getByText("Support us")).toBeTruthy();
    expect(getByText("Help keep uoplan free and running.")).toBeTruthy();
    expect(getByText("donate@uoplan.party")).toBeTruthy();
    expect(getByText("Auto-deposit is enabled")).toBeTruthy();
  });

  it("opens the donation email from the primary CTA", async () => {
    const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
    const { getByText } = await renderDonateScreen();

    fireEvent.press(getByText("Donate"));

    expect(openURL).toHaveBeenCalledWith("mailto:donate@uoplan.party");
  });
});
