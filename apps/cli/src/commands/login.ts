import { Command } from "commander";
import { launchBrowserAuth } from "../auth/browser.ts";
import { setSession } from "../auth/keychain.ts";

export const loginCommand = new Command("login")
  .description("Authenticate with your uOttawa Microsoft account via Chrome")
  .action(async () => {
    try {
      const session = await launchBrowserAuth();
      setSession(session);
      console.log("Logged in successfully.");
    } catch (err) {
      console.error("Login failed:", err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });
