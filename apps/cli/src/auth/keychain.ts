import { execSync } from "node:child_process";

const SERVICE = "uoplan";
const ACCOUNT = "session";

export interface SessionCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
}

export interface StoredSession {
  cookies: SessionCookie[];
  savedAt: number;
}

export function getSession(): StoredSession | null {
  try {
    const raw = execSync(`security find-generic-password -a ${ACCOUNT} -s ${SERVICE} -w`, {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

export function setSession(session: StoredSession): void {
  const json = JSON.stringify(session).replace(/'/g, "'\\''");
  try {
    execSync(`security delete-generic-password -a ${ACCOUNT} -s ${SERVICE}`, {
      stdio: "ignore",
    });
  } catch {
    // Didn't exist — fine.
  }
  execSync(`security add-generic-password -a ${ACCOUNT} -s ${SERVICE} -w '${json}'`, {
    stdio: "ignore",
  });
}

export function deleteSession(): void {
  try {
    execSync(`security delete-generic-password -a ${ACCOUNT} -s ${SERVICE}`, {
      stdio: "ignore",
    });
  } catch {
    // Already gone.
  }
}
