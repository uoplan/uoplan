/**
 * Interactive authentication for the uoZone S-Reports portal.
 *
 * Launches the user's *native* Chrome via Playwright (channel: "chrome"), opens the
 * S-Reports app, and waits for the user to complete the uOttawa / Microsoft login.
 * Once the browser lands back on the authenticated uozone2 app, the session cookies
 * are captured, persisted to the macOS Keychain, and returned as a ready-to-use
 * `got` client (cookies replayed via tough-cookie).
 *
 * Local/dev only — never run in CI.
 */

import { type Got, got } from "got";
import fs from "node:fs/promises";
import path from "node:path";
import { type Browser, type BrowserContext, chromium } from "playwright";
import { CookieJar } from "tough-cookie";
import { getErrorMessage } from "../shared/errors.ts";
import { loadSession, saveSession, type StoredCookie, type StoredSession } from "./keychain.ts";

export const S_REPORTS_URL = "https://uozone2.uottawa.ca/en/apps/s-reports";

/**
 * Desktop User-Agent used for every non-interactive request. The portal's WAF
 * blocks the default `HeadlessChrome` UA, so both the `got` client and the
 * Playwright contexts must present a normal desktop UA.
 */
const DESKTOP_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0 Safari/537.36";

/** Hostnames that indicate the user is still mid-login (not yet authenticated). */
const LOGIN_HOST_PATTERNS = [
  "login.microsoftonline.com",
  "login.live.com",
  "idp.uottawa.ca",
  "adfs",
  "auth",
];

const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;
const POLL_INTERVAL_MS = 750;

function urlLooksLikeApp(url: string): boolean {
  if (!url.includes("uozone2.uottawa.ca")) return false;
  if (LOGIN_HOST_PATTERNS.some((p) => url.includes(p))) return false;
  return url.toLowerCase().includes("s-reports");
}

interface PlaywrightCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
}

function toStoredCookies(cookies: PlaywrightCookie[]): StoredCookie[] {
  return cookies.map((c) => ({
    name: c.name,
    value: c.value,
    domain: c.domain,
    path: c.path,
    expires: c.expires,
    httpOnly: c.httpOnly,
    secure: c.secure,
  }));
}

/**
 * Decide whether a settled app page is authenticated, without assuming the exact
 * listing markup (we verify that separately during exploration). A page counts as
 * authenticated when it is on the S-Reports app host (not a login host) and shows no
 * password field. Callers additionally require the URL to be *stable* across polls so
 * we don't capture the brief pre-redirect page.
 */
async function appPageIsAuthenticated(context: BrowserContext): Promise<boolean> {
  for (const page of context.pages()) {
    if (!urlLooksLikeApp(page.url())) continue;
    try {
      const hasPasswordField = (await page.locator('input[type="password"]').count()) > 0;
      if (!hasPasswordField) return true;
    } catch {
      // Page may be mid-navigation; try again on the next poll.
    }
  }
  return false;
}

function currentAppUrl(context: BrowserContext): string | null {
  for (const page of context.pages()) {
    if (urlLooksLikeApp(page.url())) return page.url();
  }
  return null;
}

async function waitForLogin(context: BrowserContext): Promise<void> {
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(S_REPORTS_URL, { waitUntil: "domcontentloaded" }).catch(() => {
    // Navigation may be interrupted by the auth redirect; ignore and poll instead.
  });

  console.log("\nA Chrome window has opened. Please sign in to uoZone.");
  console.log("Waiting for the S-Reports app to load after login (up to 5 minutes)...\n");

  const deadline = Date.now() + LOGIN_TIMEOUT_MS;
  let stableUrl: string | null = null;
  let stableCount = 0;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const appUrl = currentAppUrl(context);
    if (!appUrl) {
      stableUrl = null;
      stableCount = 0;
      continue;
    }
    // Require the app URL to settle (unchanged across polls) so we skip the brief
    // pre-redirect page that immediately bounces to the login provider.
    if (appUrl === stableUrl) {
      stableCount += 1;
    } else {
      stableUrl = appUrl;
      stableCount = 1;
    }
    if (stableCount >= 3 && (await appPageIsAuthenticated(context))) {
      await new Promise((r) => setTimeout(r, 1000));
      return;
    }
  }
  throw new Error(
    "Timed out waiting for the S-Reports app to load. Make sure you completed the " +
      "uoZone login and that the S-Reports page finished loading.",
  );
}

/**
 * Open native Chrome, let the user log in, capture cookies, and persist to Keychain.
 * Returns the captured session.
 */
export async function loginInteractive(): Promise<StoredSession> {
  let context: BrowserContext;
  try {
    context = await chromium.launchPersistentContext("", {
      channel: "chrome",
      headless: false,
      viewport: null,
      args: ["--disable-blink-features=AutomationControlled"],
    });
  } catch (err) {
    throw new Error(
      `Could not launch native Chrome via Playwright (channel "chrome"). ` +
        `Make sure Google Chrome is installed. Original error: ${getErrorMessage(err)}`,
    );
  }

  try {
    await waitForLogin(context);

    // Snapshot the authenticated landing page so we can inspect the real markup
    // during the exploration phase (cached, gitignored).
    try {
      const appUrl = currentAppUrl(context);
      const appPage = context.pages().find((p) => urlLooksLikeApp(p.url()));
      if (appPage) {
        const html = await appPage.content();
        const cacheDir = path.join(".cache", "feedback");
        await fs.mkdir(cacheDir, { recursive: true });
        await fs.writeFile(path.join(cacheDir, "landing.html"), html, "utf-8");
        console.log(`Saved landing snapshot (${appUrl}) to .cache/feedback/landing.html`);
      }
    } catch {
      // Snapshot is best-effort; never block login on it.
    }

    const cookies = (await context.cookies()) as PlaywrightCookie[];
    const session: StoredSession = {
      cookies: toStoredCookies(cookies),
      savedAt: Date.now(),
    };
    await saveSession(session);
    console.log(`Captured ${session.cookies.length} cookies and saved to Keychain.`);
    return session;
  } finally {
    await context.close().catch(() => {});
  }
}

function buildCookieJar(session: StoredSession): CookieJar {
  const jar = new CookieJar();
  for (const c of session.cookies) {
    if (!c.domain) continue;
    const domain = c.domain.replace(/^\./, "");
    const scheme = c.secure ? "https" : "http";
    const url = `${scheme}://${domain}${c.path || "/"}`;
    const expiresAttr =
      c.expires && c.expires > 0 ? `; Expires=${new Date(c.expires * 1000).toUTCString()}` : "";
    const cookieStr =
      `${c.name}=${c.value}; Domain=${domain}; Path=${c.path || "/"}` +
      `${c.secure ? "; Secure" : ""}${c.httpOnly ? "; HttpOnly" : ""}${expiresAttr}`;
    try {
      jar.setCookieSync(cookieStr, url, { ignoreError: true });
    } catch {
      // Skip cookies tough-cookie rejects (e.g. malformed domains).
    }
  }
  return jar;
}

/** Build a `got` client that replays the stored session cookies. */
export function clientFromSession(session: StoredSession): Got {
  const jar = buildCookieJar(session);
  return got.extend({
    cookieJar: jar,
    followRedirect: true,
    https: { rejectUnauthorized: true },
    headers: {
      "User-Agent": DESKTOP_USER_AGENT,
    },
    retry: { limit: 2 },
  });
}

/**
 * Convert stored cookies to Playwright's cookie shape and launch a headless
 * Chromium context that replays them under a normal desktop UA. Used to drive the
 * Bluera report-list and report viewer (which `got` cannot, because of the SAML
 * auto-POST), while still passing the WAF.
 *
 * Caller owns the returned browser/context and must close them.
 */
export async function browserContextFromSession(
  session: StoredSession,
): Promise<{ browser: Browser; context: BrowserContext }> {
  const browser = await chromium.launch({ headless: true });
  const context = await newAuthedContext(browser, session);
  return { browser, context };
}

/** Launch a headless Chromium (normal-UA contexts are created per caller). */
export async function launchBrowser(): Promise<{ browser: Browser }> {
  const browser = await chromium.launch({ headless: true });
  return { browser };
}

/**
 * Create a fresh cookie-authenticated context on an existing browser. Each context
 * is an isolated session, which is required when fetching several terms in parallel:
 * sharing one context lets concurrent ASP.NET postbacks clobber each other's state.
 */
export async function newAuthedContext(
  browser: Browser,
  session: StoredSession,
): Promise<BrowserContext> {
  const context = await browser.newContext({ userAgent: DESKTOP_USER_AGENT });
  const cookies = session.cookies
    .filter((c) => c.domain)
    .map((c) => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path || "/",
      expires: c.expires && c.expires > 0 ? c.expires : -1,
      httpOnly: c.httpOnly,
      secure: c.secure,
    }));
  await context.addCookies(cookies);
  return context;
}

/**
 * Verify a session still works by fetching the S-Reports landing page and checking
 * we weren't bounced to a login screen.
 */
export async function sessionIsValid(session: StoredSession): Promise<boolean> {
  const client = clientFromSession(session);
  try {
    const res = await client.get(S_REPORTS_URL, { followRedirect: true });
    const finalUrl = res.url ?? S_REPORTS_URL;
    if (!urlLooksLikeApp(finalUrl)) return false;
    // A logged-out portal redirects to / serves a Microsoft sign-in prompt.
    const body = res.body.toLowerCase();
    if (body.includes('type="password"')) return false;
    if (body.includes("sign in") && body.includes("microsoft")) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Get an authenticated `got` client: reuse the stored Keychain session if it still
 * works, otherwise launch the interactive login.
 */
export async function getAuthenticatedClient(
  options: { forceLogin?: boolean } = {},
): Promise<{ client: Got; session: StoredSession }> {
  if (!options.forceLogin) {
    const stored = await loadSession();
    if (stored && (await sessionIsValid(stored))) {
      return { client: clientFromSession(stored), session: stored };
    }
  }
  const session = await loginInteractive();
  if (!(await sessionIsValid(session))) {
    throw new Error(
      "Captured a session but it does not appear authenticated. " +
        "Make sure you completed the uoZone login before the window closed.",
    );
  }
  return { client: clientFromSession(session), session };
}
