import { describe, expect, it, vi } from "vitest";
import worker from "./index.js";
import type { Env } from "./index.js";

vi.mock("./ogImage.js", () => ({
  handleOgImage: vi.fn(),
}));

async function request(path: string): Promise<Response> {
  return worker.fetch(new Request(`https://uoplan.party${path}`), {} as Env);
}

describe("share route", () => {
  it("returns an HTML landing page that redirects browsers to the calendar state", async () => {
    const res = await request("/api/share/QUJD-18");
    const html = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get("Location")).toBeNull();
    expect(res.headers.get("Content-Type")).toContain("text/html");
    expect(html).toContain('window.location.replace("/schedule/calendar/?s=QUJD%2B18%3D")');
    expect(html).toContain('content="https://uoplan.party/api/og-image/QUJD-18"');
    expect(html).toContain('content="https://uoplan.party/api/share/QUJD-18"');
  });

  it("forwards the optional schedule payload only to the OG image", async () => {
    const res = await request("/api/share/QUJD-18?p=preview%2F%2B%3D");
    const html = await res.text();

    expect(res.status).toBe(200);
    expect(html).toContain(
      'content="https://uoplan.party/api/og-image/QUJD-18?p=preview%2F%2B%3D"',
    );
    expect(html).toContain('window.location.replace("/schedule/calendar/?s=QUJD%2B18%3D")');
    expect(html).not.toContain("/schedule/calendar/?s=QUJD%2B18%3D&p=");
  });

  it("does not validate an invalid schedule payload on the share page", async () => {
    const res = await request("/api/share/QUJD-18?p=not-a-protobuf");
    const html = await res.text();

    expect(res.status).toBe(200);
    expect(html).toContain('content="https://uoplan.party/api/og-image/QUJD-18?p=not-a-protobuf"');
    expect(html).toContain('window.location.replace("/schedule/calendar/?s=QUJD%2B18%3D")');
  });
});
