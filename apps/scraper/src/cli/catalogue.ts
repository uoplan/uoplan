import { main } from "../catalogue/scrape.ts";
import { parseSchoolArg } from "../shared/cliSchool.ts";

void (async () => {
  try {
    await main(parseSchoolArg(process.argv));
  } catch (err) {
    console.error("Scrape failed!");
    console.error(err);
    process.exit(1);
  }
})();
