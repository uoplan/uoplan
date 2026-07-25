import { main } from "../proto/build.ts";
import { parseSchoolArg } from "../shared/cliSchool.ts";

await main(parseSchoolArg(process.argv));
