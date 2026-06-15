import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";

import type { AppLocale } from "@/i18n";
import { LocaleProvider, type LocaleStorage, useLocale } from "@/i18n/locale-provider";

const mockGetLocales = jest.fn<{ languageTag: string }[], []>(() => [{ languageTag: "en-US" }]);

jest.mock("expo-localization", () => ({
  getLocales: () => mockGetLocales(),
}));

function Probe() {
  const { locale, overrideLocale, loading } = useLocale();
  return <Text>{loading ? "loading" : `${locale}|${overrideLocale ?? "system"}`}</Text>;
}

function memoryStorage(initial: AppLocale | null): LocaleStorage & { value: AppLocale | null } {
  return {
    value: initial,
    read() {
      return Promise.resolve(this.value);
    },
    write(locale) {
      this.value = locale;
      return Promise.resolve();
    },
  };
}

beforeEach(() => {
  mockGetLocales.mockReset();
  mockGetLocales.mockReturnValue([{ languageTag: "en-US" }]);
});

it("activates the system locale (fr-CA) when there is no stored override", async () => {
  mockGetLocales.mockReturnValue([{ languageTag: "fr-CA" }]);
  const { getByText } = await render(
    <LocaleProvider storage={memoryStorage(null)}>
      <Probe />
    </LocaleProvider>,
  );

  await waitFor(() => expect(getByText("fr-CA|system")).toBeTruthy());
});

it("lets a stored override (en) win over the system locale (fr-CA)", async () => {
  mockGetLocales.mockReturnValue([{ languageTag: "fr-CA" }]);
  const { getByText } = await render(
    <LocaleProvider storage={memoryStorage("en")}>
      <Probe />
    </LocaleProvider>,
  );

  await waitFor(() => expect(getByText("en|en")).toBeTruthy());
});

it("returns to the system locale when the override is cleared to null", async () => {
  mockGetLocales.mockReturnValue([{ languageTag: "fr-CA" }]);
  const storage = memoryStorage("en");

  function Switcher() {
    const { locale, overrideLocale, setOverrideLocale } = useLocale();
    return (
      <Text onPress={() => setOverrideLocale(null)}>
        {`${locale}|${overrideLocale ?? "system"}`}
      </Text>
    );
  }

  const { getByText } = await render(
    <LocaleProvider storage={storage}>
      <Switcher />
    </LocaleProvider>,
  );

  await waitFor(() => expect(getByText("en|en")).toBeTruthy());

  fireEvent.press(getByText("en|en"));

  await waitFor(() => expect(getByText("fr-CA|system")).toBeTruthy());
  expect(storage.value).toBeNull();
});
