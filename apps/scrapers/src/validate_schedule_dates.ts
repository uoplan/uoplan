import fs from "node:fs";
import path from "node:path";
import { SCRAPER_DATA_DIR } from "./dataPaths.ts";
import type { SchedulesData } from "../../../packages/schedule/src/dataTypes.ts";

const DAY_INDEX: Record<string, number> = {
  Mo: 0,
  Tu: 1,
  We: 2,
  Th: 3,
  Fr: 4,
  Sa: 5,
  Su: 6,
};

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function endDayIndex(isoDate: string): number {
  const d = new Date(`${isoDate}T00:00:00Z`);
  return (d.getUTCDay() + 6) % 7; // Sun=0 → 6, Mon=1 → 0, …, Sat=6 → 5
}

const files = fs
  .readdirSync(SCRAPER_DATA_DIR)
  .filter((f) => /^schedules\.\d+\.json$/.test(f))
  .sort();

if (files.length === 0) {
  console.error("No schedules.*.json files found in", SCRAPER_DATA_DIR);
  process.exit(1);
}

let totalViolations = 0;

for (const file of files) {
  const filePath = path.join(SCRAPER_DATA_DIR, file);
  const data = JSON.parse(fs.readFileSync(filePath, "utf-8")) as SchedulesData;
  let fileViolations = 0;

  for (const course of data.schedules) {
    for (const sections of Object.values(course.components)) {
      for (const section of sections) {
        for (const time of section.times) {
          if (!time.meetingDates) continue;
          const classDayIdx = DAY_INDEX[time.day];
          if (classDayIdx === undefined) continue;
          const endIdx = endDayIndex(time.meetingDates[1]);
          if (endIdx < classDayIdx) {
            fileViolations++;
            console.log(
              `  VIOLATION: ${course.courseCode} § ${section.section} | day=${time.day} (${DAY_NAMES[classDayIdx]}) | endDate=${time.meetingDates[1]} (${DAY_NAMES[endIdx]}) | expected end day >= ${DAY_NAMES[classDayIdx]}`,
            );
          }
        }
      }
    }
  }

  console.log(`${file}: ${fileViolations} violation(s)`);
  totalViolations += fileViolations;
}

console.log(`\nTotal violations: ${totalViolations}`);
if (totalViolations > 0) process.exit(1);
