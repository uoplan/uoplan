import { main } from "../schedules/scrape.ts";

main().catch((err) => {
  console.error("Schedule scrape failed.");
  console.error(err);
  process.exit(1);
});
