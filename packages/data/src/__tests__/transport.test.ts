import { describe, expect, it, vi } from "vitest";
import { createFetchBytesTransport } from "../transport";

describe("createFetchBytesTransport", () => {
  it("resolves an asset id, applies the base URL, fetches it, and returns bytes", async () => {
    const payload = new Uint8Array([1, 2, 3]);
    const fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      arrayBuffer: async () => payload.buffer,
    }));
    const transport = createFetchBytesTransport({
      resolve: (id) => (id === "terms.pb" ? "/assets/terms.abc123.pb" : undefined),
      fetch,
      baseUrl: "https://cdn.example",
    });

    await expect(transport("terms.pb")).resolves.toEqual(payload);
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith("https://cdn.example/assets/terms.abc123.pb");
  });

  it("rejects unknown asset ids without calling fetch", async () => {
    const fetch = vi.fn();
    const transport = createFetchBytesTransport({ resolve: () => undefined, fetch });

    await expect(transport("missing.pb")).rejects.toThrow("Unknown data asset: missing.pb");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects unsuccessful HTTP responses with the asset id, resolved URL, and status", async () => {
    const fetch = vi.fn(async () => ({
      ok: false,
      status: 503,
      arrayBuffer: async () => new ArrayBuffer(0),
    }));
    const transport = createFetchBytesTransport({
      resolve: () => "/assets/catalogue.pb",
      fetch,
    });

    await expect(transport("catalogue.pb")).rejects.toThrow(
      "Failed to load catalogue.pb (/assets/catalogue.pb): HTTP 503",
    );
  });
});
