import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import LanguageScreen from "@/app/more/language";
import type { AppLocale } from "@/i18n";
import { LocaleProvider, type LocaleStorage } from "@/i18n/locale-provider";

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn(), push: jest.fn() }),
}));

jest.mock("expo-localization", () => ({
  getLocales: () => [{ languageTag: "en-US" }],
}));

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function memoryStorage(initial: AppLocale | null) {
  const writes: (AppLocale | null)[] = [];
  const storage: LocaleStorage & { writes: (AppLocale | null)[]; value: AppLocale | null } = {
    writes,
    value: initial,
    read: () => Promise.resolve(storage.value),
    write: (locale) => {
      storage.value = locale;
      writes.push(locale);
      return Promise.resolve();
    },
  };
  return storage;
}

function renderScreen(override: AppLocale | null) {
  const storage = memoryStorage(override);
  const utils = render(
    <SafeAreaProvider initialMetrics={metrics}>
      <LocaleProvider storage={storage}>
        <LanguageScreen />
      </LocaleProvider>
    </SafeAreaProvider>,
  );
  return { storage, utils };
}

it("lists the system, English and French (Canada) options", async () => {
  const { utils } = renderScreen(null);
  const { getByText } = await utils;

  expect(getByText("System default")).toBeTruthy();
  expect(getByText("English")).toBeTruthy();
  expect(getByText("Français (Canada)")).toBeTruthy();
});

it("persists English when the English option is selected", async () => {
  const { storage, utils } = renderScreen(null);
  const { getByText } = await utils;

  fireEvent.press(getByText("English"));

  await waitFor(() => expect(storage.value).toBe("en"));
  expect(storage.writes).toContain("en");
});

it("persists fr-CA when the French (Canada) option is selected", async () => {
  const { storage, utils } = renderScreen(null);
  const { getByText } = await utils;

  fireEvent.press(getByText("Français (Canada)"));

  await waitFor(() => expect(storage.value).toBe("fr-CA"));
  expect(storage.writes).toContain("fr-CA");
});

it("returns to the system locale when System default is selected", async () => {
  const { storage, utils } = renderScreen("en");
  const { getByText } = await utils;

  fireEvent.press(getByText("System default"));

  await waitFor(() => expect(storage.value).toBeNull());
  expect(storage.writes).toContain(null);
});
