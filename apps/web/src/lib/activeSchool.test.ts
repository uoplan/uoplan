import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveActiveSchool, WORKER_NAME_SCHOOL_SEPARATOR } from "./activeSchool";

/**
 * `initializeActiveSchool` freezes its result for the lifetime of the module, so
 * each worker-scope case needs a fresh module graph.
 */
async function initializeWithWorkerName(name: string): Promise<string> {
  vi.resetModules();
  vi.stubGlobal("name", name);
  const mod = await import("./activeSchool");
  return mod.initializeActiveSchool();
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("resolveActiveSchool with unpublished schools", () => {
  // A school can sit in the registry before its scraped data reaches the `data`
  // branch, so `build:data-proto` skips it and the bundle ships no assets for
  // it. Booting as that school would fail on the first catalogue fetch.
  const ONLY_UOTTAWA = ["uottawa"] as const;

  it("falls back to uOttawa for a prefixed path whose school has no data", () => {
    expect(resolveActiveSchool("/carleton/schedule", null, ONLY_UOTTAWA)).toBe("uottawa");
    expect(resolveActiveSchool("/carleton/", "carleton", ONLY_UOTTAWA)).toBe("uottawa");
  });

  it("ignores a remembered school that has no data", () => {
    expect(resolveActiveSchool("/", "carleton", ONLY_UOTTAWA)).toBe("uottawa");
  });

  it("honours a school once its data is published", () => {
    const both = ["uottawa", "carleton"] as const;
    expect(resolveActiveSchool("/carleton/schedule", null, both)).toBe("carleton");
    expect(resolveActiveSchool("/", "carleton", both)).toBe("carleton");
  });

  it("treats an empty availability list as 'unknown' and imposes no restriction", () => {
    // Non-browser callers (tests, the worker path) have no glob to consult.
    expect(resolveActiveSchool("/carleton/schedule", null, [])).toBe("carleton");
  });
});

describe("resolveActiveSchool", () => {
  it("honours the remembered school only on the bare root", () => {
    expect(resolveActiveSchool("/", "carleton")).toBe("carleton");
    expect(resolveActiveSchool("", "carleton")).toBe("carleton");
    expect(resolveActiveSchool("/index.html", "carleton")).toBe("carleton");
  });

  it("falls back to uOttawa on the root with nothing remembered", () => {
    expect(resolveActiveSchool("/", null)).toBe("uottawa");
  });

  it("keeps unprefixed deep links on uOttawa even when Carleton is remembered", () => {
    // Every share link that predates Carleton looks like this; a remembered
    // school must never hijack them.
    for (const path of ["/explore", "/schedule", "/explore/course/csi-2110", "/requirements"]) {
      expect(resolveActiveSchool(path, "carleton")).toBe("uottawa");
    }
  });

  it("lets an explicit prefix win over a conflicting remembered school", () => {
    expect(resolveActiveSchool("/carleton/schedule", "uottawa")).toBe("carleton");
    expect(resolveActiveSchool("/carleton", "uottawa")).toBe("carleton");
  });

  it("ignores trailing slashes when deciding whether a path is the root", () => {
    expect(resolveActiveSchool("//", "carleton")).toBe("carleton");
    expect(resolveActiveSchool("/carleton/", "uottawa")).toBe("carleton");
  });
});

describe("initializeActiveSchool in a worker scope", () => {
  // A worker has no `window`, so it cannot see the page path or localStorage.
  // Without the URL param it silently resolved to uOttawa and then requested
  // `uottawa/schedules.*.pb` while generating a Carleton schedule.
  it("adopts the school carried on the worker script URL", async () => {
    await expect(
      initializeWithWorkerName(`calendar${WORKER_NAME_SCHOOL_SEPARATOR}carleton`),
    ).resolves.toBe("carleton");
  });

  it("still resolves uOttawa when the param says so", async () => {
    await expect(
      initializeWithWorkerName(`planner${WORKER_NAME_SCHOOL_SEPARATOR}uottawa`),
    ).resolves.toBe("uottawa");
  });

  it("falls back to uOttawa for a missing or unrecognised param", async () => {
    await expect(initializeWithWorkerName("")).resolves.toBe("uottawa");
    await expect(initializeWithWorkerName("calendar")).resolves.toBe("uottawa");
    await expect(
      initializeWithWorkerName(`calendar${WORKER_NAME_SCHOOL_SEPARATOR}mcgill`),
    ).resolves.toBe("uottawa");
  });
});
