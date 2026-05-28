import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/schedule/step/options")({
  beforeLoad: ({ search }) => {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- TanStack Router redirect pattern
    throw redirect({ to: "/schedule/options", search });
  },
});
