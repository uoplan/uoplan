import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { CalendarPage } from "../../components/calendar/CalendarPage";
import { navigateToWizardStep } from "../../lib/appNavigation";
import { WizardStep } from "../../lib/wizardSteps";

export const Route = createFileRoute("/calendar/basic")({
  component: BasicCalendarRoute,
});

function BasicCalendarRoute() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      style={{ width: "100%", minHeight: "100vh" }}
    >
      <CalendarPage variant="basic" onBack={() => navigateToWizardStep(WizardStep.Mode)} />
    </motion.div>
  );
}
