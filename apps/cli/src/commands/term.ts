import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import * as clack from "@clack/prompts";
import { getSession, setTerm } from "../auth/keychain.ts";
import { buildClient, AuthExpiredError, unwrapError } from "../api/client.ts";
import { listTerms, selectTerm } from "../api/terms.ts";

function requireSession() {
  const session = getSession();
  if (!session) {
    console.error(chalk.red("Not logged in. Run `uoplan login` first."));
    process.exit(1);
  }
  return session;
}

async function runInteractive(): Promise<void> {
  const session = requireSession();
  const spinner = ora("Fetching terms").start();

  let terms;
  try {
    const { client } = await buildClient(session);
    terms = await listTerms(client);
    spinner.stop();
  } catch (err) {
    spinner.fail();
    const e = unwrapError(err);
    if (e instanceof AuthExpiredError) {
      console.error(chalk.red(e.message));
      process.exit(1);
    }
    throw err;
  }

  if (terms.length === 0) {
    console.log(chalk.yellow("No terms available."));
    return;
  }

  const selected = await clack.select({
    message: "Select a term",
    options: terms.map((t) => ({
      value: t.index,
      label: t.name,
      hint: t.career,
    })),
  });

  if (clack.isCancel(selected)) {
    process.exit(0);
  }

  const spinner2 = ora(`Selecting ${terms[selected as number].name}`).start();

  try {
    const { client } = await buildClient(session);
    const strm = await selectTerm(client, selected as number);
    setTerm(strm, selected as number);
    spinner2.succeed(`Term set to ${chalk.bold(terms[selected as number].name)}.`);
  } catch (err) {
    spinner2.fail();
    const e = unwrapError(err);
    if (e instanceof AuthExpiredError) {
      console.error(chalk.red(e.message));
      process.exit(1);
    }
    throw err;
  }
}

async function runList(): Promise<void> {
  const session = requireSession();
  const spinner = ora("Fetching terms").start();

  try {
    const { client } = await buildClient(session);
    const terms = await listTerms(client);
    spinner.stop();

    for (const term of terms) {
      console.log(`${chalk.bold(term.name)}  ${chalk.dim(term.career)}`);
    }
  } catch (err) {
    spinner.fail();
    if (err instanceof AuthExpiredError) {
      console.error(chalk.red(err.message));
      process.exit(1);
    }
    throw err;
  }
}

export const termCommand = new Command("term")
  .description("Select a term interactively")
  .action(runInteractive)
  .addCommand(
    new Command("ls").description("List available terms (non-interactive)").action(runList),
  )
  .addCommand(
    new Command("list").description("List available terms (non-interactive)").action(runList),
  );
