/**
 * Builds the canonical professor registry (data/professors.json) from every
 * professor-name source. Run after scraping RMP/grades/schedules/feedback and
 * before `build:proto`, which encodes the registry to professors.pb and maps
 * each dataset's professors to registry indices.
 */

import { buildAndWriteProfessors, PROFESSORS_FILE } from "../professors/build.ts";

const professors = await buildAndWriteProfessors();
console.log(`Wrote ${professors.length} canonical professors -> ${PROFESSORS_FILE}`);
