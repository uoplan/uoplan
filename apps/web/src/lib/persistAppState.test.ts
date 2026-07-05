import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LOCAL_STORAGE_KEY } from "../store/constants";
import { defaultAppStore } from "../store/appStore";
import { useGraphPlannerStore } from "../store/graphPlannerStore";
import { flushPersistedAppState } from "./persistAppState";

describe("flushPersistedAppState", () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    useGraphPlannerStore.getState().resetPlanner();
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
    vi.stubGlobal("window", { location: { pathname: "/schedule" } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    useGraphPlannerStore.getState().resetPlanner();
  });

  it("writes encoded state to localStorage when catalogue and indices exist", () => {
    defaultAppStore.setState({
      ...defaultAppStore.getState(),
      firstSeed: 42,
      currentSeed: 43,
      catalogue: { courses: [], programs: [] },
      indices: { courses: [], programs: [], disciplines: [] },
    });

    flushPersistedAppState();
    expect(storage.get(LOCAL_STORAGE_KEY)).toBeTruthy();
  });

  it("no-ops when encoding is not available", () => {
    defaultAppStore.setState({
      ...defaultAppStore.getState(),
      catalogue: null,
      indices: null,
    });
    flushPersistedAppState();
    expect(storage.has(LOCAL_STORAGE_KEY)).toBe(false);
  });

  it("skips persistence while the selected term is linked to the calendar", () => {
    defaultAppStore.setState({
      ...defaultAppStore.getState(),
      selectedTermId: "2269",
      catalogue: { courses: [], programs: [] },
      indices: { courses: [], programs: [], disciplines: [] },
    });
    // The graph-planner term open in the calendar matches the selected term, so
    // the store holds a hypothetical completed set that must not be persisted.
    useGraphPlannerStore.setState({ linkedCalendarTermId: "2269" });

    flushPersistedAppState();
    expect(storage.has(LOCAL_STORAGE_KEY)).toBe(false);

    // A stale link for a different term must not block real saves.
    useGraphPlannerStore.setState({ linkedCalendarTermId: "9999" });
    flushPersistedAppState();
    expect(storage.get(LOCAL_STORAGE_KEY)).toBeTruthy();
  });
});
