import { describe, it, expect, vi, beforeEach } from "vitest";
import { snipe } from "./sniper.ts";

vi.mock("../../api/enrollment.ts", () => ({
  CART_ACTIONS: { enrol: "ENROL_ACTION" },
  submitCartAction: vi.fn(),
}));

import { submitCartAction } from "../../api/enrollment.ts";

const mockClient = {} as any;
const mockCartUrl = "https://example.com/cart";
const mockButnums = [1, 2];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("snipe", () => {
  it("returns success immediately when first attempt has no errors", async () => {
    vi.mocked(submitCartAction).mockResolvedValue({ html: "", errors: [] });

    const targetMs = Date.now() - 100;
    const result = await snipe(mockClient, mockCartUrl, mockButnums, targetMs, 0, 10, 5_000);

    expect(result.success).toBe(true);
    expect(submitCartAction).toHaveBeenCalledTimes(1);
  });

  it("retries until success", async () => {
    vi.mocked(submitCartAction)
      .mockResolvedValueOnce({ html: "", errors: ["Not open yet"] })
      .mockResolvedValueOnce({ html: "", errors: ["Not open yet"] })
      .mockResolvedValue({ html: "", errors: [] });

    const targetMs = Date.now() - 100;
    const result = await snipe(mockClient, mockCartUrl, mockButnums, targetMs, 0, 10, 5_000);

    expect(result.success).toBe(true);
    expect(submitCartAction).toHaveBeenCalledTimes(3);
  });

  it("times out after timeoutAfterMs and returns failure", async () => {
    vi.mocked(submitCartAction).mockResolvedValue({ html: "", errors: ["Enrollment closed"] });

    const targetMs = Date.now() - 200;
    const result = await snipe(mockClient, mockCartUrl, mockButnums, targetMs, 0, 10, 100);

    expect(result.success).toBe(false);
    expect(result.errors).toContain("Enrollment closed");
  });

  it("returns the last errors seen on timeout", async () => {
    vi.mocked(submitCartAction).mockResolvedValue({ html: "", errors: ["Section full"] });

    const targetMs = Date.now() - 200;
    const result = await snipe(mockClient, mockCartUrl, mockButnums, targetMs, 0, 10, 100);

    expect(result.errors).toEqual(["Section full"]);
  });
});
