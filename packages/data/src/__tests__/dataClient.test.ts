import { describe, expect, it, vi } from "vitest";
import { createDataClient } from "../dataClient";
import { optional } from "../transport";

describe("createDataClient.fetchBytes", () => {
  it("memoizes successful fetches per path", async () => {
    const transport = vi.fn(async (path: string) => new Uint8Array([path.length]));
    const client = createDataClient({ transport });

    const a = await client.fetchBytes("/data/x.pb");
    const b = await client.fetchBytes("/data/x.pb");

    expect(transport).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
  });

  it("does not memoize rejected fetches (retryable)", async () => {
    let calls = 0;
    const transport = vi.fn(async () => {
      calls += 1;
      if (calls === 1) throw new Error("transient");
      return new Uint8Array([1]);
    });
    const client = createDataClient({ transport });

    await expect(client.fetchBytes("/data/x.pb")).rejects.toThrow("transient");
    const bytes = await client.fetchBytes("/data/x.pb");

    expect(transport).toHaveBeenCalledTimes(2);
    expect(bytes).toEqual(new Uint8Array([1]));
  });

  it("clear() drops the byte memo", async () => {
    const transport = vi.fn(async () => new Uint8Array([1]));
    const client = createDataClient({ transport });

    await client.fetchBytes("/data/x.pb");
    client.clear();
    await client.fetchBytes("/data/x.pb");

    expect(transport).toHaveBeenCalledTimes(2);
  });
});

describe("optional", () => {
  it("returns null when the transport rejects", async () => {
    const result = await optional(async () => {
      throw new Error("missing");
    }, "/data/x.pb");
    expect(result).toBeNull();
  });

  it("returns bytes when the transport resolves", async () => {
    const result = await optional(async () => new Uint8Array([7]), "/data/x.pb");
    expect(result).toEqual(new Uint8Array([7]));
  });
});
