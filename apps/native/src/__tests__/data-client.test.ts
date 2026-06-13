// In-memory expo-file-system mock: the new File/Directory/Paths class API backed
// by a Map, so the storage adapter's key→file mapping and exists/read/write logic
// can be exercised without the native module.
jest.mock("expo-file-system", () => {
  const store = new Map<string, Uint8Array | string>();
  class Paths {
    static get cache() {
      return { path: "cache" };
    }
  }
  class Directory {
    path: string;
    constructor(...parts: Array<{ path?: string } | string>) {
      this.path = parts
        .map((p) => (typeof p === "string" ? p : (p?.path ?? "")))
        .filter(Boolean)
        .join("/");
    }
    get exists() {
      return true;
    }
    create() {}
  }
  class File {
    key: string;
    constructor(dir: { path: string }, name: string) {
      this.key = `${dir.path}/${name}`;
    }
    get exists() {
      return store.has(this.key);
    }
    async bytes() {
      const v = store.get(this.key);
      if (!v) throw new Error("missing");
      return v;
    }
    async text() {
      const v = store.get(this.key);
      if (v == null) throw new Error("missing");
      return typeof v === "string" ? v : new TextDecoder().decode(v);
    }
    write(data: Uint8Array | string) {
      store.set(this.key, data);
    }
    delete() {
      store.delete(this.key);
    }
  }
  return { Paths, Directory, File, __store: store };
});

import { fileSystemStorage } from "@/data/file-system-storage";
import { createDataTransport } from "@/data/data-client";

describe("fileSystemStorage", () => {
  it("round-trips bytes by key", async () => {
    const bytes = new Uint8Array([10, 20, 30]);
    await fileSystemStorage.set("alpha", bytes);
    expect(await fileSystemStorage.get("alpha")).toEqual(bytes);
  });

  it("returns null for an absent key", async () => {
    expect(await fileSystemStorage.get("does-not-exist")).toBeNull();
  });

  it("overwrites an existing key", async () => {
    await fileSystemStorage.set("beta", new Uint8Array([1]));
    await fileSystemStorage.set("beta", new Uint8Array([2, 3]));
    expect(await fileSystemStorage.get("beta")).toEqual(new Uint8Array([2, 3]));
  });
});

describe("createDataTransport", () => {
  const original = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = original;
  });

  const IDENTITY = { headers: { "Accept-Encoding": "identity" } };

  // A URL-aware fetch: serves the published manifest JSON for /data/manifest.json
  // and the asset bytes for the content-hashed `.pb` URL it points at.
  function mockFetch(manifest: Record<string, string>, assetBytes: Uint8Array) {
    return jest.fn(async (url: string) => {
      if (url.endsWith("/data/manifest.json")) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify(manifest),
          arrayBuffer: async () => new ArrayBuffer(0),
        };
      }
      return {
        ok: true,
        status: 200,
        text: async () => "",
        arrayBuffer: async () => assetBytes.buffer.slice(0) as ArrayBuffer,
      };
    });
  }

  it("fetches the manifest then downloads the asset directly (identity-encoded)", async () => {
    const payload = new Uint8Array([1, 2, 3, 4]);
    const fetchMock = mockFetch({ "grades.pb": "/assets/grades-abc123.pb" }, payload);
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const transport = createDataTransport("https://example.test");
    const result = await transport("grades.pb");

    expect(result).toEqual(payload);
    expect(fetchMock).toHaveBeenCalledWith("https://example.test/data/manifest.json", IDENTITY);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.test/assets/grades-abc123.pb",
      IDENTITY,
    );
  });

  it("throws for an id the manifest does not list", async () => {
    globalThis.fetch = mockFetch(
      { "grades.pb": "/assets/grades-abc123.pb" },
      new Uint8Array([1]),
    ) as unknown as typeof fetch;

    const transport = createDataTransport("https://example.test");
    await expect(transport("missing.pb")).rejects.toThrow(/Unknown data asset/);
  });

  it("serves the cached copy when the network later fails (offline)", async () => {
    const payload = new Uint8Array([7, 7, 7]);
    const manifest = { "schedules.2265.pb": "/assets/schedules.2265-hash.pb" };
    globalThis.fetch = mockFetch(manifest, payload) as unknown as typeof fetch;

    const online = createDataTransport("https://example.test");
    await online("schedules.2265.pb"); // caches both the manifest text and the asset bytes

    // Network now fails: the transport must resolve via the cached manifest and
    // serve the cached asset bytes.
    globalThis.fetch = jest.fn(async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;

    const offline = createDataTransport("https://example.test");
    expect(await offline("schedules.2265.pb")).toEqual(payload);
  });
});
