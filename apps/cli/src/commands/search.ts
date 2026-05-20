import { Command } from "commander";
import { select, isCancel, cancel } from "@clack/prompts";
import chalk from "chalk";
import ora from "ora";
import { getSession } from "../auth/keychain.ts";
import { buildClient, AuthExpiredError, NoTermSelectedError } from "../api/client.ts";
import { ENDPOINTS } from "../api/endpoints.ts";
import {
  parseCourseCode,
  searchCourses,
  selectSection,
  submitCompanionSelection,
  confirmEnrollment,
  parseCompanionPage,
  parseConfirmMessages,
  isCompanionPage,
  isWaitlistPage,
} from "../api/search.ts";
import type { SearchResult, CompanionOption } from "../api/search.ts";

function formatResult(r: SearchResult): string {
  const parts = [r.classNbr, r.section, r.days].filter(Boolean);
  return parts.join(" — ");
}

function formatCompanion(o: CompanionOption): string {
  const parts = [o.section, o.schedule, o.room].filter(Boolean);
  return parts.join(" — ");
}

async function runSearch(course: string): Promise<void> {
  const session = getSession();
  if (!session) {
    console.error(chalk.red("Not logged in. Run `uoplan login` first."));
    process.exit(1);
  }
  if (!session.strm) {
    console.error(chalk.red("No term selected. Run `uoplan term` first."));
    process.exit(1);
  }

  const { subject, catalogNbr } = parseCourseCode(course);
  const cartUrl = session.cartUrl ?? ENDPOINTS.enrollCart;
  const spinner = ora(`Searching for ${subject} ${catalogNbr}`).start();

  let client: Awaited<ReturnType<typeof buildClient>>["client"];
  try {
    ({ client } = await buildClient(session));
  } catch (err) {
    spinner.fail();
    if (err instanceof AuthExpiredError || err instanceof NoTermSelectedError) {
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }
    throw err;
  }

  let xml: string;
  let results: SearchResult[];
  try {
    ({ xml, results } = await searchCourses(client, cartUrl, subject, catalogNbr));
    spinner.stop();
  } catch (err) {
    spinner.fail();
    if (err instanceof AuthExpiredError || err instanceof NoTermSelectedError) {
      console.error(chalk.red((err as Error).message));
      process.exit(1);
    }
    throw err;
  }

  if (results.length === 0) {
    console.log(chalk.yellow(`No sections found for ${subject} ${catalogNbr}.`));
    console.log(chalk.dim("(Debug HTML saved to /tmp/uoplan-search-2-search.html)"));
    return;
  }

  const chosen = await select({
    message: `Select a section for ${subject} ${catalogNbr}`,
    options: results.map((r) => ({
      value: r.rowIndex,
      label: formatResult(r),
      hint: [r.instructor, r.status].filter(Boolean).join(" · ") || undefined,
    })),
  });

  if (isCancel(chosen)) {
    cancel("Cancelled.");
    return;
  }

  const selectSpinner = ora("Loading section details").start();
  xml = await selectSection(client, cartUrl, xml, chosen as number);
  selectSpinner.stop();

  // Walk companion class pages (TUT, LAB, etc.)
  let companionPage = 1;
  while (isCompanionPage(xml) && !isWaitlistPage(xml)) {
    const page = parseCompanionPage(xml);

    if (page.options.length === 0) {
      // No selectable options — advance with default
      const advSpinner = ora("Continuing").start();
      xml = await submitCompanionSelection(client, cartUrl, xml, 0, companionPage);
      advSpinner.stop();
      companionPage++;
      continue;
    }

    const picked = await select({
      message: page.label,
      options: page.options.map((o) => ({
        value: o.index,
        label: formatCompanion(o),
        hint: [o.instructor, o.status].filter(Boolean).join(" · ") || undefined,
      })),
    });

    if (isCancel(picked)) {
      cancel("Cancelled.");
      return;
    }

    const compSpinner = ora("Confirming selection").start();
    xml = await submitCompanionSelection(client, cartUrl, xml, picked as number, companionPage);
    compSpinner.stop();
    companionPage++;
  }

  const confirmSpinner = ora("Adding to cart").start();
  const confirmXml = await confirmEnrollment(client, cartUrl, xml);
  confirmSpinner.stop();

  const { errors, notices } = parseConfirmMessages(confirmXml);
  for (const msg of notices) console.log(chalk.green(msg));
  for (const err of errors) console.log(`${chalk.red("error:")} ${err}`);
  if (errors.length === 0 && notices.length === 0) {
    console.log(chalk.green(`${subject} ${catalogNbr} added to cart.`));
  }
}

export const searchCommand = new Command("search")
  .description("Search for a course and add it to your cart")
  .argument("<course>", "Course code (e.g. CSI2101)")
  .action(async (course: string) => {
    try {
      await runSearch(course);
    } catch (err) {
      if (err instanceof Error && err.message.startsWith("Invalid course code")) {
        console.error(chalk.red(err.message));
        process.exit(1);
      }
      throw err;
    }
  });
