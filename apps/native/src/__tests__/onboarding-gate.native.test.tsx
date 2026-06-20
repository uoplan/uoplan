import { render } from "@testing-library/react-native";

let mockDataStatus: "ready" | "loading" | "error" = "ready";
let mockOnboardingState = { completed: false, loading: false };

jest.mock("expo-font", () => ({
  useFonts: () => [true],
}));

jest.mock("expo-router", () => {
  const React = require("react");
  const { Text, View } = require("react-native");

  function Stack({ children }: { children: React.ReactNode }) {
    return <View testID="root-stack">{children}</View>;
  }
  Stack.Screen = ({ name }: { name: string }) => <Text>{name}</Text>;

  return {
    DarkTheme: {},
    DefaultTheme: {},
    Stack,
    ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

jest.mock("@/components/animated-icon", () => ({
  AnimatedSplashOverlay: () => null,
}));

jest.mock("@/components/loading-screen", () => ({
  LoadingErrorScreen: () => null,
  LoadingScreen: () => null,
}));

jest.mock("@/data/data-provider", () => ({
  AppDataProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAppDataState: () => ({
    state: { status: mockDataStatus },
    reload: jest.fn(),
  }),
}));

jest.mock("@/data/basket-provider", () => ({
  BasketProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock("@/data/completed-courses-provider", () => ({
  CompletedCoursesProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock("@/data/schedule-options-provider", () => ({
  ScheduleOptionsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock("@/data/onboarding-provider", () => ({
  OnboardingProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useOnboarding: () => mockOnboardingState,
}));

jest.mock("@/components/onboarding-screen", () => {
  const { Text } = require("react-native");
  return {
    OnboardingScreen: () => <Text>First-run onboarding</Text>,
  };
});

import RootLayout from "@/app/_layout";

describe("root onboarding gate", () => {
  beforeEach(() => {
    mockDataStatus = "ready";
    mockOnboardingState = { completed: false, loading: false };
  });

  it("shows onboarding instead of mounting the root stack after data and onboarding load", async () => {
    const { getByText, queryByTestId } = await render(<RootLayout />);

    expect(getByText("First-run onboarding")).toBeTruthy();
    expect(queryByTestId("root-stack")).toBeNull();
  });

  it("mounts the root stack after onboarding is complete", async () => {
    mockOnboardingState = { completed: true, loading: false };

    const { getByTestId, queryByText } = await render(<RootLayout />);

    expect(getByTestId("root-stack")).toBeTruthy();
    expect(queryByText("First-run onboarding")).toBeNull();
  });
});
