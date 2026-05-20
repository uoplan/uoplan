import { gunzipSync } from "node:zlib";
import chalk from "chalk";
import ora from "ora";
import { SchedulePayload } from "@uoplan/schedule/src/proto/cli";
import type { CourseSelection } from "@uoplan/schedule/src/proto/cli";
import {
  parseCourseCode,
  searchCourses,
  selectSection,
  submitCompanionSelection,
  confirmEnrollment,
  parseCompanionPage,
  parseConfirmMessages,
  parseAllClassNumbers,
  isCompanionPage,
  isWaitlistPage,
} from "../../api/search.ts";
import type { PeopleSoftClient } from "../../api/client.ts";
import {
  AuthExpiredError,
  NoTermSelectedError,
  NoCookiesError,
  unwrapError,
} from "../../api/client.ts";

export function decodePayload(raw: string): SchedulePayload {
  const stripped = raw.trim().replace(/\s+/g, "");
  const buf = Buffer.from(stripped, "base64url");

  let bytes: Uint8Array;
  try {
    bytes = gunzipSync(buf);
  } catch {
    bytes = buf;
  }

  return SchedulePayload.decode(bytes);
}

export function handleAuthError(err: unknown): never {
  const e = unwrapError(err);
  if (
    e instanceof AuthExpiredError ||
    e instanceof NoTermSelectedError ||
    e instanceof NoCookiesError
  ) {
    console.error(chalk.red((e as Error).message));
    process.exit(1);
  }
  throw err;
}

export async function addCoursesToCart(
  client: PeopleSoftClient,
  cartUrl: string,
  courses: CourseSelection[],
): Promise<void> {
  const total = courses.length;

  for (let i = 0; i < total; i++) {
    const course = courses[i];
    const { subject, catalogNbr } = parseCourseCode(course.courseCode);
    const label = `${subject} ${catalogNbr}`;

    console.log(chalk.bold(`\n[${i + 1}/${total}] ${label}`));

    const searchSpinner = ora("Searching").start();
    let xml: string;
    let results: Awaited<ReturnType<typeof searchCourses>>["results"];
    try {
      ({ xml, results } = await searchCourses(client, cartUrl, subject, catalogNbr));
      searchSpinner.stop();
    } catch (err) {
      searchSpinner.fail();
      handleAuthError(err);
    }

    if (results.length === 0) {
      console.log(chalk.yellow(`  No sections found for ${label}. Skipping.`));
      continue;
    }

    const classMap = parseAllClassNumbers(xml);

    const primarySelection = course.sections.find((s) =>
      results.some((r) => r.section.startsWith(`${s.section}-${s.component}`)),
    );

    if (!primarySelection) {
      console.log(
        chalk.red(
          `  Could not find a selectable section for ${label} matching the payload. Skipping.`,
        ),
      );
      console.log(
        chalk.dim(
          `  Payload sections: ${course.sections.map((s) => `${s.component} ${s.section}`).join(", ")}`,
        ),
      );
      console.log(chalk.dim(`  Available: ${results.map((r) => r.section).join(", ")}`));
      continue;
    }

    const primaryRow = results.find((r) =>
      r.section.startsWith(`${primarySelection.section}-${primarySelection.component}`),
    )!;

    const selectSpinner = ora(
      `Selecting ${primarySelection.component} ${primarySelection.section}`,
    ).start();
    try {
      xml = await selectSection(client, cartUrl, xml, primaryRow.rowIndex);
      selectSpinner.stop();
    } catch (err) {
      selectSpinner.fail();
      handleAuthError(err);
    }

    const companionSections = course.sections.filter((s) => s !== primarySelection);
    let companionPage = 1;

    while (isCompanionPage(xml) && !isWaitlistPage(xml)) {
      const page = parseCompanionPage(xml);
      let pickedIndex = 0;

      if (page.options.length > 0) {
        const match = page.options.find((o) => {
          const classNbr = o.section.split(" ")[0];
          const info = classMap.get(classNbr);
          if (info) {
            return companionSections.some(
              (s) => s.component === info.component && s.section === info.section,
            );
          }
          const sectionText = o.section.split(" ").slice(1).join(" ");
          return companionSections.some(
            (s) => sectionText === s.section || sectionText.startsWith(`${s.section}-`),
          );
        });

        if (match) {
          pickedIndex = match.index;
          const classNbr = match.section.split(" ")[0];
          const info = classMap.get(classNbr);
          const compSpinner = ora(
            `Selecting ${info ? `${info.component} ${info.section}` : match.section}`,
          ).start();
          try {
            xml = await submitCompanionSelection(client, cartUrl, xml, pickedIndex, companionPage);
            compSpinner.stop();
          } catch (err) {
            compSpinner.fail();
            handleAuthError(err);
          }
        } else {
          pickedIndex = page.options[0].index;
          const compSpinner = ora("Selecting companion section (no exact match)").start();
          try {
            xml = await submitCompanionSelection(client, cartUrl, xml, pickedIndex, companionPage);
            compSpinner.stop();
          } catch (err) {
            compSpinner.fail();
            handleAuthError(err);
          }
        }
      } else {
        const advSpinner = ora("Continuing").start();
        try {
          xml = await submitCompanionSelection(client, cartUrl, xml, 0, companionPage);
          advSpinner.stop();
        } catch (err) {
          advSpinner.fail();
          handleAuthError(err);
        }
      }

      companionPage++;
    }

    const confirmSpinner = ora("Adding to cart").start();
    let confirmXml: string;
    try {
      confirmXml = await confirmEnrollment(client, cartUrl, xml);
      confirmSpinner.stop();
    } catch (err) {
      confirmSpinner.fail();
      handleAuthError(err);
    }

    const { errors, notices } = parseConfirmMessages(confirmXml);
    for (const msg of notices) console.log(chalk.green(`  ${msg}`));
    for (const err of errors) console.log(`  ${chalk.red("error:")} ${err}`);
    if (errors.length === 0 && notices.length === 0) {
      console.log(chalk.green(`  ${label} added to cart.`));
    }
  }
}
