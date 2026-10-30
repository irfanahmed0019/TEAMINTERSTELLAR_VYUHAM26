/**
 * Projects page (kernel section 8): personalised recommendations from the
 * student's competency profile, category browsing and jargon-free cards.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Bug, Clock3, ListChecks, Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { DemoProjects } from "@/components/demo/DemoScreens";
import { DEMO_MODE } from "@/lib/demo-mode";
import { useLoop } from "@/lib/loop-store";
import { emptyAf05, SKILL_LABELS } from "@/lib/af05/types";
import {
  PROJECTS,
  PROJECT_CATEGORIES,
  recommendProjects,
} from "@/lib/af05/projects";

export const Route = createFileRoute("/projects")({
  head: () => ({ meta: [{ title: "Projects - BuildMyLogic" }] }),
  component: ProjectsRoute,
});

function ProjectsRoute() {
  if (DEMO_MODE) return <DemoProjects />;
  return <ProjectsPage />;
}

function ProjectsPage() {
  const af05 = useLoop().af05 ?? emptyAf05;
  const [category, setCategory] = useState<string>("all");
  const recommendations = recommendProjects(af05, 3);
  const recommendedIds = new Set(recommendations.map((r) => r.project.id));
  const hasProfile = af05.diagnostic.status === "completed";
  const visible = PROJECTS.filter(
    (p) => category === "all" || p.category === category,
  );

  return (
    <AppShell
      crumb="Projects"
      title="Projects"
      subtitle="Build real projects. Turn what you learn into real skills."
    >
      <section className="card-surface mb-6 p-6">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="flex-1">
            <h2 className="display text-lg font-bold">
              Not sure what to build?
            </h2>
            {hasProfile ? (
              <p className="mt-1 text-[14px] leading-6 text-muted-foreground">
                Based on your competency profile, these fit you best right now:
              </p>
            ) : (
              <p className="mt-1 text-[14px] leading-6 text-muted-foreground">
                Take the{" "}
                <Link
                  to="/assessment"
                  className="font-medium text-accent-foreground underline"
                >
                  skill assessment
                </Link>{" "}
                and recommendations will match your real gaps instead of
                guessing.
              </p>
            )}
            {hasProfile && (
              <div className="mt-4 space-y-3">
                {recommendations.map(({ project, reasons, missingSkills }) => (
                  <Link
                    key={project.id}
                    to="/projects/$projectId"
                    params={{ projectId: project.id }}
                    className="block rounded-xl border border-primary/20 bg-primary-soft/50 p-4 transition-colors hover:bg-primary-soft"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold">{project.name}</p>
                      <ArrowRight className="h-4 w-4 shrink-0 text-primary" />
                    </div>
                    <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
                      {reasons[0]}
                    </p>
                    {missingSkills.length > 0 && (
                      <p className="mt-1 text-[12px] text-amber-700">
                        Stretch area:{" "}
                        {missingSkills.map((s) => SKILL_LABELS[s]).join(", ")}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="mb-5 flex flex-wrap gap-2">
        {PROJECT_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategory(c.id)}
            className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
              category === c.id
                ? "bg-ink text-ink-foreground"
                : "border border-border bg-card text-muted-foreground hover:bg-muted"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((project) => (
          <Link
            key={project.id}
            to="/projects/$projectId"
            params={{ projectId: project.id }}
            className="card-surface card-hover flex flex-col p-5"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="rounded-full bg-primary-soft px-2.5 py-1 text-[12px] font-semibold text-accent-foreground">
                {project.difficulty}
              </span>
              {recommendedIds.has(project.id) && (
                <span className="rounded-full bg-success/15 px-2.5 py-1 text-[12px] font-semibold text-success">
                  Recommended for you
                </span>
              )}
            </div>
            <h3 className="display mt-3 text-lg font-bold">{project.name}</h3>
            <p className="mt-1 flex-1 text-[13px] leading-5 text-muted-foreground">
              {project.tagline}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {project.skillsPractised.map((s) => (
                <span
                  key={s}
                  className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                >
                  {SKILL_LABELS[s]}
                </span>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-4 border-t border-border pt-3 text-[12px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Clock3 className="h-3.5 w-3.5" /> ~{project.estimatedHours}h
              </span>
              <span className="inline-flex items-center gap-1">
                <ListChecks className="h-3.5 w-3.5" /> {project.tasks.length}{" "}
                tasks
              </span>
              <span className="ml-auto inline-flex items-center gap-1 font-medium text-accent-foreground">
                Open <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </div>
          </Link>
        ))}
      </div>

      <section className="card-surface mt-6 flex items-center gap-4 p-5">
        <Bug className="h-6 w-6 shrink-0 text-primary" />
        <div className="flex-1">
          <p className="font-semibold">Want quick practice instead?</p>
          <p className="text-[13px] text-muted-foreground">
            The Debug Lab gives you broken code to fix - a fast way to sharpen a
            weak skill between projects.
          </p>
        </div>
        <Link
          to="/debug"
          className="btn-base btn-primary-solid inline-flex items-center gap-2"
        >
          <span>Open Debug Lab</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </AppShell>
  );
}
