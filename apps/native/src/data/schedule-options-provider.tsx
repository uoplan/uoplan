import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { DEFAULT_SCHEDULE_OPTIONS, type ScheduleOptions } from "@/lib/schedule-options";
import { readScheduleOptions, writeScheduleOptions } from "./schedule-options-storage";

export interface SchedulePersonalization {
  termId: string | null;
  startYear: string | null;
  programUrl: string | null;
}

interface ScheduleOptionsContextValue {
  options: ScheduleOptions;
  personalization: SchedulePersonalization;
  /** Patch one or more option fields (persisted to disk). */
  setOptions(patch: Partial<ScheduleOptions>): void;
  /** Patch one or more personalization fields for the schedule wizard. */
  setPersonalization(patch: Partial<SchedulePersonalization>): void;
  /** Restore every option to its default. */
  reset(): void;
  /** Clear schedule wizard selections. */
  resetPersonalization(): void;
}

const ScheduleOptionsContext = createContext<ScheduleOptionsContextValue | null>(null);
const DEFAULT_PERSONALIZATION: SchedulePersonalization = {
  termId: null,
  startYear: null,
  programUrl: null,
};

/**
 * Holds the user's schedule-generation options (time window, avoided days,
 * prefer-easier / prefer-higher-sentiment, min professor rating, elective
 * levels, compressed, closed/virtual sections) — the native analogue of the web
 * generation-options store slice. Persisted to a JSON file in the document dir
 * and reloaded on launch so preferences survive restarts.
 */
export function ScheduleOptionsProvider({ children }: { children: ReactNode }) {
  const [options, setOptionsState] = useState<ScheduleOptions>(DEFAULT_SCHEDULE_OPTIONS);
  const [personalization, setPersonalizationState] =
    useState<SchedulePersonalization>(DEFAULT_PERSONALIZATION);
  // Skip persisting the very first state set (the initial load from disk).
  const hydrated = useRef(false);

  useEffect(() => {
    let active = true;
    void readScheduleOptions().then((loaded) => {
      if (active) setOptionsState(loaded);
      hydrated.current = true;
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    void writeScheduleOptions(options);
  }, [options]);

  const setOptions = useCallback((patch: Partial<ScheduleOptions>) => {
    setOptionsState((current) => ({ ...current, ...patch }));
  }, []);

  const setPersonalization = useCallback((patch: Partial<SchedulePersonalization>) => {
    setPersonalizationState((current) => ({ ...current, ...patch }));
  }, []);

  const reset = useCallback(() => setOptionsState({ ...DEFAULT_SCHEDULE_OPTIONS }), []);
  const resetPersonalization = useCallback(
    () => setPersonalizationState({ ...DEFAULT_PERSONALIZATION }),
    [],
  );

  const value = useMemo<ScheduleOptionsContextValue>(
    () => ({
      options,
      personalization,
      setOptions,
      setPersonalization,
      reset,
      resetPersonalization,
    }),
    [options, personalization, setOptions, setPersonalization, reset, resetPersonalization],
  );

  return (
    <ScheduleOptionsContext.Provider value={value}>{children}</ScheduleOptionsContext.Provider>
  );
}

/** Access the schedule-generation options. Throws if used outside the provider. */
export function useScheduleOptions(): ScheduleOptionsContextValue {
  const value = useContext(ScheduleOptionsContext);
  if (!value) throw new Error("useScheduleOptions must be used within a ScheduleOptionsProvider");
  return value;
}
