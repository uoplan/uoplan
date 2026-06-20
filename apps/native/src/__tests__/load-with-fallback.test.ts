import { loadAppDataWithFallback, type LoadWithFallbackDeps } from "@/data/load-with-fallback";

type Manifest = Record<string, string>;

/** Builds a deps object whose individual hooks are jest mocks the test can assert on. */
function makeDeps(overrides: Partial<LoadWithFallbackDeps<Manifest, string>>) {
  const knownGood: { value: Manifest | null } = { value: null };
  const deps: LoadWithFallbackDeps<Manifest, string> = {
    loadManifest: jest.fn(async () => ({ "grades.pb": "/assets/grades-new.pb" })),
    build: jest.fn(async (m: Manifest) => `built:${JSON.stringify(m)}`),
    readKnownGood: jest.fn(async () => knownGood.value),
    writeKnownGood: jest.fn(async (m: Manifest) => {
      knownGood.value = m;
    }),
    sameManifest: (a, b) => JSON.stringify(a) === JSON.stringify(b),
    ...overrides,
  };
  return { deps, knownGood };
}

describe("loadAppDataWithFallback", () => {
  it("builds from the fresh manifest and records it as known-good on success", async () => {
    const { deps, knownGood } = makeDeps({});

    const data = await loadAppDataWithFallback(deps);

    expect(data).toBe('built:{"grades.pb":"/assets/grades-new.pb"}');
    expect(deps.writeKnownGood).toHaveBeenCalledWith({ "grades.pb": "/assets/grades-new.pb" });
    expect(knownGood.value).toEqual({ "grades.pb": "/assets/grades-new.pb" });
  });

  it("falls back to the last known-good manifest when the fresh data fails to decode", async () => {
    const fresh = { "grades.pb": "/assets/grades-NEWFORMAT.pb" };
    const good = { "grades.pb": "/assets/grades-OLDGOOD.pb" };
    const onFallback = jest.fn();
    const build = jest.fn(async (m: Manifest) => {
      if (m === fresh) throw new Error("proto format changed");
      return `built:${m["grades.pb"]}`;
    });
    const { deps } = makeDeps({
      loadManifest: jest.fn(async () => fresh),
      build,
      readKnownGood: jest.fn(async () => good),
      onFallback,
    });

    const data = await loadAppDataWithFallback(deps);

    expect(data).toBe("built:/assets/grades-OLDGOOD.pb");
    expect(onFallback).toHaveBeenCalledTimes(1);
    // Must NOT overwrite the good snapshot with the manifest that failed to decode.
    expect(deps.writeKnownGood).not.toHaveBeenCalled();
  });

  it("rethrows the original error when the fresh data fails and there is no known-good snapshot", async () => {
    const build = jest.fn(async () => {
      throw new Error("first-launch decode failure");
    });
    const { deps } = makeDeps({
      build,
      readKnownGood: jest.fn(async () => null),
    });

    await expect(loadAppDataWithFallback(deps)).rejects.toThrow("first-launch decode failure");
  });

  it("does not retry when the known-good manifest is identical to the fresh one", async () => {
    const same = { "grades.pb": "/assets/grades-same.pb" };
    const build = jest.fn(async () => {
      throw new Error("decode failure");
    });
    const onFallback = jest.fn();
    const { deps } = makeDeps({
      loadManifest: jest.fn(async () => ({ ...same })),
      build,
      readKnownGood: jest.fn(async () => ({ ...same })),
      onFallback,
    });

    await expect(loadAppDataWithFallback(deps)).rejects.toThrow("decode failure");
    // Built once (the fresh attempt) — no pointless rebuild of identical data.
    expect(build).toHaveBeenCalledTimes(1);
    expect(onFallback).not.toHaveBeenCalled();
  });

  it("rethrows the original error when the known-good fallback also fails to build", async () => {
    const fresh = { "grades.pb": "/assets/grades-new.pb" };
    const good = { "grades.pb": "/assets/grades-old.pb" };
    const build = jest.fn(async (m: Manifest) => {
      if (m === fresh) throw new Error("fresh decode failure");
      throw new Error("cache evicted");
    });
    const { deps } = makeDeps({
      loadManifest: jest.fn(async () => fresh),
      build,
      readKnownGood: jest.fn(async () => good),
    });

    await expect(loadAppDataWithFallback(deps)).rejects.toThrow("fresh decode failure");
  });

  it("serves bundled data when fresh data fails and the known-good cache is unavailable", async () => {
    const fresh = { "grades.pb": "/assets/grades-new.pb" };
    const buildBundled = jest.fn(async () => "built:bundled");
    const onBundledFallback = jest.fn();
    const { deps } = makeDeps({
      loadManifest: jest.fn(async () => fresh),
      build: jest.fn(async () => {
        throw new Error("fresh decode failure");
      }),
      readKnownGood: jest.fn(async () => null),
      buildBundled,
      onBundledFallback,
    });

    const data = await loadAppDataWithFallback(deps);

    expect(data).toBe("built:bundled");
    expect(buildBundled).toHaveBeenCalledTimes(1);
    expect(onBundledFallback).toHaveBeenCalledTimes(1);
    expect(deps.writeKnownGood).not.toHaveBeenCalled();
  });

  it("serves bundled data when loading the fresh manifest fails on first launch", async () => {
    const buildBundled = jest.fn(async () => "built:bundled");
    const onBundledFallback = jest.fn();
    const { deps } = makeDeps({
      loadManifest: jest.fn(async () => {
        throw new Error("offline before manifest cache exists");
      }),
      buildBundled,
      onBundledFallback,
    });

    const data = await loadAppDataWithFallback(deps);

    expect(data).toBe("built:bundled");
    expect(deps.build).not.toHaveBeenCalled();
    expect(deps.readKnownGood).toHaveBeenCalledTimes(1);
    expect(onBundledFallback).toHaveBeenCalledTimes(1);
  });

  it("serves bundled data when the known-good fallback cannot be decoded", async () => {
    const fresh = { "grades.pb": "/assets/grades-new.pb" };
    const good = { "grades.pb": "/assets/grades-old.pb" };
    const buildBundled = jest.fn(async () => "built:bundled");
    const { deps } = makeDeps({
      loadManifest: jest.fn(async () => fresh),
      build: jest.fn(async () => {
        throw new Error("decode failure");
      }),
      readKnownGood: jest.fn(async () => good),
      buildBundled,
    });

    const data = await loadAppDataWithFallback(deps);

    expect(data).toBe("built:bundled");
    expect(deps.build).toHaveBeenCalledTimes(2);
    expect(buildBundled).toHaveBeenCalledTimes(1);
  });

  it("rethrows the original error when bundled data is unavailable too", async () => {
    const { deps } = makeDeps({
      build: jest.fn(async () => {
        throw new Error("fresh decode failure");
      }),
      readKnownGood: jest.fn(async () => null),
      buildBundled: jest.fn(async () => null),
    });

    await expect(loadAppDataWithFallback(deps)).rejects.toThrow("fresh decode failure");
  });

  it("rethrows the original error when bundled data also fails to build", async () => {
    const { deps } = makeDeps({
      build: jest.fn(async () => {
        throw new Error("fresh decode failure");
      }),
      readKnownGood: jest.fn(async () => null),
      buildBundled: jest.fn(async () => {
        throw new Error("bundled asset missing");
      }),
    });

    await expect(loadAppDataWithFallback(deps)).rejects.toThrow("fresh decode failure");
  });
});
