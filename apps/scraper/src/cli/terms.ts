import { main } from "../terms/check.ts";
import { parseSchoolArg } from "../shared/cliSchool.ts";

await main(parseSchoolArg(process.argv));
