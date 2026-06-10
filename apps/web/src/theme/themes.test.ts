import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getSystemBase,
  persistSelection,
  readStoredSelection,
  resolveTheme,
  THEME_STORAGE_KEY,
  type ThemeSelection,
} from "./themes";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubWindow(opts: { prefersDark?: boolean; store?: Record<string, string> }) {
  const store = opts.store ?? {};
  vi.stubGlobal("window", {
    matchMedia: (query: string) => ({
      matches: query.includes("dark") ? !!opts.prefersDark : false,
    }),
    localStorage: {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
    },
  });
  return store;
}

describe("resolveTheme", () => {
  it("returns the explicitly selected theme regardless of system base", () => {
    expect(resolveTheme("dark", "light").id).toBe("dark");
    expect(resolveTheme("light", "dark").id).toBe("light");
  });

  it("maps a system selection through the system base", () => {
    expect(resolveTheme("system", "dark").id).toBe("dark");
    expect(resolveTheme("system", "light").id).toBe("light");
  });

  it("falls back to the system mapping for an unknown selection", () => {
    // A stale persisted id could reach resolveTheme at runtime; cast to exercise
    // the defensive fallback branch despite the strict ThemeSelection type.
    expect(resolveTheme("does-not-exist" as ThemeSelection, "light").id).toBe("light");
  });
});

describe("getSystemBase", () => {
  it("reflects the OS dark preference", () => {
    stubWindow({ prefersDark: true });
    expect(getSystemBase()).toBe("dark");
  });

  it("reflects the OS light preference", () => {
    stubWindow({ prefersDark: false });
    expect(getSystemBase()).toBe("light");
  });
});

describe("readStoredSelection", () => {
  it("returns a persisted, valid theme id", () => {
    stubWindow({ store: { [THEME_STORAGE_KEY]: "light" } });
    expect(readStoredSelection()).toBe("light");
  });

  it("returns 'system' when persisted as system", () => {
    stubWindow({ store: { [THEME_STORAGE_KEY]: "system" } });
    expect(readStoredSelection()).toBe("system");
  });

  it("falls back to 'system' for an unknown stored value", () => {
    stubWindow({ store: { [THEME_STORAGE_KEY]: "neon" } });
    expect(readStoredSelection()).toBe("system");
  });

  it("falls back to 'system' when nothing is stored", () => {
    stubWindow({});
    expect(readStoredSelection()).toBe("system");
  });
});

describe("persistSelection", () => {
  it("writes the selection to localStorage", () => {
    const store = stubWindow({});
    persistSelection("dark");
    expect(store[THEME_STORAGE_KEY]).toBe("dark");
  });
});
