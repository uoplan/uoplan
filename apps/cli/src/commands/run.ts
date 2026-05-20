import { gunzipSync } from "node:zlib";
import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { SchedulePayload } from "@uoplan/schedule/src/proto/cli";
import { getSession } from "../auth/keychain.ts";
import {
  buildClient,
  AuthExpiredError,
  NoTermSelectedError,
  NoCookiesError,
  unwrapError,
} from "../api/client.ts";
import { ENDPOINTS } from "../api/endpoints.ts";
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
} from "../api/search.ts";
import { listCart } from "../api/cart.ts";
import { submitCartAction, CART_ACTIONS } from "../api/enrollment.ts";

function decodePayload(raw: string): SchedulePayload {
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

function handleAuthError(err: unknown): never {
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

async function runPayload(raw: string): Promise<void> {
  let decoded: SchedulePayload;
  try {
    decoded = decodePayload(raw);
  } catch {
    console.error(
      chalk.red("Invalid payload: could not decode. Make sure you copied it correctly."),
    );
    process.exit(1);
  }

  if (decoded.courses.length === 0) {
    console.log(chalk.yellow("Payload contains no courses."));
    return;
  }

  const session = getSession();
  if (!session) {
    console.error(chalk.red("Not logged in. Run `uoplan login` first."));
    process.exit(1);
  }
  if (!session.strm) {
    console.error(chalk.red("No term selected. Run `uoplan term` first."));
    process.exit(1);
  }

  const cartUrl = session.cartUrl ?? ENDPOINTS.enrollCart;

  let client: Awaited<ReturnType<typeof buildClient>>["client"];
  const authSpinner = ora("Connecting").start();
  try {
    ({ client } = await buildClient(session));
    authSpinner.stop();
  } catch (err) {
    authSpinner.fail();
    handleAuthError(err);
  }

  const total = decoded.courses.length;

  for (let i = 0; i < total; i++) {
    const course = decoded.courses[i];
    const { subject, catalogNbr } = parseCourseCode(course.courseCode);
    const label = `${subject} ${catalogNbr}`;

    console.log(chalk.bold(`\n[${i + 1}/${total}] ${label}`));

    // Search for all sections of this course.
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

    // Build classNbr → { component, section } from the full search results table
    // (includes non-selectable LAB/TUT rows that the companion page won't label).
    const classMap = parseAllClassNumbers(xml);

    // Find the primary (LEC or whichever is in the enabled search results) section.
    // section field format is "A00-LEC FullSess." so match sectionCode-COMPONENT prefix.
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
    // Walk companion pages (LAB, TUT, etc.).
    // The companion page shows class numbers but not component labels, so we use
    // classMap (built from the search results) to identify which option to pick.
    const companionSections = course.sections.filter((s) => s !== primarySelection);
    let companionPage = 1;

    while (isCompanionPage(xml) && !isWaitlistPage(xml)) {
      const page = parseCompanionPage(xml);

      let pickedIndex = 0;

      if (page.options.length > 0) {
        // Match companion options against the desired sections from the payload.
        // Primary: use classMap (built from search results) for component+section matching.
        // Fallback: match section code directly from the companion option's text.
        const match = page.options.find((o) => {
          const classNbr = o.section.split(" ")[0];
          const info = classMap.get(classNbr);
          if (info) {
            return companionSections.some(
              (s) => s.component === info.component && s.section === info.section,
            );
          }
          // The companion page doesn't label sections by component — match by section code.
          // o.section is "classNbr sectionText" where sectionText may be "A02" or "A02-LAB FullSess."
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
          // No payload match — fall back to first option.
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
        // No options to choose — auto-advance.
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

    // Confirm (adds course to cart).
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

  // Enrol all courses now in the cart.
  console.log(chalk.bold("\nEnrolling all courses in cart…"));
  const enrolSpinner = ora("Fetching cart").start();
  let items: Awaited<ReturnType<typeof listCart>>;
  try {
    items = await listCart(client, cartUrl);
    enrolSpinner.text = "Submitting enrolment";
  } catch (err) {
    enrolSpinner.fail();
    handleAuthError(err);
  }

  if (items.length === 0) {
    enrolSpinner.warn("Cart is empty — nothing to enrol.");
    return;
  }

  try {
    const { errors } = await submitCartAction(
      client,
      cartUrl,
      items.map((item) => item.bufnum),
      CART_ACTIONS.enrol,
    );
    enrolSpinner.stop();

    if (errors.length > 0) {
      for (const err of errors) console.log(`${chalk.red("error:")} ${err}`);
    } else {
      console.log(chalk.green("Done. Check uoCampus to confirm enrolment."));
    }
  } catch (err) {
    enrolSpinner.fail();
    handleAuthError(err);
  }
}

export const runCommand = new Command("run")
  .description("Execute a schedule payload generated by the uoplan web app")
  .argument("<payload>", "Base64url-encoded (optionally gzipped) protobuf payload")
  .action(async (payload: string) => {
    await runPayload(payload);
  });
