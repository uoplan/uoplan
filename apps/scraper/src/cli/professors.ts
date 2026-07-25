/**
 * Builds the canonical professor registry (data/<school>/professors.json) from every
 * professor-name source. Run after scraping RMP/grades/schedules/feedback and
 * before `build:proto`, which encodes the registry to professors.pb and maps
 * each dataset's professors to registry indices.
 */

import { buildAndWriteProfessors, professorsFile } from "../professors/build.ts";
import { parseSchoolArg } from "../shared/cliSchool.ts";

const school = parseSchoolArg(process.argv);
const professors = await buildAndWriteProfessors(school);
console.log(`Wrote ${professors.length} canonical professors -> ${professorsFile(school)}`);
