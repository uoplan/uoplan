import { main } from "../catalogue/scrape.ts";

main().catch((err) => {
  console.error("Scrape failed!");
  console.error(err);
  process.exit(1);
});
