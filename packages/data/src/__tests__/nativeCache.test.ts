import { describe, expect, it, vi } from "vitest";
import { createNativeCachingTransport } from "../nativeCache";
import type { CachedBytesStorage } from "../nativeCache";

function memoryStorage(): CachedBytesStorage & { map: Map<string, Uint8Array> } {
  const map = new Map<string, Uint8Array>();
  return {
    map,
    get: async (key) => map.get(key) ?? null,
    set: async (key, bytes) => {
      map.set(key, bytes);
    },
  };
}

function okResponse(payload: Uint8Array) {
  return {
    ok: true,
    status: 200,
    arrayBuffer: async () =>
      payload.buffer.slice(
        payload.byteOffset,
        payload.byteOffset + payload.byteLength,
      ) as ArrayBuffer,
  };
}

const resolve = (id: string) => (id === "catalogue.pb" ? "/assets/catalogue-abc123.pb" : undefined);

describe("createNativeCachingTransport", () => {
  it("fetches over the network on a cold cache and persists the bytes for reuse", async () => {
    const payload = new Uint8Array([1, 2, 3]);
    const fetch = vi.fn(async () => okResponse(payload));
    const storage = memoryStorage();
    const transport = createNativeCachingTransport({
      resolve,
      fetch,
      storage,
      baseUrl: "https://uoplan.party",
    });

    await expect(transport("catalogue.pb")).resolves.toEqual(payload);
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith("https://uoplan.party/assets/catalogue-abc123.pb");
    expect(storage.map.size).toBe(1);
  });

  it("serves a warm immutable cache from disk WITHOUT hitting the network (offline-capable)", async () => {
    const payload = new Uint8Array([9, 9, 9]);
    const fetch = vi.fn(async () => okResponse(payload));
    const storage = memoryStorage();
    const transport = createNativeCachingTransport({ resolve, fetch, storage });

    await transport("catalogue.pb"); // warms the cache
    fetch.mockClear();

    await expect(transport("catalogue.pb")).resolves.toEqual(payload);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("falls back to the cached bytes when the network fails after a prior load", async () => {
    const payload = new Uint8Array([4, 5, 6]);
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(okResponse(payload))
      .mockRejectedValue(new Error("offline"));
    const storage = memoryStorage();
    const onOfflineFallback = vi.fn();
    // immutableUrls:false forces a revalidation attempt so the fallback path runs.
    const transport = createNativeCachingTransport({
      resolve,
      fetch,
      storage,
      immutableUrls: false,
      onOfflineFallback,
    });

    await transport("catalogue.pb"); // populate cache
    await expect(transport("catalogue.pb")).resolves.toEqual(payload);
    expect(onOfflineFallback).toHaveBeenCalledOnce();
  });

  it("rejects when offline with a cold cache (cannot work offline before first load)", async () => {
    const fetch = vi.fn(async () => {
      throw new Error("offline");
    });
    const transport = createNativeCachingTransport({ resolve, fetch, storage: memoryStorage() });

    await expect(transport("catalogue.pb")).rejects.toThrow("offline");
  });

  it("revalidates over the network every call when immutableUrls is false", async () => {
    const payload = new Uint8Array([7]);
    const fetch = vi.fn(async () => okResponse(payload));
    const storage = memoryStorage();
    const transport = createNativeCachingTransport({
      resolve,
      fetch,
      storage,
      immutableUrls: false,
    });

    await transport("catalogue.pb");
    await transport("catalogue.pb");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("rejects unknown asset ids without fetching or caching", async () => {
    const fetch = vi.fn();
    const storage = memoryStorage();
    const transport = createNativeCachingTransport({ resolve, fetch, storage });

    await expect(transport("missing.pb")).rejects.toThrow("Unknown data asset: missing.pb");
    expect(fetch).not.toHaveBeenCalled();
    expect(storage.map.size).toBe(0);
  });

  it("still returns live bytes when the cache write fails", async () => {
    const payload = new Uint8Array([1]);
    const fetch = vi.fn(async () => okResponse(payload));
    const storage: CachedBytesStorage = {
      get: async () => null,
      set: async () => {
        throw new Error("disk full");
      },
    };
    const transport = createNativeCachingTransport({ resolve, fetch, storage });

    await expect(transport("catalogue.pb")).resolves.toEqual(payload);
  });
});
