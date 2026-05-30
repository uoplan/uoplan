import { main } from "../disciplines/scrape.ts";

main().catch((err) => {
  console.error("Failed to scrape disciplines");
  console.error(err);
  process.exit(1);
});
