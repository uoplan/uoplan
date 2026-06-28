import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { Pressable, Text, View } from "react-native";

import {
  OnboardingProvider,
  useOnboarding,
  type OnboardingStorage,
} from "@/data/onboarding-provider";
import { OnboardingScreen, PERSONALIZE_ROUTE } from "@/components/onboarding-screen";

const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock("@/components/loading-screen", () => ({
  LoadingScreen: () => null,
}));

function createStorage(initialCompleted = false): OnboardingStorage {
  let completed = initialCompleted;
  return {
    read: jest.fn(async () => completed),
    write: jest.fn(async (nextCompleted) => {
      completed = nextCompleted;
    }),
  };
}

function ProviderHarness() {
  const { completed, loading, complete, reset } = useOnboarding();
  return (
    <View>
      <Text>{loading ? "loading" : completed ? "completed" : "not completed"}</Text>
      <Pressable testID="complete-onboarding" onPress={complete}>
        <Text>Complete onboarding</Text>
      </Pressable>
      <Pressable testID="reset-onboarding" onPress={reset}>
        <Text>Reset onboarding</Text>
      </Pressable>
    </View>
  );
}

describe("OnboardingProvider", () => {
  it("loads the flag, flips completed, and persists changes", async () => {
    const storage = createStorage();

    const { getByText, getByTestId } = await render(
      <OnboardingProvider storage={storage}>
        <ProviderHarness />
      </OnboardingProvider>,
    );

    await waitFor(() => expect(getByText("not completed")).toBeTruthy());

    fireEvent.press(getByTestId("complete-onboarding"));

    await waitFor(() => expect(getByText("completed")).toBeTruthy());
    expect(storage.write).toHaveBeenCalledWith(true);

    fireEvent.press(getByTestId("reset-onboarding"));

    await waitFor(() => expect(getByText("not completed")).toBeTruthy());
    expect(storage.write).toHaveBeenLastCalledWith(false);
  });
});

describe("OnboardingScreen", () => {
  beforeEach(() => {
    mockReplace.mockClear();
  });

  it("routes to personalization and completes onboarding from the primary CTA", async () => {
    const storage = createStorage();

    const { getByTestId } = await render(
      <OnboardingProvider storage={storage}>
        <OnboardingScreen />
      </OnboardingProvider>,
    );

    fireEvent.press(getByTestId("onboarding-personalize"));

    expect(mockReplace).toHaveBeenCalledWith(PERSONALIZE_ROUTE);
    // `complete()` is deferred to the next frame (so the loading overlay paints
    // before the heavy navigator mount), so wait for the persisted flag.
    await waitFor(() => expect(storage.write).toHaveBeenCalledWith(true));
  });

  it("completes onboarding without navigation when skipped", async () => {
    const storage = createStorage();

    const { getByTestId } = await render(
      <OnboardingProvider storage={storage}>
        <OnboardingScreen />
      </OnboardingProvider>,
    );

    fireEvent.press(getByTestId("onboarding-skip"));

    expect(mockReplace).not.toHaveBeenCalled();
    await waitFor(() => expect(storage.write).toHaveBeenCalledWith(true));
  });
});
