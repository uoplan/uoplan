import { main } from "../catalogue/scrape.ts";

void (async () => {
  try {
    await main();
  } catch (err) {
    console.error("Scrape failed!");
    console.error(err);
    process.exit(1);
  }
})();
