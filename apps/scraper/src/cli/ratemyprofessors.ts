import { main } from "../ratemyprofessors/scrape.ts";
import { parseSchoolArg } from "../shared/cliSchool.ts";

void (async () => {
  try {
    await main(parseSchoolArg(process.argv));
  } catch (err) {
    console.error("RateMyProfessors scrape failed:");
    console.error(err);
    process.exit(1);
  }
})();
