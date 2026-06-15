import { afterEach, describe, expect, it, vi } from "vitest";
import { getSystemBase, persistSelection, readStoredSelection, THEME_STORAGE_KEY } from "./themes";

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
