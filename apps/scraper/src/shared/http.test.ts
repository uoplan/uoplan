import { afterEach, describe, expect, it, vi } from "vitest";
import { BotChallengeError } from "./errors.ts";
import { fetchHtml } from "./http.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchHtml bot challenges", () => {
  it("throws BotChallengeError on an AWS WAF challenge response", async () => {
    const fetchMock = vi.fn(
      async () => new Response("", { status: 202, headers: { "x-amzn-waf-action": "challenge" } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchHtml("https://example.test/waf")).rejects.toBeInstanceOf(BotChallengeError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("treats an empty 2xx body as a challenge, not as an empty page", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 200 })),
    );
    await expect(fetchHtml("https://example.test/empty")).rejects.toBeInstanceOf(BotChallengeError);
  });

  it("returns the body of a normal response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<p>hi</p>", { status: 200 })),
    );
    await expect(fetchHtml("https://example.test/ok")).resolves.toBe("<p>hi</p>");
  });
});
