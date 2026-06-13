import { loadDataAssetManifest, MANIFEST_CACHE_KEY, parseDataManifest } from "@/data/manifest";
import type { TextCache } from "@/data/manifest";

function memoryCache(): TextCache & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    read: async (key) => store.get(key) ?? null,
    write: async (key, value) => {
      store.set(key, value);
    },
  };
}

describe("parseDataManifest", () => {
  it("keeps only string-valued id → url entries", () => {
    const manifest = parseDataManifest(
      JSON.stringify({ "terms.pb": "/assets/terms-x.pb", bad: 42, also: null }),
    );
    expect(manifest).toEqual({ "terms.pb": "/assets/terms-x.pb" });
  });

  it("rejects non-object JSON (e.g. the SPA index.html fallback)", () => {
    expect(() => parseDataManifest("<!doctype html>")).toThrow();
    expect(() => parseDataManifest("[1,2,3]")).toThrow(/expected a JSON object/);
  });
});

describe("loadDataAssetManifest", () => {
  const manifestJson = JSON.stringify({ "terms.pb": "/assets/terms-abc.pb" });

  function okFetch(body: string) {
    return jest.fn(async (_url: string) => ({ ok: true, status: 200, text: async () => body }));
  }

  it("fetches the manifest from <baseUrl>/data/manifest.json and caches the text", async () => {
    const cache = memoryCache();
    const fetchUrl = okFetch(manifestJson);

    const manifest = await loadDataAssetManifest({
      baseUrl: "https://example.test",
      cache,
      fetch: fetchUrl,
    });

    expect(manifest).toEqual({ "terms.pb": "/assets/terms-abc.pb" });
    expect(fetchUrl).toHaveBeenCalledWith("https://example.test/data/manifest.json");
    expect(cache.store.get(MANIFEST_CACHE_KEY)).toBe(manifestJson);
  });

  it("falls back to the cached manifest when the network fails", async () => {
    const cache = memoryCache();
    cache.store.set(MANIFEST_CACHE_KEY, manifestJson);
    const fetchUrl = jest.fn(async () => {
      throw new Error("offline");
    });

    const manifest = await loadDataAssetManifest({
      baseUrl: "https://example.test",
      cache,
      fetch: fetchUrl,
    });

    expect(manifest).toEqual({ "terms.pb": "/assets/terms-abc.pb" });
  });

  it("throws when the network fails and there is no cached manifest", async () => {
    const cache = memoryCache();
    const fetchUrl = jest.fn(async () => {
      throw new Error("offline");
    });

    await expect(
      loadDataAssetManifest({ baseUrl: "https://example.test", cache, fetch: fetchUrl }),
    ).rejects.toThrow("offline");
  });

  it("treats a non-OK response as a failure and falls back to cache", async () => {
    const cache = memoryCache();
    cache.store.set(MANIFEST_CACHE_KEY, manifestJson);
    const fetchUrl = jest.fn(async (_url: string) => ({
      ok: false,
      status: 404,
      text: async () => "",
    }));

    const manifest = await loadDataAssetManifest({
      baseUrl: "https://example.test",
      cache,
      fetch: fetchUrl,
    });

    expect(manifest).toEqual({ "terms.pb": "/assets/terms-abc.pb" });
  });
});
