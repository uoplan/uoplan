import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { getSession } from "../auth/keychain.ts";
import { buildClient, AuthExpiredError } from "../api/client.ts";
import { listCart, addToCart } from "../api/cart.ts";

function requireSession() {
  const session = getSession();
  if (!session) {
    console.error(chalk.red("Not logged in. Run `uoplan login` first."));
    process.exit(1);
  }
  return session;
}

const listSubcommand = new Command("list")
  .description("List courses in your shopping cart")
  .action(async () => {
    const session = requireSession();
    const spinner = ora("Fetching cart").start();

    try {
      const { client } = await buildClient(session);
      const items = await listCart(client);
      spinner.stop();

      if (items.length === 0) {
        console.log(chalk.yellow("Your cart is empty."));
        return;
      }

      const header = [
        chalk.bold("Course".padEnd(12)),
        chalk.bold("Title".padEnd(40)),
        chalk.bold("Section".padEnd(10)),
        chalk.bold("Units".padEnd(6)),
        chalk.bold("Status"),
      ].join("  ");

      console.log(header);
      console.log("─".repeat(80));

      for (const item of items) {
        console.log(
          [
            item.courseCode.padEnd(12),
            item.title.slice(0, 40).padEnd(40),
            item.section.padEnd(10),
            item.units.padEnd(6),
            item.status,
          ].join("  "),
        );
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

const addSubcommand = new Command("add")
  .description("Add a course to your cart by class number")
  .argument("<classNumber>", "PeopleSoft class number (e.g. 1234)")
  .action(async (classNumber: string) => {
    const session = requireSession();
    const spinner = ora(`Adding class ${classNumber} to cart`).start();

    try {
      const { client } = await buildClient(session);
      await addToCart(client, classNumber);
      spinner.succeed(`Class ${classNumber} added to cart.`);
    } catch (err) {
      spinner.fail();
      if (err instanceof AuthExpiredError) {
        console.error(chalk.red((err as Error).message));
        process.exit(1);
      }
      throw err;
    }
  });

export const cartCommand = new Command("cart")
  .description("Manage your course shopping cart")
  .addCommand(listSubcommand)
  .addCommand(addSubcommand)
  .action(async function (this: Command) {
    await listSubcommand.parseAsync([], { from: "user" });
  });
