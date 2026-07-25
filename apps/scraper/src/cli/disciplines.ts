import { main } from "../disciplines/scrape.ts";
import { parseSchoolArg } from "../shared/cliSchool.ts";

void (async () => {
  try {
    await main(parseSchoolArg(process.argv));
  } catch (err) {
    console.error("Failed to scrape disciplines");
    console.error(err);
    process.exit(1);
  }
})();
