import { Command } from "commander";
import { multiselect, select, isCancel, cancel, outro } from "@clack/prompts";
import chalk from "chalk";
import ora from "ora";
import { getSession } from "../auth/keychain.ts";
import { buildClient, AuthExpiredError, NoTermSelectedError, unwrapError } from "../api/client.ts";
import { ENDPOINTS } from "../api/endpoints.ts";
import { listCart, parseCart } from "../api/cart.ts";
import type { CartItem } from "../api/cart.ts";
import { submitCartAction, CART_ACTIONS } from "../api/enrollment.ts";

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

function buildOptions(items: CartItem[]) {
  return items.map((item) => ({
    value: item.bufnum,
    label: item.courseCode,
    hint: item.instructors.join(", ") || undefined,
  }));
}

function handleAuthError(err: unknown): never {
  const e = unwrapError(err);
  if (e instanceof AuthExpiredError || e instanceof NoTermSelectedError) {
    console.error(chalk.red((e as Error).message));
    process.exit(1);
  }
  throw err;
}

async function runLoop(
  client: Awaited<ReturnType<typeof buildClient>>["client"],
  cartUrl: string,
  items: CartItem[],
): Promise<void> {
  if (items.length === 0) {
    outro("Cart is empty.");
    return;
  }

  const selected = await multiselect({
    message: "Select courses",
    options: buildOptions(items),
    required: true,
  });

  if (isCancel(selected)) {
    cancel("Cancelled.");
    return;
  }

  const action = await select({
    message: "What would you like to do?",
    options: [
      { value: "enrol", label: "Enrol" },
      { value: "delete", label: "Delete from cart" },
    ],
  });

  if (isCancel(action)) {
    cancel("Cancelled.");
    return;
  }

  const isDelete = action === "delete";
  const spinner = ora(isDelete ? "Deleting from cart" : "Submitting enrolment").start();

  try {
    const { html, errors } = await submitCartAction(
      client,
      cartUrl,
      selected as number[],
      isDelete ? CART_ACTIONS.delete : CART_ACTIONS.enrol,
    );
    spinner.stop();

    for (const err of errors) console.log(`${chalk.red("error:")} ${err}`);

    const remaining = parseCart(html);
    await runLoop(client, cartUrl, remaining);
  } catch (err) {
    spinner.fail();
    handleAuthError(err);
  }
}

export async function runCartInteractive(): Promise<void> {
  const session = requireSession();
  const spinner = ora("Fetching cart").start();

  try {
    const { client } = await buildClient(session);
    const cartUrl = session.cartUrl ?? ENDPOINTS.enrollCart;
    const items = await listCart(client, cartUrl);
    spinner.stop();
    await runLoop(client, cartUrl, items);
  } catch (err) {
    spinner.fail();
    handleAuthError(err);
  }
}

export async function runEnrolInteractive(): Promise<void> {
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

    const selected = await multiselect({
      message: "Select courses to enrol in",
      options: buildOptions(items),
      required: true,
    });

    if (isCancel(selected)) {
      cancel("Cancelled.");
      return;
    }

    const spinner2 = ora("Submitting enrolment").start();
    const { errors } = await submitCartAction(
      client,
      cartUrl,
      selected as number[],
      CART_ACTIONS.enrol,
    );
    spinner2.stop();

    if (errors.length > 0) {
      for (const err of errors) console.log(`${chalk.red("error:")} ${err}`);
    } else {
      console.log(chalk.green("Done. Check uoCampus to confirm enrolment."));
    }
  } catch (err) {
    spinner.fail();
    handleAuthError(err);
  }
}

export const cartCommand = new Command("cart")
  .description("Manage your course shopping cart")
  .action(runCartInteractive)
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
          const { addToCart } = await import("../api/cart.ts");
          await addToCart(client, cartUrl, classNumber);
          spinner.succeed(`Class ${classNumber} added to cart.`);
        } catch (err) {
          spinner.fail();
          handleAuthError(err);
        }
      }),
  );
