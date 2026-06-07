/**
 * Persist the uoZone S-Reports session (cookies) in the macOS Keychain so the
 * scraper can be re-run repeatedly against the live portal without re-logging-in.
 *
 * Mirrors the approach in apps/cli (service "uoplan", account "session"); here we
 * use a dedicated service so the two never collide.
 *
 * macOS-only (uses the `security` CLI). No native dependency.
 */

import { spawn } from "node:child_process";
import { getErrorMessage } from "../shared/errors.ts";

const SERVICE = "uoplan-feedback";
const ACCOUNT = "uozone";

export interface StoredCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  /** Unix seconds; -1 for session cookies. */
  expires: number;
  httpOnly: boolean;
  secure: boolean;
}

export interface StoredSession {
  cookies: StoredCookie[];
  savedAt: number;
}

function run(
  command: string,
  args: string[],
  stdin?: string,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? -1, stdout, stderr }));
    if (stdin !== undefined) {
      child.stdin.write(stdin);
    }
    child.stdin.end();
  });
}

function assertMacOS(): void {
  if (process.platform !== "darwin") {
    throw new Error(
      `Keychain session storage is macOS-only (platform: ${process.platform}). ` +
        `Run the feedback scraper on macOS, or extend keychain.ts for your OS.`,
    );
  }
}

export async function saveSession(session: StoredSession): Promise<void> {
  assertMacOS();
  const payload = JSON.stringify(session);
  // `security add-generic-password -w` (no value) prompts the TTY rather than reading
  // stdin, so the secret must be passed as the argument value. This is a local-only
  // dev tool and the data is session cookies (already sent over the network), so the
  // brief `ps` exposure of the argument is an acceptable tradeoff.
  // -U updates the item if it already exists.
  const { code, stderr } = await run("security", [
    "add-generic-password",
    "-a",
    ACCOUNT,
    "-s",
    SERVICE,
    "-U",
    "-w",
    payload,
  ]);
  if (code !== 0) {
    throw new Error(`Failed to store session in Keychain: ${stderr.trim() || `exit ${code}`}`);
  }
}

export async function loadSession(): Promise<StoredSession | null> {
  if (process.platform !== "darwin") return null;
  const { code, stdout } = await run("security", [
    "find-generic-password",
    "-a",
    ACCOUNT,
    "-s",
    SERVICE,
    "-w",
  ]);
  if (code !== 0) return null;
  try {
    const parsed = JSON.parse(stdout.trim()) as StoredSession;
    if (!parsed || !Array.isArray(parsed.cookies)) return null;
    return parsed;
  } catch (err) {
    console.warn(`Stored session is corrupt, ignoring: ${getErrorMessage(err)}`);
    return null;
  }
}

export async function deleteSession(): Promise<void> {
  if (process.platform !== "darwin") return;
  await run("security", ["delete-generic-password", "-a", ACCOUNT, "-s", SERVICE]);
}
