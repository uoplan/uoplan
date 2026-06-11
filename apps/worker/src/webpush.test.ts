import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendPushNotification } from "./webpush.js";

function bytes(values: number[]): ArrayBuffer {
  return new Uint8Array(values).buffer;
}

beforeEach(() => {
  vi.stubGlobal("crypto", {
    subtle: {
      importKey: vi.fn(async () => ({ type: "secret" })),
      deriveBits: vi.fn(async (_algorithm: object, _key: unknown, length: number) =>
        bytes(Array.from({ length: length / 8 }, (_, index) => index + 1)),
      ),
      sign: vi.fn(async () => bytes([9, 9, 9])),
      generateKey: vi.fn(async () => ({
        publicKey: { type: "public" },
        privateKey: { type: "private" },
      })),
      exportKey: vi.fn(async () => bytes(Array.from({ length: 65 }, (_, index) => index))),
      encrypt: vi.fn(async () => bytes([5, 6, 7, 8])),
    },
    getRandomValues: vi.fn((array: Uint8Array) => {
      array.fill(7);
      return array;
    }),
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(null, { status: 201 })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sendPushNotification", () => {
  it("encrypts the payload and posts it to the subscription endpoint with VAPID headers", async () => {
    await sendPushNotification(
      { endpoint: "https://push.example/send/abc", keys: { p256dh: "AQID", auth: "BAUG" } },
      JSON.stringify({ title: "New term", body: "Fall is live", url: "https://uoplan.party" }),
      "mailto:admin@uoplan.party",
      "BQoLDA",
      "private-key",
    );

    expect(fetch).toHaveBeenCalledWith(
      "https://push.example/send/abc",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/octet-stream",
          "Content-Encoding": "aes128gcm",
          TTL: "60",
          Authorization: expect.stringMatching(/^vapid t=.+,k=BQoLDA$/),
        }),
        body: expect.any(Uint8Array),
      }),
    );
  });

  it("throws an error with statusCode when the push service rejects the request", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response("expired", { status: 410 }));

    await expect(
      sendPushNotification(
        { endpoint: "https://push.example/send/expired", keys: { p256dh: "AQID", auth: "BAUG" } },
        "{}",
        "mailto:admin@uoplan.party",
        "BQoLDA",
        "private-key",
      ),
    ).rejects.toMatchObject({ statusCode: 410, message: "Push service responded 410: expired" });
  });
});
