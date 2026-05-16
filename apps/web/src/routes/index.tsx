import { createFileRoute, redirect } from "@tanstack/react-router";
import { buildPageHead } from "../lib/seo";

export const Route = createFileRoute("/")({
  head: () => buildPageHead("schedule"),
  beforeLoad: () => {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- TanStack Router redirect pattern
    throw redirect({
      to: "/step/term",
    });
  },
});
