/**
 * Learning Path (kernel section 9): a personalised roadmap derived live from
 * competency state - never a static generated plan. It changes the moment
 * new assessment evidence lands.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  History,
  Loader,
  RotateCcw,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { DemoLearningPath } from "@/components/demo/DemoScreens";
import { DEMO_MODE } from "@/lib/demo-mode";
import { useLoop } from "@/lib/loop-store";
import { COMPETENCY_LABELS, emptyAf05, SKILL_LABELS } from "@/lib/af05/types";
import { GOAL_TRACKS } from "@/lib/af05/diagnostic";
import {
  dueRevisions,
  gapAnalysis,
  upcomingRevisions,
} from "@/lib/af05/engine";
import { getProject } from "@/lib/af05/projects";

export const Route = createFileRoute("/learning-path")({
  head: () => ({ meta: [{ title: "Learning Path - BuildMyLogic" }] }),
  component: LearningPathRoute,
});

function LearningPathRoute() {
  if (DEMO_MODE) return <DemoLearningPath />;
  return <LearningPathPage />;
}

function formatDue(dueAt: number): string {
  const ms = dueAt - Date.now();
  if (ms <= 0) return "due now";
  const hours = Math.round(ms / 3600000);
  if (hours < 24) return `due in ~${hours}h`;
  return `due in ~${Math.round(hours / 24)}d`;
}

function LearningPathPage() {
  const af05 = useLoop().af05 ?? emptyAf05;
  const track = GOAL_TRACKS.find((t) => t.id === af05.goalTrack);
  const gaps = gapAnalysis(af05);
  const due = dueRevisions(af05);
  const upcoming = upcomingRevisions(af05);
  const currentStage = gaps.find(
    (g) => g.state !== "proficient" && g.state !== "mastered",
  );
  const completed = gaps.filter(
    (g) => g.state === "proficient" || g.state === "mastered",
  );
  const upcomingSkills = currentStage
    ? gaps.slice(gaps.indexOf(currentStage) + 1)
    : [];
  const activeProject = af05.activeProjectId
    ? getProject(af05.activeProjectId)
    : undefined;

  if (!track) {
    return (
      <AppShell
        crumb="Learning Path"
        title="Learning Path"
        subtitle="Your roadmap appears here once you choose a goal."
      >
        <Link
          to="/assessment"
          className="btn-base btn-primary-solid inline-flex items-center gap-2"
        >
          Choose your learning goal <ArrowRight className="h-4 w-4" />
        </Link>
      </AppShell>
    );
  }

  return (
    <AppShell
      crumb="Learning Path"
      title={`Your ${track.label} path.`}
      subtitle="This roadmap is computed from your latest assessment evidence. It updates itself every time you build, pass or struggle."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card-surface p-6">
          <h2 className="display text-lg font-bold">Current stage</h2>
          {currentStage ? (
            <div className="mt-3 rounded-xl border border-primary/25 bg-primary-soft/60 p-4">
              <p className="font-semibold">{currentStage.label}</p>
              <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
                {currentStage.assessed
                  ? `Level: ${COMPETENCY_LABELS[currentStage.state]}. ${currentStage.activeMisconceptions.length > 0 ? `Watch out: ${currentStage.activeMisconceptions[0]?.label}.` : "Keep building evidence through real tasks."}`
                  : "Not assessed yet - the diagnostic will measure it."}
              </p>
              <Link
                to={currentStage.assessed ? "/projects" : "/assessment"}
                className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-accent-foreground"
              >
                {currentStage.assessed
                  ? "Practise with a project"
                  : "Assess this skill"}{" "}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : (
            <p className="mt-3 text-[14px] text-muted-foreground">
              Every skill on this track is proficient or better. Reassessments
              will keep retention honest.
            </p>
          )}

          <h2 className="display mt-6 text-lg font-bold">
            Completed competencies
          </h2>
          <div className="mt-3 space-y-2">
            {completed.length === 0 && (
              <p className="text-[13px] text-muted-foreground">
                Nothing here yet - proficiency needs practical evidence, not
                just quizzes.
              </p>
            )}
            {completed.map((g) => (
              <div
                key={g.skill}
                className="flex items-center gap-3 rounded-xl border border-success/25 bg-success/5 px-4 py-2.5"
              >
                <CheckCircle2 className="h-4.5 w-4.5 text-success" />
                <span className="text-[14px] font-medium">{g.label}</span>
                <span className="ml-auto text-[12px] text-muted-foreground">
                  {COMPETENCY_LABELS[g.state]}
                </span>
              </div>
            ))}
          </div>

          <h2 className="display mt-6 text-lg font-bold">Coming up</h2>
          <div className="mt-3 space-y-2">
            {upcomingSkills.map((g) => (
              <div
                key={g.skill}
                className="flex items-center gap-3 rounded-xl border border-border px-4 py-2.5"
              >
                <CircleDashed className="h-4.5 w-4.5 text-muted-foreground" />
                <span className="text-[14px] font-medium">{g.label}</span>
                <span className="ml-auto text-[12px] text-muted-foreground">
                  {g.assessed ? COMPETENCY_LABELS[g.state] : "Not assessed"}
                </span>
              </div>
            ))}
          </div>
        </section>

        <div className="space-y-6">
          <section className="card-surface p-6">
            <h2 className="display text-lg font-bold">Practical work</h2>
            {activeProject ? (
              <div className="mt-3 rounded-xl border border-border p-4">
                <p className="font-semibold">{activeProject.name}</p>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  {
                    Object.values(
                      af05.projectProgress[activeProject.id]?.tasks ?? {},
                    ).filter((t) => t.status === "done").length
                  }
                  {" / "}
                  {activeProject.tasks.length} tasks done
                </p>
                <Link
                  to="/projects/$projectId"
                  params={{ projectId: activeProject.id }}
                  className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-accent-foreground"
                >
                  Continue building <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ) : (
              <p className="mt-3 text-[13px] text-muted-foreground">
                No active project.{" "}
                <Link
                  to="/projects"
                  className="font-medium text-accent-foreground underline"
                >
                  Pick a recommended one
                </Link>{" "}
                - practical work is the strongest skill evidence.
              </p>
            )}
          </section>

          <section className="card-surface p-6">
            <h2 className="display text-lg font-bold">Revision schedule</h2>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Spaced reassessment (24h, then 3 days, then 7 days) checks that
              learning stuck. Reassessments use different-but-equivalent
              exercises.
            </p>
            <div className="mt-3 space-y-2">
              {due.length === 0 && upcoming.length === 0 && (
                <p className="text-[13px] text-muted-foreground">
                  No revisions scheduled. They appear automatically when a weak
                  spot or misconception is found.
                </p>
              )}
              {due.map((r) => (
                <Link
                  key={r.id}
                  to="/reassess"
                  className="flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5"
                >
                  <RotateCcw className="h-4.5 w-4.5 text-amber-700" />
                  <span className="text-[14px] font-medium text-amber-900">
                    {SKILL_LABELS[r.skill]} - {r.concept.replaceAll("_", " ")}
                  </span>
                  <span className="ml-auto text-[12px] font-semibold text-amber-800">
                    due now
                  </span>
                </Link>
              ))}
              {upcoming.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-3 rounded-xl border border-border px-4 py-2.5"
                >
                  <History className="h-4.5 w-4.5 text-muted-foreground" />
                  <span className="text-[14px] font-medium">
                    {SKILL_LABELS[r.skill]} - {r.concept.replaceAll("_", " ")}
                  </span>
                  <span className="ml-auto inline-flex items-center gap-1 text-[12px] text-muted-foreground">
                    <Loader className="h-3 w-3" /> {formatDue(r.dueAt)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
