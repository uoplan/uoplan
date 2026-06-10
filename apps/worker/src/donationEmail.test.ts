import { describe, expect, it, vi } from "vitest";
import { handleDonationEmail } from "./donationEmail.js";
import type { Env } from "./index.js";

type EmailMessage = Parameters<typeof handleDonationEmail>[0];

function rawStream(text: string): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(text);
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

function makeMessage(opts: { from: string; subject?: string; body?: string }): {
  message: EmailMessage;
  forward: ReturnType<typeof vi.fn>;
  setReject: ReturnType<typeof vi.fn>;
} {
  const subject = opts.subject ?? "Notice";
  const body = opts.body ?? "";
  const raw = [
    `From: ${opts.from}`,
    `To: donate@uoplan.party`,
    `Subject: ${subject}`,
    `Message-ID: <test-${Math.random()}@example.com>`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    body,
  ].join("\r\n");

  const forward = vi.fn(async () => {});
  const setReject = vi.fn();
  const message = {
    from: opts.from,
    to: "donate@uoplan.party",
    headers: new Headers({ subject, "message-id": "<id@example.com>" }),
    raw: rawStream(raw),
    rawSize: raw.length,
    setReject,
    forward,
  } as unknown as EmailMessage;

  return { message, forward, setReject };
}

function makeEnv(overrides?: { run?: () => unknown }): {
  env: Env;
  run: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
} {
  const run = vi.fn(overrides?.run ?? (async () => ({ meta: { changes: 1 } })));
  const first = vi.fn(async () => ({ total: 500 }));
  const put = vi.fn(async () => {});
  const prepare = vi.fn(() => ({
    bind: vi.fn(() => ({ run, first })),
    first,
  }));
  const env = {
    DONATIONS_DB: { prepare },
    DONATIONS: { put },
    DONATION_CURRENCY: "CAD",
    FORWARD_EMAIL: "matteoonthecoast@gmail.com",
  } as unknown as Env;
  return { env, run, put };
}

describe("handleDonationEmail", () => {
  it("records an Interac donation and forwards the email", async () => {
    const { message, forward, setReject } = makeMessage({
      from: "notify@payments.interac.ca",
      subject: "INTERAC e-Transfer: A deposit of $25.00 has been completed",
      body: "John Doe has sent you $25.00 (CAD).\nMessage: Thanks!",
    });
    const { env, run, put } = makeEnv();

    await handleDonationEmail(message, env);

    expect(run).toHaveBeenCalledTimes(1);
    expect(put).toHaveBeenCalledTimes(1);
    expect(setReject).not.toHaveBeenCalled();
    expect(forward).toHaveBeenCalledWith("matteoonthecoast@gmail.com");
  });

  it("forwards non-Interac email without rejecting or recording a donation", async () => {
    const { message, forward, setReject } = makeMessage({
      from: "friend@gmail.com",
      subject: "hello",
      body: "just saying hi, here is $10.00",
    });
    const { env, run, put } = makeEnv();

    await handleDonationEmail(message, env);

    expect(setReject).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
    expect(forward).toHaveBeenCalledWith("matteoonthecoast@gmail.com");
  });

  it("still forwards when the donation DB write throws", async () => {
    const { message, forward } = makeMessage({
      from: "notify@payments.interac.ca",
      subject: "INTERAC e-Transfer: A deposit of $25.00 has been completed",
      body: "John Doe has sent you $25.00 (CAD).",
    });
    const { env } = makeEnv({
      run: () => {
        throw new Error("db down");
      },
    });

    await handleDonationEmail(message, env);

    expect(forward).toHaveBeenCalledWith("matteoonthecoast@gmail.com");
  });
});
