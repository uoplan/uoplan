import { Command } from "commander";
import { loginCommand } from "./commands/login.ts";
import { logoutCommand } from "./commands/logout.ts";
import { cartCommand } from "./commands/cart.ts";
import { checkoutCommand } from "./commands/checkout.ts";

const program = new Command("uoplan").version("0.1.0").description("uOttawa course planner CLI");

program.addCommand(loginCommand);
program.addCommand(logoutCommand);
program.addCommand(cartCommand);
program.addCommand(checkoutCommand);

await program.parseAsync(process.argv);
