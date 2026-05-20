import ora from "ora";
import { submitCartAction, CART_ACTIONS } from "../../api/enrollment.ts";
import type { PeopleSoftClient } from "../../api/client.ts";

export async function snipe(
  client: PeopleSoftClient,
  cartUrl: string,
  butnums: number[],
  targetMs: number,
  leadMs = 5_000,
  retryIntervalMs = 500,
  timeoutAfterMs = 120_000,
): Promise<{ success: boolean; errors: string[] }> {
  const startMs = targetMs - leadMs;
  const now = Date.now();

  if (startMs > now) {
    await new Promise((resolve) => setTimeout(resolve, startMs - now));
  }

  const deadline = targetMs + timeoutAfterMs;
  let attempt = 0;
  let lastErrors: string[] = [];
  const spinner = ora("Attempt 1 — waiting for enrolment to open…").start();

  do {
    attempt++;
    spinner.text = `Attempt ${attempt} — submitting enrolment…`;

    try {
      const { errors } = await submitCartAction(client, cartUrl, butnums, CART_ACTIONS.enrol);
      if (errors.length === 0) {
        spinner.succeed(`Enrolled after ${attempt} attempt${attempt === 1 ? "" : "s"}.`);
        return { success: true, errors: [] };
      }
      lastErrors = errors;
    } catch {
      // Network hiccup — keep retrying until timeout
    }

    if (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, retryIntervalMs));
    }
  } while (Date.now() < deadline);

  spinner.fail(`Timed out after ${attempt} attempt${attempt === 1 ? "" : "s"}.`);
  return { success: false, errors: lastErrors };
}
