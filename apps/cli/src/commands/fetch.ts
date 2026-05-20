import { Command } from "commander";
import { getSession } from "../auth/keychain.ts";
import { buildClient } from "../api/client.ts";

export const fetchCommand = new Command("fetch")
  .description("Fetch a URL with stored session cookies and print the response body")
  .argument("<url>", "URL to fetch")
  .action(async (url: string) => {
    const session = getSession();
    if (!session) {
      console.error("Not logged in. Run `uoplan login` first.");
      process.exit(1);
    }

    const { client } = await buildClient(session);
    const res = await client.get(url, { responseType: "text" });
    process.stdout.write(res.body as string);
  });
