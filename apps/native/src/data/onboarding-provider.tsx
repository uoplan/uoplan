import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { File as FileType, Paths as PathsType } from "expo-file-system";

/** File under the persistent document dir that stores the first-run flag. */
export const ONBOARDING_FILE = "uoplan-onboarding.json";

export interface OnboardingStorage {
  read(): Promise<boolean>;
  write(completed: boolean): Promise<void>;
}

interface OnboardingContextValue {
  completed: boolean;
  loading: boolean;
  complete(): void;
  reset(): void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function parseOnboardingState(text: string): boolean {
  try {
    const raw: unknown = JSON.parse(text);
    if (typeof raw === "boolean") return raw;
    if (raw && typeof raw === "object" && "completed" in raw) {
      return (raw as { completed?: unknown }).completed === true;
    }
    return false;
  } catch {
    return false;
  }
}

export function serializeOnboardingState(completed: boolean): string {
  return JSON.stringify({ completed });
}

function fileSystem(): { File: typeof FileType; Paths: typeof PathsType } {
  return require("expo-file-system");
}

export const documentOnboardingStorage: OnboardingStorage = {
  async read() {
    try {
      const { File, Paths } = fileSystem();
      const file = new File(Paths.document, ONBOARDING_FILE);
      if (!file.exists) return false;
      return parseOnboardingState(await file.text());
    } catch {
      return false;
    }
  },

  async write(completed) {
    try {
      const { File, Paths } = fileSystem();
      const file = new File(Paths.document, ONBOARDING_FILE);
      file.write(serializeOnboardingState(completed));
    } catch {
      // best-effort: a failed write must not block the first-run flow.
    }
  },
};

export function OnboardingProvider({
  children,
  storage = documentOnboardingStorage,
}: {
  children: ReactNode;
  storage?: OnboardingStorage;
}) {
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void storage
      .read()
      .then((loaded) => {
        if (!active) return;
        setCompleted(loaded);
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [storage]);

  const persistCompleted = useCallback(
    (nextCompleted: boolean) => {
      setCompleted(nextCompleted);
      void storage.write(nextCompleted).catch(() => {});
    },
    [storage],
  );

  const complete = useCallback(() => persistCompleted(true), [persistCompleted]);
  const reset = useCallback(() => persistCompleted(false), [persistCompleted]);

  const value = useMemo<OnboardingContextValue>(
    () => ({ completed, loading, complete, reset }),
    [completed, loading, complete, reset],
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): OnboardingContextValue {
  const value = useContext(OnboardingContext);
  if (!value) throw new Error("useOnboarding must be used within an OnboardingProvider");
  return value;
}
