import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, rmSync } from "node:fs";
import CDP from "chrome-remote-interface";
import type { StoredSession } from "./keychain.ts";

const PEOPLESOFT_URL =
  "https://www.uocampus.uottawa.ca/psp/csprpr9www/EMPLOYEE/SA/c/SA_LEARNER_SERVICES.SSR_SSENRL_LIST.GBL?languageCd=ENG";

const CHROME_PATHS = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
];

function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      server.close(() => {
        if (addr && typeof addr === "object") resolve(addr.port);
        else reject(new Error("Could not determine a free port"));
      });
    });
  });
}

export async function launchBrowserAuth(): Promise<StoredSession> {
  const chromePath = CHROME_PATHS.find((p) => existsSync(p));

  if (!chromePath) {
    throw new Error(
      "Google Chrome not found. Install Chrome or set the path manually in src/auth/browser.ts.",
    );
  }

  // Wipe the profile on every login so Chrome never reuses a stale cached session.
  // Without this, Chrome opens the portal page from cache, loadEventFired fires
  // immediately with a matching URL, and expired cookies get captured as "fresh".
  rmSync("/tmp/uoplan-session", { recursive: true, force: true });

  const cdpPort = await findFreePort();

  const chrome = spawn(
    chromePath,
    [
      `--remote-debugging-port=${cdpPort}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--user-data-dir=/tmp/uoplan-session",
      PEOPLESOFT_URL,
    ],
    { stdio: "ignore", detached: false },
  );

  chrome.on("error", (err) => {
    throw new Error(`Failed to launch Chrome: ${err.message}`);
  });

  let client: CDP.Client | undefined;

  try {
    // Retry connecting to Chrome's debugging server until it's ready.
    const deadline = Date.now() + 10_000;
    while (true) {
      try {
        client = await CDP({ port: cdpPort });
        break;
      } catch {
        if (Date.now() >= deadline)
          throw new Error("Chrome did not start its debugging server in time.");
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }

    const { Network, Page } = client;
    await Network.enable();
    await Page.enable();

    console.log("Chrome opened. Log in with your uOttawa account.");
    console.log("The window will close automatically once you're signed in.\n");

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => {
          reject(new Error("Login timed out after 5 minutes."));
        },
        5 * 60 * 1000,
      );

      // Fired whenever a top-level navigation completes.
      Page.loadEventFired(() => {
        void client!.Runtime.evaluate({ expression: "window.location.href" })
          .then(({ result }) => {
            const url = String(result.value ?? "");
            const isAuthenticated =
              url.startsWith("https://www.uocampus.uottawa.ca/psp/") &&
              !url.includes("login.microsoftonline.com");
            if (isAuthenticated) {
              clearTimeout(timeout);
              resolve();
            }
          })
          .catch(() => {
            // Navigation events can fire during redirects; ignore transient errors.
          });
      });
    });

    const { cookies } = await Network.getCookies({
      urls: ["https://www.uocampus.uottawa.ca"],
    });

    return {
      cookies: cookies.map(({ name, value, domain, path, expires, httpOnly, secure }) => ({
        name,
        value,
        domain,
        path,
        expires,
        httpOnly,
        secure,
      })),
      savedAt: Date.now(),
    };
  } finally {
    await client?.close();
    chrome.kill();
  }
}
