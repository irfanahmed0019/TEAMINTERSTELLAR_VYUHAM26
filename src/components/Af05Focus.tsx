/**
 * "Today's focus" card for the Home dashboard (kernel section 7): the single
 * next meaningful learning action decided by the orchestrator, plus due
 * reassessments. Additive to the approved dashboard - it replaces nothing.
 */
import { Link } from "@tanstack/react-router";
import { ArrowRight, BellRing, Compass } from "lucide-react";
import { useLoop } from "@/lib/loop-store";
import { decideNext, dueRevisions } from "@/lib/af05/engine";
import { emptyAf05, SKILL_LABELS } from "@/lib/af05/types";
import { getProject } from "@/lib/af05/projects";

const ACTION_LINKS: Record<string, { to: string; label: string }> = {
  select_goal: { to: "/assessment", label: "Choose your learning goal" },
  diagnostic: { to: "/assessment", label: "Continue diagnostic" },
  reassessment: { to: "/reassess", label: "Start reassessment" },
  targeted_practice: { to: "/practice", label: "Start targeted practice" },
  project_recommendation: {
    to: "/projects",
    label: "See recommended projects",
  },
  project_task: { to: "/projects", label: "Continue project" },
  explore: { to: "/projects", label: "Explore projects" },
};

export function Af05Focus() {
  const loop = useLoop();
  const af05 = loop.af05 ?? emptyAf05;
  const decision = decideNext(af05, Date.now(), { record: false });
  const due = dueRevisions(af05);
  const link = ACTION_LINKS[decision.type] ?? ACTION_LINKS["explore"]!;
  const project = decision.projectId
    ? getProject(decision.projectId)
    : undefined;
  const to =
    decision.type === "project_task" && project
      ? `/projects/${project.id}`
      : link.to;

  return (
    <section className="card-surface mb-6 flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-soft">
        <Compass className="h-5 w-5 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="eyebrow mb-1">Today's focus</p>
        <p className="text-[15px] font-semibold leading-6">
          {project ? `${link.label}: ${project.name}` : link.label}
          {decision.skill ? ` - ${SKILL_LABELS[decision.skill]}` : ""}
        </p>
        <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
          {decision.reason}
        </p>
        {due.length > 0 && (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[12px] font-medium text-amber-800">
            <BellRing className="h-3.5 w-3.5" />
            {due.length} reassessment{due.length > 1 ? "s" : ""} due - delayed
            recall is what proves retention
          </p>
        )}
      </div>
      <Link
        to={to}
        className="btn-base btn-primary-solid inline-flex shrink-0 items-center gap-2"
      >
        <span>Start</span>
        <ArrowRight className="h-4 w-4" />
      </Link>
    </section>
  );
}
