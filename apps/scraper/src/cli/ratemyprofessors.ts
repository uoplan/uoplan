import { main } from "../ratemyprofessors/scrape.ts";

void (async () => {
  try {
    await main();
  } catch (err) {
    console.error("RateMyProfessors scrape failed:");
    console.error(err);
    process.exit(1);
  }
})();
