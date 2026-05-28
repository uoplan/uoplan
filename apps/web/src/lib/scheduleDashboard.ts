import type { Program, RequirementWithStatus, Term } from "@uoplan/schedule";
import {
  hasMissingOptionSelections,
  nodeHasOptionGroups,
} from "../components/requirements/requirementUtils";
import { tr } from "../i18n";

export type ScheduleDashboardCardStatus = "ready" | "attention" | "empty";
export type ScheduleDashboardCardId = "term" | "program" | "completed" | "options" | "assign";
export type ScheduleEditorHref =
  | "/schedule"
  | "/schedule/program"
  | "/schedule/completed"
  | "/schedule/options"
  | "/schedule/requirements";

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

export type ScheduleDashboardCardState = {
  id: ScheduleDashboardCardId;
  label: string;
  status: ScheduleDashboardCardStatus;
  summary: string;
  to: ScheduleEditorHref;
  gateMessage?: string;
  gateTarget?: ScheduleEditorHref;
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

function gateToTerm(card: Omit<ScheduleDashboardCardState, "gateMessage" | "gateTarget">) {
  return {
    ...card,
    status: "empty" as const,
    gateMessage: tr("schedule.dashboard.gate.term"),
    gateTarget: "/schedule" as const,
  };
}

function gateToProgram(card: Omit<ScheduleDashboardCardState, "gateMessage" | "gateTarget">) {
  return {
    ...card,
    status: "empty" as const,
    gateMessage: tr("schedule.dashboard.gate.program"),
    gateTarget: "/schedule/program" as const,
  };
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
    to: "/schedule",
  };

  const programBase: ScheduleDashboardCardState = {
    id: "program",
    label: tr("schedule.dashboard.program.label"),
    status: programReady ? "ready" : "attention",
    summary: state.program?.title ?? tr("schedule.dashboard.program.empty"),
    to: "/schedule/program",
  };

  const completedBase: ScheduleDashboardCardState = {
    id: "completed",
    label: tr("schedule.dashboard.completed.label"),
    status: programReady ? "ready" : "empty",
    summary: tr("schedule.dashboard.completed.summary", { count: state.completedCourses.length }),
    to: "/schedule/completed",
  };

  const cards: ScheduleDashboardCardState[] = [
    termCard,
    termReady ? programBase : gateToTerm(programBase),
    programReady ? completedBase : gateToProgram(completedBase),
  ];

  if (optionsNeeded) {
    const optionsBase: ScheduleDashboardCardState = {
      id: "options",
      label: tr("schedule.dashboard.options.label"),
      status: optionsMissing ? "attention" : "ready",
      summary: optionsMissing
        ? tr("schedule.dashboard.options.attention")
        : tr("schedule.dashboard.options.ready"),
      to: "/schedule/options",
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
    to: "/schedule/requirements",
  };
  cards.push(programReady ? assignBase : gateToProgram(assignBase));

  return cards;
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
