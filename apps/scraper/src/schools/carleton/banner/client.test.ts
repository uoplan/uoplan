import { describe, expect, it } from "vitest";

import { CarletonBannerClient } from "./client.ts";

describe("CarletonBannerClient", () => {
  it("serializes course search as a POST with repeated sentinel and real subject params", async () => {
    const requests: Array<{ url: string; init: RequestInit | undefined }> = [];
    const client = new CarletonBannerClient({
      delayMs: 0,
      fetchImpl: async (url, init) => {
        requests.push({
          url: url instanceof URL ? url.toString() : typeof url === "string" ? url : url.url,
          init,
        });
        return new Response("<html>ok</html>", { status: 200 });
      },
      searchForm: {
        action: "bwysched.p_course_search",
        hiddenFields: [
          ["wsea_code", "EXT"],
          ["term_code", "202630"],
          ["session_id", "26061541"],
          ["sel_subj", "dummy"],
          ["sel_begin_hh", "dummy"],
        ],
      },
    });

    await client.searchCourses({ term: "202630", sessionId: "26061541", subject: "COMP" });

    expect(requests).toHaveLength(1);
    expect(requests[0]!.url).toBe("https://central.carleton.ca/prod/bwysched.p_course_search");
    expect(requests[0]!.init?.method).toBe("POST");
    expect(requests[0]!.init?.headers).toMatchObject({
      "User-Agent": expect.stringContaining("uoplan"),
    });
    expect(
      requests[0]!.init?.body instanceof URLSearchParams ? requests[0]!.init.body.toString() : "",
    ).toBe(
      "wsea_code=EXT&term_code=202630&session_id=26061541&sel_subj=dummy&sel_begin_hh=dummy&sel_number=&sel_crn=&sel_subj=COMP",
    );
  });

  it("persists Banner load-balancer cookies across serialized requests", async () => {
    const seenCookies: Array<string | null> = [];
    const client = new CarletonBannerClient({
      delayMs: 0,
      fetchImpl: async (_url, init) => {
        const headers = new Headers(init?.headers);
        seenCookies.push(headers.get("Cookie"));
        return new Response("ok", {
          status: 200,
          headers: [["Set-Cookie", "BIGipServer=abc; Path=/; Secure"]],
        });
      },
    });

    await client.fetchSelectTerm();
    await client.fetchSubjects("202630");

    expect(seenCookies).toEqual([null, "BIGipServer=abc"]);
  });

  it("retries transient server errors with backoff", async () => {
    let calls = 0;
    const client = new CarletonBannerClient({
      delayMs: 0,
      backoffMs: 0,
      fetchImpl: async () => {
        calls += 1;
        return new Response(calls === 1 ? "bad" : "ok", { status: calls === 1 ? 503 : 200 });
      },
    });

    await expect(client.fetchSelectTerm()).resolves.toBe("ok");
    expect(calls).toBe(2);
  });
});
