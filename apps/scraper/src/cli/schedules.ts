import { main } from "../schedules/scrape.ts";

void (async () => {
  try {
    await main();
  } catch (err) {
    console.error("Schedule scrape failed.");
    console.error(err);
    process.exit(1);
  }
})();
