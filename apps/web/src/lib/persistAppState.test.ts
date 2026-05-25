import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { LOCAL_STORAGE_KEY } from "../store/constants";
import { useAppStore } from "../store/appStore";
import { flushPersistedAppState } from "./persistAppState";

describe("flushPersistedAppState", () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    vi.stubGlobal("localStorage", {
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      getItem: (key: string) => storage.get(key) ?? null,
      removeItem: (key: string) => {
        storage.delete(key);
      },
      clear: () => storage.clear(),
    });
    vi.stubGlobal("window", { location: { pathname: "/schedule/calendar/advanced" } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("writes encoded state to localStorage when catalogue and indices exist", () => {
    useAppStore.setState({
      ...useAppStore.getState(),
      firstSeed: 42,
      currentSeed: 43,
      catalogue: { courses: [], programs: [] },
      indices: { courses: [], programs: [], disciplines: [] },
    });

    flushPersistedAppState();
    expect(storage.get(LOCAL_STORAGE_KEY)).toBeTruthy();
  });

  it("no-ops when encoding is not available", () => {
    useAppStore.setState({
      ...useAppStore.getState(),
      catalogue: null,
      indices: null,
    });
    flushPersistedAppState();
    expect(storage.has(LOCAL_STORAGE_KEY)).toBe(false);
  });
});
