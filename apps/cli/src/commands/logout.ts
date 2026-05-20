import { Command } from "commander";
import { deleteSession } from "../auth/keychain.ts";

export const logoutCommand = new Command("logout")
  .description("Clear stored credentials")
  .action(() => {
    deleteSession();
    console.log("Logged out.");
  });
