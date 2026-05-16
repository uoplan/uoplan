import { createFileRoute, notFound } from "@tanstack/react-router";
import { WizardPage } from "../../components/wizard/WizardPage";
import { slugToWizardStep } from "../../lib/wizardStepSlugs";

export const Route = createFileRoute("/step/$stepSlug")({
  beforeLoad: ({ params }) => {
    if (slugToWizardStep(params.stepSlug) === null) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- TanStack Router notFound pattern
      throw notFound();
    }
  },
  component: StepWizardRoute,
});

function StepWizardRoute() {
  const { stepSlug } = Route.useParams();
  return <WizardPage stepSlug={stepSlug} />;
}
