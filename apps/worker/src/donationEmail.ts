import PostalMime from "postal-mime";
import type { Env } from "./index.js";
import { TOTAL_CENTS_KEY } from "./donations.js";

interface ForwardableEmailMessage {
  readonly from: string;
  readonly to: string;
  readonly headers: Headers;
  readonly raw: ReadableStream<Uint8Array>;
  readonly rawSize: number;
  setReject(reason: string): void;
  forward(rcptTo: string, headers?: Headers): Promise<void>;
}

const INTERAC_SENDERS = ["payments.interac.ca", "interac.ca"];

interface ParsedDonation {
  amountCents: number;
  currency: string;
  senderName: string | null;
  message: string | null;
}

/**
 * Parse a dollar amount out of an Interac deposit notification. Handles the
 * English ("$1,234.56") and Canadian-French ("1 234,56 $") money formats.
 * Returns integer cents, or null when no amount can be confidently extracted.
 */
function parseAmountCents(text: string): number | null {
  const english = text.match(/\$\s*([\d,]+\.\d{2})\b/);
  if (english) {
    const normalized = english[1].replaceAll(",", "");
    const value = Number.parseFloat(normalized);
    if (Number.isFinite(value)) return Math.round(value * 100);
  }

  const french = text.match(/(\d[\d\s.\u00a0]*,\d{2})\s*\$/);
  if (french) {
    const normalized = french[1].replaceAll(/[\s.\u00a0]/g, "").replace(",", ".");
    const value = Number.parseFloat(normalized);
    if (Number.isFinite(value)) return Math.round(value * 100);
  }

  return null;
}

function parseSenderName(subject: string, body: string): string | null {
  const fromSubject = subject.match(/from\s+(.+?)\s+has been/i);
  if (fromSubject) return fromSubject[1].trim();
  const fromBody = body.match(/^(.+?)\s+has sent you/im);
  if (fromBody) return fromBody[1].trim();
  return null;
}

function parseMessage(body: string): string | null {
  const match = body.match(/(?:Message|Message from sender|Message du destinateur)\s*:\s*(.+)/i);
  return match ? match[1].trim() : null;
}

function isInteracSender(from: string): boolean {
  const domain = from.split("@")[1]?.toLowerCase() ?? "";
  return INTERAC_SENDERS.some((d) => domain === d || domain.endsWith(`.${d}`));
}

async function readRaw(message: ForwardableEmailMessage): Promise<ArrayBuffer> {
  return new Response(message.raw).arrayBuffer();
}

export async function handleDonationEmail(
  message: ForwardableEmailMessage,
  env: Env,
): Promise<void> {
  try {
    await inspectDonation(message, env);
  } catch (err) {
    // oxlint-disable-next-line no-console -- intentional Worker email inspection logging
    console.error("Failed to inspect donation email from %s: %o", message.from, err);
  }

  // The worker only observes the message; Email Routing does not continue on its
  // own once a worker handles mail, so we explicitly forward every message to
  // the configured inbox. This runs even when inspection above fails so no email
  // is ever lost.
  try {
    await message.forward(env.FORWARD_EMAIL);
  } catch (err) {
    // oxlint-disable-next-line no-console -- intentional Worker email forwarding logging
    console.error(
      "Failed to forward email from %s to %s: %o",
      message.from,
      env.FORWARD_EMAIL,
      err,
    );
  }
}

async function inspectDonation(message: ForwardableEmailMessage, env: Env): Promise<void> {
  if (!isInteracSender(message.from)) return;

  const raw = await readRaw(message);
  const parsed = await PostalMime.parse(raw);
  const subject = parsed.subject ?? message.headers.get("subject") ?? "";
  const body = `${parsed.text ?? ""}\n${subject}`;

  const amountCents = parseAmountCents(body);
  if (amountCents === null || amountCents <= 0) {
    // oxlint-disable-next-line no-console -- intentional Worker donation parsing logging
    console.warn("No donation amount found in email; subject=%s", subject);
    return;
  }

  const messageId =
    parsed.messageId ?? message.headers.get("message-id") ?? `${message.from}:${subject}`;

  const donation: ParsedDonation = {
    amountCents,
    currency: env.DONATION_CURRENCY ?? "CAD",
    senderName: parseSenderName(subject, parsed.text ?? ""),
    message: parseMessage(parsed.text ?? ""),
  };

  const inserted = await env.DONATIONS_DB.prepare(
    `INSERT OR IGNORE INTO donations
       (amount_cents, currency, sender_name, sender_email, message, message_id, raw_subject)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      donation.amountCents,
      donation.currency,
      donation.senderName,
      message.from,
      donation.message,
      messageId,
      subject,
    )
    .run();

  // Only bump the cached total when a brand-new row was actually inserted, so
  // duplicate deliveries of the same Message-ID don't double-count.
  if (inserted.meta.changes > 0) {
    const row = await env.DONATIONS_DB.prepare(
      "SELECT COALESCE(SUM(amount_cents), 0) AS total FROM donations",
    ).first<{ total: number }>();
    await env.DONATIONS.put(TOTAL_CENTS_KEY, String(row?.total ?? donation.amountCents));
  }
}
