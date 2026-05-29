import type { Program, RequirementWithStatus, Term } from "@uoplan/core";
import { hasMissingOptionSelections, nodeHasOptionGroups } from "./requirements/requirementUtils";
import { tr } from "../i18n";

export type ScheduleDashboardCardStatus = "ready" | "attention" | "empty";
export type ScheduleStepId = "term" | "program" | "options" | "assign";

const SCHEDULE_STEP_IDS: readonly ScheduleStepId[] = ["term", "program", "options", "assign"];

export function isScheduleStepId(value: unknown): value is ScheduleStepId {
  return typeof value === "string" && (SCHEDULE_STEP_IDS as readonly string[]).includes(value);
}

export type ScheduleDashboardInput = {
  terms: Pick<Term, "termId" | "name">[] | null;
  selectedTermId: string | null;
  cacheLoaded: boolean;
  firstYear: number | null;
  program: Pick<Program, "title" | "url"> | null;
  completedCourses: string[];
  requirementTreeWithStatus: RequirementWithStatus[];
  selectedOptionsPerRequirement: Record<string, number>;
  unassignedCompletedCourses: string[];
};

type ScheduleDashboardCardState = {
  id: ScheduleStepId;
  label: string;
  status: ScheduleDashboardCardStatus;
  summary: string;
  gateMessage?: string;
};

export type GenerateBlockerId = "term" | "program" | "options" | "assign";
export type GenerateBlocker = {
  id: GenerateBlockerId;
  label: string;
  description: string;
  consequence: string;
};

function hasTermReady(state: ScheduleDashboardInput): boolean {
  return (state.terms?.length ?? 0) > 0 && Boolean(state.selectedTermId) && state.cacheLoaded;
}

function hasProgramReady(state: ScheduleDashboardInput): boolean {
  return state.firstYear !== null && state.program !== null;
}

function needsOptionsStep(state: ScheduleDashboardInput): boolean {
  return state.requirementTreeWithStatus.some(nodeHasOptionGroups);
}

function hasMissingOptions(state: ScheduleDashboardInput): boolean {
  return hasMissingOptionSelections(
    state.requirementTreeWithStatus,
    state.selectedOptionsPerRequirement,
  );
}

function selectedTermName(state: ScheduleDashboardInput): string | null {
  const selected = state.terms?.find((term) => String(term.termId) === state.selectedTermId);
  return selected?.name ?? null;
}

function gateToTerm(card: Omit<ScheduleDashboardCardState, "gateMessage">) {
  return {
    ...card,
    status: "empty" as const,
    gateMessage: tr("schedule.dashboard.gate.term"),
  };
}

function gateToProgram(card: Omit<ScheduleDashboardCardState, "gateMessage">) {
  return {
    ...card,
    status: "empty" as const,
    gateMessage: tr("schedule.dashboard.gate.program"),
  };
}

function programSummary(state: ScheduleDashboardInput): string {
  if (!state.program) return tr("schedule.dashboard.program.empty");
  const count = state.completedCourses.length;
  if (count === 0) return state.program.title;
  return `${state.program.title} · ${tr("schedule.dashboard.program.courseCount", { count })}`;
}

export function getScheduleDashboardCards(
  state: ScheduleDashboardInput,
): ScheduleDashboardCardState[] {
  const termReady = hasTermReady(state);
  const programReady = hasProgramReady(state);
  const optionsNeeded = needsOptionsStep(state);
  const optionsMissing = hasMissingOptions(state);
  const unassignedCount = state.unassignedCompletedCourses.length;

  const termCard: ScheduleDashboardCardState = {
    id: "term",
    label: tr("schedule.dashboard.term.label"),
    status: termReady ? "ready" : "attention",
    summary: selectedTermName(state) ?? tr("schedule.dashboard.term.empty"),
  };

  const programBase: ScheduleDashboardCardState = {
    id: "program",
    label: tr("schedule.dashboard.program.label"),
    status: programReady ? "ready" : "attention",
    summary: programSummary(state),
  };

  const cards: ScheduleDashboardCardState[] = [
    termCard,
    termReady ? programBase : gateToTerm(programBase),
  ];

  if (optionsNeeded) {
    const optionsBase: ScheduleDashboardCardState = {
      id: "options",
      label: tr("schedule.dashboard.options.label"),
      status: optionsMissing ? "attention" : "ready",
      summary: optionsMissing
        ? tr("schedule.dashboard.options.attention")
        : tr("schedule.dashboard.options.ready"),
    };
    cards.push(programReady ? optionsBase : gateToProgram(optionsBase));
  }

  const assignBase: ScheduleDashboardCardState = {
    id: "assign",
    label: tr("schedule.dashboard.assign.label"),
    status: unassignedCount > 0 ? "attention" : "ready",
    summary:
      unassignedCount > 0
        ? tr("schedule.dashboard.assign.attention", { count: unassignedCount })
        : tr("schedule.dashboard.assign.ready"),
  };
  cards.push(programReady ? assignBase : gateToProgram(assignBase));

  return cards;
}

/**
 * Decide which accordion section should be open initially. An explicit
 * `requestedStep` (from a `?step=` deep link) always wins; otherwise open the
 * first non-gated step that still needs attention, or nothing when all ready.
 */
export function resolveInitialOpenStep(
  cards: Pick<ScheduleDashboardCardState, "id" | "status" | "gateMessage">[],
  requestedStep: ScheduleStepId | undefined,
): ScheduleStepId | null {
  if (requestedStep && cards.some((card) => card.id === requestedStep)) {
    return requestedStep;
  }
  const firstAttention = cards.find((card) => !card.gateMessage && card.status !== "ready");
  return firstAttention?.id ?? null;
}

export function getGenerateBlockers(state: ScheduleDashboardInput): GenerateBlocker[] {
  const blockers: GenerateBlocker[] = [];

  if (!hasTermReady(state)) {
    blockers.push({
      id: "term",
      label: tr("schedule.generate.confirm.term.label"),
      description: tr("schedule.generate.confirm.term.description"),
      consequence: tr("schedule.generate.confirm.term.consequence"),
    });
  }

  if (!hasProgramReady(state)) {
    blockers.push({
      id: "program",
      label: tr("schedule.generate.confirm.program.label"),
      description: tr("programStep.skip.body"),
      consequence: tr("programStep.skip.basicModeNote"),
    });
  }

  if (needsOptionsStep(state) && hasMissingOptions(state)) {
    blockers.push({
      id: "options",
      label: tr("schedule.generate.confirm.options.label"),
      description: tr("schedule.generate.confirm.options.description"),
      consequence: tr("schedule.generate.confirm.options.consequence"),
    });
  }

  if (state.unassignedCompletedCourses.length > 0) {
    blockers.push({
      id: "assign",
      label: tr("schedule.generate.confirm.assign.label"),
      description: tr("schedule.generate.confirm.assign.description", {
        count: state.unassignedCompletedCourses.length,
      }),
      consequence: tr("schedule.generate.confirm.assign.consequence"),
    });
  }

  return blockers;
}
