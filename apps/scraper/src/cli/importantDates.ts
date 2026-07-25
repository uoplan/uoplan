import { scrapeImportantDates } from "../importantDates/scrape.ts";
import { parseSchoolArg } from "../shared/cliSchool.ts";

void (async () => {
  try {
    console.log("Fetching important academic dates pages...");
    const result = await scrapeImportantDates(parseSchoolArg(process.argv));
    console.log(
      `Wrote important dates for ${result.termCount} terms and ${result.itemCount} English items.`,
    );
    console.log(
      `English locale terms: ${result.en.terms.length}; French locale terms: ${result.fr.terms.length}.`,
    );
  } catch (error) {
    console.error("Important dates scrape failed:");
    console.error(error);
    process.exit(1);
  }
})();
