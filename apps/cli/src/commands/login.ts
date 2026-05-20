import { Command } from "commander";
import { launchBrowserAuth } from "../auth/browser.ts";
import { getSession, setSession } from "../auth/keychain.ts";

export const loginCommand = new Command("login")
  .description("Authenticate with your uOttawa Microsoft account via Chrome")
  .action(async () => {
    try {
      const existing = getSession();
      const session = await launchBrowserAuth();
      setSession({
        ...session,
        ...(existing?.strm !== undefined ? { strm: existing.strm } : {}),
        ...(existing?.termIndex !== undefined ? { termIndex: existing.termIndex } : {}),
        ...(existing?.cartUrl !== undefined ? { cartUrl: existing.cartUrl } : {}),
      });
      console.log("Logged in successfully.");
    } catch (err) {
      console.error("Login failed:", err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });
