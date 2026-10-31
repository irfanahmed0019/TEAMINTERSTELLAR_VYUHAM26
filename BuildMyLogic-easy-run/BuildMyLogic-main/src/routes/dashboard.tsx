import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Convenience alias: learners naturally type /dashboard.
 * The real dashboard lives at /auth/dashboard — redirect there,
 * including on direct loads and refreshes (runs on the server too).
 */
export const Route = createFileRoute("/dashboard")({
  beforeLoad: () => {
    throw redirect({ to: "/auth/dashboard" });
  },
});
