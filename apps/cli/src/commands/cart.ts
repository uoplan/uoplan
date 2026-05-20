import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { getSession } from "../auth/keychain.ts";
import { buildClient, AuthExpiredError, NoTermSelectedError } from "../api/client.ts";
import { ENDPOINTS } from "../api/endpoints.ts";
import { listCart, addToCart } from "../api/cart.ts";

function requireSession() {
  const session = getSession();
  if (!session) {
    console.error(chalk.red("Not logged in. Run `uoplan login` first."));
    process.exit(1);
  }
  if (!session.strm) {
    console.error(chalk.red("No term selected. Run `uoplan term` first."));
    process.exit(1);
  }
  return session as typeof session & { strm: string };
}

async function runList(): Promise<void> {
  const session = requireSession();
  const spinner = ora("Fetching cart").start();

  try {
    const { client } = await buildClient(session);
    const cartUrl = session.cartUrl ?? ENDPOINTS.enrollCart;
    const items = await listCart(client, cartUrl);
    spinner.stop();

    if (items.length === 0) {
      console.log(chalk.yellow("Your cart is empty."));
      return;
    }

    const header = [
      chalk.bold("Section".padEnd(14)),
      chalk.bold("#".padEnd(6)),
      chalk.bold("Schedule".padEnd(36)),
      chalk.bold("Instructor".padEnd(16)),
      chalk.bold("Units"),
    ].join("  ");

    console.log(header);
    console.log("─".repeat(80));

    for (const item of items) {
      console.log(
        [
          item.section.padEnd(14),
          item.classNumber.padEnd(6),
          item.schedule.slice(0, 36).padEnd(36),
          item.instructor.slice(0, 16).padEnd(16),
          item.units,
        ].join("  "),
      );
    }
  } catch (err) {
    spinner.fail();
    if (err instanceof AuthExpiredError || err instanceof NoTermSelectedError) {
      console.error(chalk.red(err.message));
      process.exit(1);
    }
    throw err;
  }
}

export const cartCommand = new Command("cart")
  .description("Manage your course shopping cart")
  .action(runList)
  .addCommand(new Command("list").description("List courses in your shopping cart").action(runList))
  .addCommand(
    new Command("add")
      .description("Add a course to your cart by class number")
      .argument("<classNumber>", "PeopleSoft class number (e.g. 1234)")
      .action(async (classNumber: string) => {
        const session = requireSession();
        const spinner = ora(`Adding class ${classNumber} to cart`).start();
        try {
          const { client } = await buildClient(session);
          const cartUrl = session.cartUrl ?? ENDPOINTS.enrollCart;
          await addToCart(client, cartUrl, classNumber);
          spinner.succeed(`Class ${classNumber} added to cart.`);
        } catch (err) {
          spinner.fail();
          if (err instanceof AuthExpiredError || err instanceof NoTermSelectedError) {
            console.error(chalk.red(err.message));
            process.exit(1);
          }
          throw err;
        }
      }),
  );
