import { Command } from "commander";
import { loginCommand } from "./commands/login.ts";
import { logoutCommand } from "./commands/logout.ts";
import { cartCommand, runEnrolInteractive } from "./commands/cart.ts";
import { runCommand } from "./commands/run.ts";
import { fetchCommand } from "./commands/fetch.ts";
import { termCommand } from "./commands/term.ts";

const program = new Command("uoplan").version("0.1.0").description("uOttawa course planner CLI");

program.addCommand(loginCommand);
program.addCommand(logoutCommand);
program.addCommand(cartCommand);
program.addCommand(
  new Command("enrol").description("Select and enrol in cart courses").action(runEnrolInteractive),
);
program.addCommand(runCommand);
program.addCommand(fetchCommand);
program.addCommand(termCommand);

await program.parseAsync(process.argv);
