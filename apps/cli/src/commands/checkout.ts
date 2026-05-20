import { createInterface } from "node:readline/promises";
import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { getSession } from "../auth/keychain.ts";
import { buildClient, AuthExpiredError } from "../api/client.ts";
import { checkout } from "../api/enrollment.ts";

export const checkoutCommand = new Command("checkout")
  .description("Enroll in all courses currently in your shopping cart")
  .action(async () => {
    const session = getSession();
    if (!session) {
      console.error(chalk.red("Not logged in. Run `uoplan login` first."));
      process.exit(1);
    }

    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question(chalk.yellow("Enroll in all courses in your cart? [y/N] "));
    rl.close();

    if (answer.toLowerCase() !== "y") {
      console.log("Cancelled.");
      return;
    }

    const spinner = ora("Submitting enrollment").start();

    try {
      const { client } = await buildClient(session);
      const result = await checkout(client);
      spinner.stop();

      if (result.enrolled.length > 0) {
        console.log(chalk.green("Enrolled:"));
        for (const msg of result.enrolled) console.log(`  ${msg}`);
      }

      if (result.errors.length > 0) {
        console.log(chalk.red("Errors:"));
        for (const msg of result.errors) console.log(`  ${msg}`);
      }

      if (result.enrolled.length === 0 && result.errors.length === 0) {
        console.log("Done. Check uoCampus to confirm enrollment.");
      }
    } catch (err) {
      spinner.fail();
      if (err instanceof AuthExpiredError) {
        console.error(chalk.red(err.message));
        process.exit(1);
      }
      throw err;
    }
  });
