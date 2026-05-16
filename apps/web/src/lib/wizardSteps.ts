/**
 * Wizard uses fixed indices into {@link STEPS}.
 * Options (3) and Assign (4) are omitted from the flow when the user has nothing to do.
 */
export enum WizardStep {
  Term = 0,
  Mode = 1,
  Program = 2,
  Completed = 3,
  Options = 4,
  Assign = 5,
  Generate = 6,
}

export const ALL_WIZARD_STEP_INDICES = [
  WizardStep.Term,
  WizardStep.Mode,
  WizardStep.Program,
  WizardStep.Completed,
  WizardStep.Options,
  WizardStep.Assign,
  WizardStep.Generate,
] as const;

/** Interactive steps only (omits Options / Assign when N/A). */
export function buildVisibleStepIndices(needsOptions: boolean, needsAssign: boolean): number[] {
  const out: number[] = [
    WizardStep.Term,
    WizardStep.Mode,
    WizardStep.Program,
    WizardStep.Completed,
  ];
  if (needsOptions) out.push(WizardStep.Options);
  if (needsAssign) out.push(WizardStep.Assign);
  out.push(WizardStep.Generate);
  return out;
}

export function getNextStep(current: number, needsOptions: boolean, needsAssign: boolean): number {
  const visible = buildVisibleStepIndices(needsOptions, needsAssign);
  const i = visible.indexOf(current);
  if (i !== -1) return visible[Math.min(i + 1, visible.length - 1)];
  const next = visible.find((s) => s > current);
  return next ?? current;
}

export function getPrevStep(current: number, needsOptions: boolean, needsAssign: boolean): number {
  const visible = buildVisibleStepIndices(needsOptions, needsAssign);
  const i = visible.indexOf(current);
  if (i !== -1) return visible[Math.max(i - 1, 0)];
  const prev = [...visible].reverse().find((s) => s < current);
  return prev ?? current;
}

/** Inputs for {@link canProceedFromWizardStep} / {@link maxReachableWizardStep} (mirrors WizardShell gates). */
export type WizardProceedContext = {
  hasTerms: boolean;
  selectedTermId: string | null;
  cacheLoaded: boolean;
  wizardMode: "basic" | "advanced" | null;
  firstYear: number | null;
  hasProgram: boolean;
  missingOptions: boolean;
  needsOptionsStep: boolean;
  unassignedCount: number;
};

export function canProceedFromWizardStep(step: WizardStep, ctx: WizardProceedContext): boolean {
  switch (step) {
    case WizardStep.Term:
      return ctx.hasTerms && Boolean(ctx.selectedTermId) && ctx.cacheLoaded;
    case WizardStep.Mode:
      return Boolean(ctx.wizardMode);
    case WizardStep.Program:
      return ctx.firstYear !== null && ctx.hasProgram;
    case WizardStep.Completed:
      return true;
    case WizardStep.Options:
      return ctx.needsOptionsStep ? !ctx.missingOptions : true;
    case WizardStep.Assign:
      return ctx.unassignedCount === 0;
    case WizardStep.Generate:
      return true;
    default:
      return true;
  }
}

/**
 * Furthest wizard step the user may open given forward-completion rules (deep-link clamp target).
 */
export function maxReachableWizardStep(
  needsOptions: boolean,
  needsAssign: boolean,
  ctx: WizardProceedContext,
): WizardStep {
  const visible = buildVisibleStepIndices(needsOptions, needsAssign);
  let max: WizardStep = visible[0] ?? WizardStep.Term;
  for (let i = 0; i < visible.length - 1; i++) {
    const step = visible[i];
    const nextStep = visible[i + 1];
    if (step === undefined || nextStep === undefined) break;
    if (canProceedFromWizardStep(step, ctx)) {
      max = nextStep;
    } else {
      break;
    }
  }
  return max;
}

/** Whether Next should be enabled: current step is strictly before {@link maxReachableWizardStep} on the visible path. */
export function canAdvanceWizardStep(
  effectiveActive: WizardStep,
  visible: readonly number[],
  maxReachable: WizardStep,
): boolean {
  if (effectiveActive === WizardStep.Generate) return false;
  const activeNavIdx = visible.indexOf(effectiveActive);
  const maxNavIdx = visible.indexOf(maxReachable);
  if (activeNavIdx === -1 || maxNavIdx === -1) return false;
  return activeNavIdx < maxNavIdx;
}

/** If `active` points at a skipped step, move to the nearest visible step (forwards first). */
export function normalizeActiveStep(
  active: number,
  needsOptions: boolean,
  needsAssign: boolean,
): WizardStep {
  const visible = buildVisibleStepIndices(needsOptions, needsAssign);
  if (visible.includes(active)) return active;
  const forward = visible.find((s) => s >= active);
  if (forward != null) return forward;
  const backward = [...visible].reverse().find((s) => s <= active);
  return backward ?? visible[0];
}

/**
 * Sidebar row index for "furthest progress": steps with a lower display index stay
 * checked when revisiting earlier rows. If {@link furthestActual} is not visible
 * (optional step dropped), uses the row of the next visible step after it.
 */
export function furthestReachedDisplayIndex(
  visible: readonly number[],
  furthestActual: number,
): number {
  const i = visible.indexOf(furthestActual);
  if (i !== -1) return i;
  const next = visible.find((a) => a > furthestActual);
  if (next !== undefined) return visible.indexOf(next);
  return Math.max(0, visible.length - 1);
}

/** True when this step is not part of the interactive flow (sidebar still shows it as skipped). */
export function isWizardStepSkipped(
  actualIdx: WizardStep,
  needsOptions: boolean,
  needsAssign: boolean,
): boolean {
  if (actualIdx === WizardStep.Options) return !needsOptions;
  if (actualIdx === WizardStep.Assign) return !needsAssign;
  return false;
}

/** First interactive step index strictly after `actualIdx` (next row in the real flow). */
export function firstInteractiveStepAfter(
  actualIdx: WizardStep,
  needsOptions: boolean,
  needsAssign: boolean,
): number | undefined {
  const nav = buildVisibleStepIndices(needsOptions, needsAssign);
  return nav.find((s) => s > Number(actualIdx));
}

/** Skipped optional row may show a grey check once the user has moved past that slot. */
export function skippedWizardStepIsPassed(
  actualIdx: WizardStep,
  furthestActual: WizardStep,
  needsOptions: boolean,
  needsAssign: boolean,
): boolean {
  if (!isWizardStepSkipped(actualIdx, needsOptions, needsAssign)) return false;
  const next = firstInteractiveStepAfter(actualIdx, needsOptions, needsAssign);
  if (next === undefined) return false;
  return Number(furthestActual) >= next;
}
