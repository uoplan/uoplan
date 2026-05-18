/**
 * Single source of truth for wizard onboarding copy (Help modal + Driver.js tour).
 */
import { WizardStep } from "./wizardSteps";
import { tr } from "../i18n";

type WizardContentStep = {
  /** Short title for tour popover + modal */
  title: string;
  /** Why this step exists */
  purpose: string;
  /** Concrete actions for the user */
  whatToDo: string;
};

export function getWizardStepContent(): Record<WizardStep, WizardContentStep> {
  return {
    [WizardStep.Term]: {
      title: tr("wizardContent.term.title"),
      purpose: tr("wizardContent.term.purpose"),
      whatToDo: tr("wizardContent.term.whatToDo"),
    },
    [WizardStep.Mode]: {
      title: tr("wizardContent.mode.title"),
      purpose: tr("wizardContent.mode.purpose"),
      whatToDo: tr("wizardContent.mode.whatToDo"),
    },
    [WizardStep.Program]: {
      title: tr("wizardContent.program.title"),
      purpose: tr("wizardContent.program.purpose"),
      whatToDo: tr("wizardContent.program.whatToDo"),
    },
    [WizardStep.Completed]: {
      title: tr("wizardContent.completed.title"),
      purpose: tr("wizardContent.completed.purpose"),
      whatToDo: tr("wizardContent.completed.whatToDo"),
    },
    [WizardStep.Options]: {
      title: tr("wizardContent.options.title"),
      purpose: tr("wizardContent.options.purpose"),
      whatToDo: tr("wizardContent.options.whatToDo"),
    },
    [WizardStep.Assign]: {
      title: tr("wizardContent.assign.title"),
      purpose: tr("wizardContent.assign.purpose"),
      whatToDo: tr("wizardContent.assign.whatToDo"),
    },
    [WizardStep.Generate]: {
      title: tr("wizardContent.generate.title"),
      purpose: tr("wizardContent.generate.purpose"),
      whatToDo: tr("wizardContent.generate.whatToDo"),
    },
  };
}
