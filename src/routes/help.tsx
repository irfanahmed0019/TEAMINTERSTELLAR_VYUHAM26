import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/help")({
  head: () => ({ meta: [{ title: "Help & Support - BuildMyLogic" }] }),
  component: HelpPage,
});

const FAQ = [
  {
    q: "How does BuildMyLogic measure my skills?",
    a: "Only from evidence: executed test results, scored diagnostic answers, project task outcomes and delayed reassessments. Completing a tutorial or one easy quiz never grants mastery.",
  },
  {
    q: "What is the difference between my score and mastery?",
    a: "Your evidence score summarises recent work. Mastery additionally requires passing a real code task and a delayed reassessment (24h / 3 days / 7 days later), so it reflects retention, not cramming.",
  },
  {
    q: "What does the AI Mentor (Vibe) do?",
    a: "Vibe gives hints and explains concepts based on your profile, current project and past mistakes. It guides you to the answer instead of doing the work for you.",
  },
  {
    q: "Is my code executed safely?",
    a: "Exercise code runs in an isolated in-browser runner on your own machine with network and storage access disabled, under a strict time limit. Only genuine test results are recorded as evidence.",
  },
  {
    q: "Where is my progress stored?",
    a: "In your account's private learner record (protected by per-user access rules) and cached on this device. Only you can read your data.",
  },
] as const;

function HelpPage() {
  return (
    <AppShell
      crumb="Help & Support"
      title="Help & Support."
      subtitle="Know your gaps. Build real projects. Prove your skills."
    >
      <div className="max-w-2xl space-y-3">
        {FAQ.map((item) => (
          <details key={item.q} className="card-surface group p-5">
            <summary className="cursor-pointer list-none text-[14px] font-semibold">
              {item.q}
            </summary>
            <p className="mt-2 text-[13px] leading-6 text-muted-foreground">
              {item.a}
            </p>
          </details>
        ))}
        <p className="pt-3 text-[13px] text-muted-foreground">
          Stuck on a concept? Ask the{" "}
          <Link
            to="/mentor"
            className="font-medium text-accent-foreground underline"
          >
            AI Mentor
          </Link>{" "}
          - it already knows your skill profile and recent mistakes.
        </p>
      </div>
    </AppShell>
  );
}
