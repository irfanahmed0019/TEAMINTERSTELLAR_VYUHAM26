import { createFileRoute } from "@tanstack/react-router";
import { ConversationalOnboarding } from "@/components/ConversationalOnboarding";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BuildMyLogic — Start building" },
      { name: "description", content: "A personalized, practical learning path powered by adaptive guidance and real project work." },
    ],
  }),
  component: ConversationalOnboarding,
});
