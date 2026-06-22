import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AppState, type AppStateStatus } from "react-native";

import { I18nProvider } from "@uoplan/i18n";

import {
  activateNativeLocale,
  type AppLocale,
  DEFAULT_LOCALE,
  detectNativeLocale,
  i18n,
} from "@/i18n";
import { readLocaleOverride, writeLocaleOverride } from "@/i18n/locale-storage";
import { getAnalytics } from "@/lib/analytics/client";

/** Persistence seam so tests can inject an in-memory override store. */
export interface LocaleStorage {
  read(): Promise<AppLocale | null>;
  write(locale: AppLocale | null): Promise<void>;
}

const documentLocaleStorage: LocaleStorage = {
  read: readLocaleOverride,
  write: writeLocaleOverride,
};

interface LocaleContextValue {
  /** The currently active app locale. */
  locale: AppLocale;
  /** The persisted override, or `null` when following the system locale. */
  overrideLocale: AppLocale | null;
  /** True until the stored override has been read on mount. */
  loading: boolean;
  /** Persist + apply an override; `null` returns to following the system. */
  setOverrideLocale(locale: AppLocale | null): void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

/**
 * Owns the native locale lifecycle: resolves the effective locale from a stored
 * override (or the device language when there is none), persists user choices,
 * and re-detects the system locale on foreground so an OS-level language change
 * is honoured without a relaunch (notably on Android, per the Expo docs). Wraps
 * children in Lingui's `<I18nProvider>` so translated components re-render on
 * `i18n.activate`.
 */
export function LocaleProvider({
  children,
  storage = documentLocaleStorage,
}: {
  children: ReactNode;
  storage?: LocaleStorage;
}) {
  const [locale, setLocale] = useState<AppLocale>(DEFAULT_LOCALE);
  const [overrideLocale, setOverrideState] = useState<AppLocale | null>(null);
  const [loading, setLoading] = useState(true);

  const applyLocale = useCallback((next: AppLocale) => {
    activateNativeLocale(next);
    setLocale(next);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void storage
      .read()
      .then((stored) => {
        if (!active) return;
        setOverrideState(stored);
        applyLocale(stored ?? detectNativeLocale(null));
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [storage, applyLocale]);

  // When following the system locale, re-detect on foreground: Android delivers
  // an OS language change to a running app only when it returns to the front.
  useEffect(() => {
    if (overrideLocale !== null) return;
    const subscription = AppState.addEventListener("change", (status: AppStateStatus) => {
      if (status === "active") applyLocale(detectNativeLocale(null));
    });
    return () => subscription.remove();
  }, [overrideLocale, applyLocale]);

  const setOverrideLocale = useCallback(
    (next: AppLocale | null) => {
      const effectiveLocale = next ?? detectNativeLocale(null);
      setOverrideState(next);
      void storage.write(next).catch(() => {});
      applyLocale(effectiveLocale);
      getAnalytics().capture("locale_changed", { locale: effectiveLocale });
    },
    [storage, applyLocale],
  );

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, overrideLocale, loading, setOverrideLocale }),
    [locale, overrideLocale, loading, setOverrideLocale],
  );

  return (
    <LocaleContext.Provider value={value}>
      <I18nProvider i18n={i18n}>{children}</I18nProvider>
    </LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const value = useContext(LocaleContext);
  if (!value) throw new Error("useLocale must be used within a LocaleProvider");
  return value;
}
