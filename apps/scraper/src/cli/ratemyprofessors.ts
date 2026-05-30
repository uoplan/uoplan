import { main } from "../ratemyprofessors/scrape.ts";

main().catch((err) => {
  console.error("RateMyProfessors scrape failed:");
  console.error(err);
  process.exit(1);
});
