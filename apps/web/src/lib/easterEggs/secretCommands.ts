import type { ComponentType, SVGProps } from "react";
import { IconSparkles } from "@tabler/icons-react";

/** Tabler-style icon component (accepts `size`/`stroke` alongside SVG props). */
type IconComponent = ComponentType<
  Omit<SVGProps<SVGSVGElement>, "stroke"> & { size?: number | string; stroke?: number | string }
>;

/**
 * A hidden command-center action. These never appear in the default Spotlight
 * list — they surface only when the search query matches one of their
 * {@link SecretCommand.triggers}, so the normal command center stays clean while
 * the curious can still discover them.
 */
export interface SecretCommand {
  id: string;
  /** Lowercase keywords that reveal and match the action. */
  triggers: string[];
  /** tr() id for the label. */
  labelId: string;
  /** tr() id for the description. */
  descriptionId: string;
  icon: IconComponent;
  run: () => void;
}

/** Side-effecting handlers the secret commands need from their host component. */
interface SecretCommandHandlers {
  /** Unlock and apply the hidden Garnet & Grey (Gee-Gees) theme. */
  unlockGeegees: () => void;
}

/** Minimum query length before secret triggers are considered (avoids noise). */
const MIN_QUERY_LENGTH = 3;

/** Build the secret command list, wiring each action to its handler. */
export function buildSecretCommands(handlers: SecretCommandHandlers): SecretCommand[] {
  return [
    {
      id: "secret-geegees",
      triggers: ["geegees", "gee gees", "go gees", "gryphon", "garnet", "uottawa"],
      labelId: "easterEgg.command.geegees.label",
      descriptionId: "easterEgg.command.geegees.description",
      icon: IconSparkles,
      run: handlers.unlockGeegees,
    },
  ];
}

/**
 * Pure matcher: the subset of `commands` whose triggers match the query. Returns
 * an empty list for short/blank queries so the secret group never shows by
 * default. A command matches when a trigger contains the query or vice versa
 * (so "gee" reveals "geegees" and "geegees" reveals "gee gees").
 */
export function matchSecretCommands(commands: SecretCommand[], query: string): SecretCommand[] {
  const q = query.trim().toLowerCase();
  if (q.length < MIN_QUERY_LENGTH) return [];
  return commands.filter((command) =>
    command.triggers.some((trigger) => trigger.includes(q) || q.includes(trigger)),
  );
}
