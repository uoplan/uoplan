import { describe, expect, it, vi } from "vitest";
import worker from "./index.js";
import { handleOgImage } from "./ogImage.js";
import type { Env } from "./index.js";

vi.mock("./ogImage.js", () => ({
  handleOgImage: vi.fn(async () => new Response("png", { status: 202 })),
}));

describe("worker routing", () => {
  it("passes OG image route parameters, query payload, env, and request origin to the handler", async () => {
    const env = { ASSETS: { fetch: vi.fn() } } as unknown as Env;

    const res = await worker.fetch(
      new Request("https://preview.uoplan.party/api/og-image/share-state?p=preview-payload"),
      env,
    );

    expect(res.status).toBe(202);
    expect(await res.text()).toBe("png");
    expect(handleOgImage).toHaveBeenCalledWith(
      "share-state",
      "preview-payload",
      env,
      "https://preview.uoplan.party",
    );
  });
});
