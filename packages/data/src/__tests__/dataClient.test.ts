import { describe, expect, it, vi } from "vitest";
import { DataProto } from "@uoplan/core";
import { createDataClient } from "../dataClient";
import { optional } from "../transport";
import { encode } from "./testFixtures";

describe("createDataClient.fetchBytes", () => {
  it("memoizes successful fetches per path", async () => {
    const transport = vi.fn(async (path: string) => new Uint8Array([path.length]));
    const client = createDataClient({ transport });

    const a = await client.fetchBytes("terms.pb");
    const b = await client.fetchBytes("terms.pb");

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

    await expect(client.fetchBytes("terms.pb")).rejects.toThrow("transient");
    const bytes = await client.fetchBytes("terms.pb");

    expect(transport).toHaveBeenCalledTimes(2);
    expect(bytes).toEqual(new Uint8Array([1]));
  });

  it("clear() drops the byte memo", async () => {
    const transport = vi.fn(async () => new Uint8Array([1]));
    const client = createDataClient({ transport });

    await client.fetchBytes("terms.pb");
    client.clear();
    await client.fetchBytes("terms.pb");

    expect(transport).toHaveBeenCalledTimes(2);
  });
});

describe("createDataClient.load", () => {
  it("decodes once and memoizes the decoded message per id", async () => {
    const transport = vi.fn(async () => new Uint8Array([1, 2, 3]));
    const decode = vi.fn((bytes: Uint8Array) => ({ length: bytes.length }));
    const client = createDataClient({ transport });

    const a = await client.load({ decode }, "terms.pb");
    const b = await client.load({ decode }, "terms.pb");

    expect(transport).toHaveBeenCalledTimes(1);
    expect(decode).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
    expect(a).toEqual({ length: 3 });
  });

  it("does not memoize a failed decode (retryable)", async () => {
    const transport = vi.fn(async () => new Uint8Array([1]));
    let calls = 0;
    const decode = vi.fn(() => {
      calls += 1;
      if (calls === 1) throw new Error("bad wire");
      return { ok: true };
    });
    const client = createDataClient({ transport });

    await expect(client.load({ decode }, "terms.pb")).rejects.toThrow("bad wire");
    await expect(client.load({ decode }, "terms.pb")).resolves.toEqual({ ok: true });
    expect(decode).toHaveBeenCalledTimes(2);
  });
});

describe("optional", () => {
  it("returns null when the transport rejects", async () => {
    const result = await optional(async () => {
      throw new Error("missing");
    }, "terms.pb");
    expect(result).toBeNull();
  });

  it("returns bytes when the transport resolves", async () => {
    const result = await optional(async () => new Uint8Array([7]), "terms.pb");
    expect(result).toEqual(new Uint8Array([7]));
  });
});

describe("createDataClient.loadCourseDescription", () => {
  function shardBytes(courseCodes: string[], descriptions: string[]): Uint8Array {
    return encode(DataProto.CourseDescriptionShard.encode({ courseCodes, descriptions }));
  }

  const scienceAsset = "catalogue.descriptions.science.pb";
  const scienceBytes = shardBytes(
    ["PHY 1321", "BIO 1130"],
    ["University Physics I", "Introduction to Biology"],
  );

  it("first science call fetches only the science asset", async () => {
    const transport = vi.fn(async (id: string) => {
      if (id === scienceAsset) return scienceBytes;
      throw new Error(`unexpected fetch: ${id}`);
    });
    const client = createDataClient({ transport });

    const desc = await client.loadCourseDescription("science", "PHY 1321");

    expect(transport).toHaveBeenCalledTimes(1);
    expect(transport).toHaveBeenCalledWith(scienceAsset);
    expect(desc).toBe("University Physics I");
  });

  it("second same-shard course reuses decoded map (one transport call)", async () => {
    const transport = vi.fn(async () => scienceBytes);
    const client = createDataClient({ transport });

    await client.loadCourseDescription("science", "PHY 1321");
    const desc2 = await client.loadCourseDescription("science", "BIO 1130");

    expect(transport).toHaveBeenCalledTimes(1);
    expect(desc2).toBe("Introduction to Biology");
  });

  it("absent code returns undefined", async () => {
    const transport = vi.fn(async () => scienceBytes);
    const client = createDataClient({ transport });

    const desc = await client.loadCourseDescription("science", "CSI 9999");

    expect(desc).toBeUndefined();
  });

  it("rejected transport propagates", async () => {
    const transport = vi.fn(async () => {
      throw new Error("net error");
    });
    const client = createDataClient({ transport });

    await expect(client.loadCourseDescription("science", "PHY 1321")).rejects.toThrow("net error");
  });

  it("retry after rejection calls transport again and succeeds", async () => {
    let calls = 0;
    const transport = vi.fn(async () => {
      calls += 1;
      if (calls === 1) throw new Error("transient");
      return scienceBytes;
    });
    const client = createDataClient({ transport });

    await expect(client.loadCourseDescription("science", "PHY 1321")).rejects.toThrow("transient");
    const desc = await client.loadCourseDescription("science", "PHY 1321");

    expect(transport).toHaveBeenCalledTimes(2);
    expect(desc).toBe("University Physics I");
  });

  it("clear() causes refetch", async () => {
    const transport = vi.fn(async () => scienceBytes);
    const client = createDataClient({ transport });

    await client.loadCourseDescription("science", "PHY 1321");
    client.clear();
    await client.loadCourseDescription("science", "PHY 1321");

    expect(transport).toHaveBeenCalledTimes(2);
  });

  it("null shardId falls back to the 'other' shard", async () => {
    const otherBytes = shardBytes(["MAT 1320"], ["Calculus I"]);
    const transport = vi.fn(async (id: string) => {
      if (id === "catalogue.descriptions.other.pb") return otherBytes;
      throw new Error(`unexpected: ${id}`);
    });
    const client = createDataClient({ transport });

    const desc = await client.loadCourseDescription(null, "MAT 1320");

    expect(transport).toHaveBeenCalledWith("catalogue.descriptions.other.pb");
    expect(desc).toBe("Calculus I");
  });
});
