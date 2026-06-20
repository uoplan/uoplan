import { fireEvent, render } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import MoreScreen from "@/app/more";
import type { AppLocale } from "@/i18n";
import { LocaleProvider, type LocaleStorage } from "@/i18n/locale-provider";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({
    back: jest.fn(),
    navigate: jest.fn(),
    push: mockPush,
  }),
}));

jest.mock("expo-localization", () => ({
  getLocales: () => [{ languageTag: "en-US" }],
}));

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function memoryStorage(initial: AppLocale | null): LocaleStorage {
  let value = initial;
  return {
    read: () => Promise.resolve(value),
    write: (locale) => {
      value = locale;
      return Promise.resolve();
    },
  };
}

function renderMore(override: AppLocale | null = null) {
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <LocaleProvider storage={memoryStorage(override)}>
        <MoreScreen />
      </LocaleProvider>
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  mockPush.mockClear();
});

it("does not show Personalize in settings because it is a tab", async () => {
  const { getByText, queryByText } = await renderMore();

  expect(getByText("Settings")).toBeTruthy();
  expect(queryByText("Planning")).toBeNull();
  expect(queryByText("Personalize")).toBeNull();
});

it("links to the native donate screen", async () => {
  const { getByText } = await renderMore();

  fireEvent.press(getByText("Support us"));

  expect(mockPush).toHaveBeenCalledWith("/donate");
});

it("opens the language switcher and shows the effective language", async () => {
  const { getByText } = await renderMore("en");

  expect(getByText("English")).toBeTruthy();

  fireEvent.press(getByText("Language"));

  expect(mockPush).toHaveBeenCalledWith("/more/language");
});

it("shows 'System' as the language description when following the device", async () => {
  const { getByText } = await renderMore(null);

  expect(getByText("System")).toBeTruthy();
});
