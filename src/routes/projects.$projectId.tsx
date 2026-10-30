/**
 * Project workspace (kernel step 5): overview, milestones, tasks and the
 * code workspace. Practical tasks execute real tests in the browser runner;
 * the Assessment Agent reviews submissions against that execution evidence;
 * the Orchestrator records the next intervention when work completes.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Lightbulb,
  Loader2,
  Lock,
  Play,
  Wrench,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useLoop } from "@/lib/loop-store";
import {
  emptyAf05,
  SKILL_LABELS,
  type AssessmentAgentResult,
} from "@/lib/af05/types";
import {
  getProject,
  getTask,
  nextTaskId,
  type ProjectTask,
} from "@/lib/af05/projects";
import {
  addHistory,
  decideNext,
  recordEvidence,
  recordMisconception,
  scheduleRevision,
} from "@/lib/af05/engine";
import {
  runPractical,
  practicalWeight,
  type RunResult,
} from "@/lib/af05/sandbox";
import { getAf05, updateAf05 } from "@/lib/af05/store";
import { af05AssessSubmission } from "@/lib/af05/assessment.functions";
import { useAuth } from "@/lib/auth";
import { logActivity } from "@/lib/loop-store";

export const Route = createFileRoute("/projects/$projectId")({
  head: () => ({ meta: [{ title: "Project workspace - BuildMyLogic" }] }),
  component: ProjectWorkspace,
});

function ProjectWorkspace() {
  const { projectId } = Route.useParams();
  useLoop();
  const project = getProject(projectId);
  if (!project) {
    return (
      <AppShell
        crumb="Projects"
        title="Project not found."
        subtitle="That project does not exist."
      >
        <Link
          to="/projects"
          className="btn-base btn-primary-solid inline-flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" /> Back to projects
        </Link>
      </AppShell>
    );
  }
  return <WorkspaceBody key={project.id} projectId={project.id} />;
}

function WorkspaceBody({ projectId }: { projectId: string }) {
  const auth = useAuth();
  const project = getProject(projectId)!;
  const af05 = getAf05();
  const progress = af05.projectProgress[projectId];
  const isActive = af05.activeProjectId === projectId;
  const [stepNote, setStepNote] = useState("");
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  const startProject = () => {
    updateAf05((s) => {
      s.activeProjectId = projectId;
      if (!s.projectProgress[projectId]) {
        s.projectProgress[projectId] = { startedAt: Date.now(), tasks: {} };
      }
      const next = nextTaskId(project, s.projectProgress[projectId].tasks);
      if (next) {
        s.projectProgress[projectId].tasks[next] = {
          status: "active",
          attempts: 0,
        };
      }
      decideNext(s, Date.now(), { record: true });
    });
    logActivity({ kind: "mission", text: `Started project: ${project.name}` });
  };

  const openTask = (taskId: string) => {
    setOpenTaskId(taskId === openTaskId ? null : taskId);
  };

  return (
    <AppShell
      crumb="Project workspace"
      title={project.name}
      subtitle={project.tagline}
      wide
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div>
          {!isActive && (
            <section className="card-surface mb-5 p-6">
              <h2 className="display text-xl font-bold">What you will build</h2>
              <p className="mt-2 text-[14px] leading-6 text-muted-foreground">
                {project.overview}
              </p>
              <h3 className="mt-4 text-[14px] font-semibold">
                Why this project matters
              </h3>
              <p className="mt-1 text-[14px] leading-6 text-muted-foreground">
                {project.whyItMatters}
              </p>
              <button
                type="button"
                onClick={startProject}
                className="btn-base btn-primary-solid mt-5 inline-flex items-center gap-2"
              >
                <Play className="h-4 w-4" /> Start this project
              </button>
            </section>
          )}

          {project.milestones.map((milestone, mi) => (
            <section key={milestone.id} className="card-surface mb-4 p-6">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-soft text-[13px] font-bold text-accent-foreground">
                  {mi + 1}
                </span>
                <div>
                  <h3 className="font-semibold">{milestone.title}</h3>
                  <p className="text-[13px] text-muted-foreground">
                    {milestone.summary}
                  </p>
                </div>
              </div>
              <div className="mt-4 space-y-2.5">
                {milestone.taskIds.map((taskId) => {
                  const task = getTask(project, taskId)!;
                  return (
                    <TaskRow
                      key={taskId}
                      projectId={projectId}
                      task={task}
                      open={openTaskId === taskId}
                      onToggle={() => openTask(taskId)}
                      signedIn={Boolean(auth)}
                      stepNote={stepNote}
                      setStepNote={setStepNote}
                    />
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <aside className="space-y-4">
          <section className="card-surface p-5">
            <h3 className="text-[14px] font-semibold">
              Skills you will practise
            </h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {project.skillsPractised.map((s) => (
                <span
                  key={s}
                  className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                >
                  {SKILL_LABELS[s]}
                </span>
              ))}
            </div>
            <h3 className="mt-4 text-[14px] font-semibold">Required tools</h3>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {project.tools.join(", ")}
            </p>
            <h3 className="mt-4 text-[14px] font-semibold">Prerequisites</h3>
            <ul className="mt-1 list-disc pl-5 text-[13px] leading-6 text-muted-foreground">
              {project.prerequisites.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            <h3 className="mt-4 text-[14px] font-semibold">
              Completion criteria
            </h3>
            <p className="mt-1 text-[13px] leading-6 text-muted-foreground">
              Every practical task passes its real tests, and each build step
              has a short note about what you made. Finishing tasks grows your
              competency evidence - it never grants mastery by itself.
            </p>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}

function TaskRow({
  projectId,
  task,
  open,
  onToggle,
  signedIn,
  stepNote,
  setStepNote,
}: {
  projectId: string;
  task: ProjectTask;
  open: boolean;
  onToggle: () => void;
  signedIn: boolean;
  stepNote: string;
  setStepNote: (v: string) => void;
}) {
  const af05 = getAf05();
  const project = getProject(projectId)!;
  const progress = af05.projectProgress[projectId];
  const taskState = progress?.tasks[task.id];
  const currentNext = progress
    ? nextTaskId(project, progress.tasks)
    : project.tasks[0]?.id;
  const locked =
    Boolean(progress) &&
    task.id !== currentNext &&
    taskState?.status !== "done";
  const done = taskState?.status === "done";

  return (
    <div
      className={`rounded-xl border ${done ? "border-success/30 bg-success/5" : "border-border"}`}
    >
      <button
        type="button"
        onClick={onToggle}
        disabled={locked}
        className="flex w-full items-center gap-3 px-4 py-3 text-left disabled:opacity-60"
      >
        {done ? (
          <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
        ) : locked ? (
          <Lock className="h-5 w-5 shrink-0 text-muted-foreground" />
        ) : (
          <Circle className="h-5 w-5 shrink-0 text-primary" />
        )}
        <div className="flex-1">
          <p className="text-[14px] font-medium">{task.title}</p>
          <p className="text-[12px] text-muted-foreground">
            {task.kind === "practical"
              ? "Code task - real tests"
              : "Build step"}{" "}
            - {task.skills.map((s) => SKILL_LABELS[s]).join(", ")}
          </p>
        </div>
        {task.kind === "step" && (
          <Wrench className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {open && !locked && (
        <div className="border-t border-border px-4 py-4">
          <p className="text-[14px] leading-6 text-muted-foreground">
            {task.detail}
          </p>
          {task.kind === "practical" && task.practical ? (
            <PracticalRunner
              projectId={projectId}
              task={task}
              signedIn={signedIn}
            />
          ) : (
            <div className="mt-3">
              <textarea
                value={stepNote}
                onChange={(e) => setStepNote(e.target.value)}
                rows={2}
                placeholder="One or two lines: what did you build or decide here?"
                className="w-full rounded-xl border border-border bg-background p-3 text-[13px] outline-none focus:border-primary"
              />
              <button
                type="button"
                disabled={stepNote.trim().length < 10}
                onClick={() => {
                  updateAf05((s) => {
                    const prog = s.projectProgress[projectId];
                    if (!prog) return;
                    prog.tasks[task.id] = {
                      status: "done",
                      completedAt: Date.now(),
                      note: stepNote.trim(),
                      attempts: (prog.tasks[task.id]?.attempts ?? 0) + 1,
                    };
                    const next = nextTaskId(project, prog.tasks);
                    if (next)
                      prog.tasks[next] = { status: "active", attempts: 0 };
                    else prog.completedAt = Date.now();
                    addHistory(s, {
                      at: Date.now(),
                      kind: "project_task",
                      skill: task.skills[0] ?? "javascript",
                      result: "pass",
                      detail: `Build step "${task.title}" completed: ${stepNote.trim().slice(0, 120)}`,
                    });
                    decideNext(s, Date.now(), { record: true });
                  });
                  logActivity({
                    kind: "mission",
                    text: `Completed: ${task.title}`,
                  });
                  setStepNote("");
                }}
                className="btn-base btn-primary-solid mt-3 inline-flex items-center gap-2 disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" /> Mark done with note
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PracticalRunner({
  projectId,
  task,
  signedIn,
}: {
  projectId: string;
  task: ProjectTask;
  signedIn: boolean;
}) {
  const spec = task.practical!;
  const [code, setCode] = useState(spec.starterCode);
  const [running, setRunning] = useState(false);
  const [review, setReview] = useState<AssessmentAgentResult | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [hintsShown, setHintsShown] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setRunning(true);
    setError(null);
    setReview(null);
    const attempt = attempts + 1;
    setAttempts(attempt);
    try {
      const run = await runPractical(code, spec);
      setResult(run);
      if (run.error) return;

      // Deterministic evidence first - it stands even if the AI review fails.
      const weight = practicalWeight(run.passed, run.total);
      const allPassed = run.passed === run.total;

      let agentReview: AssessmentAgentResult | null = null;
      if (signedIn) {
        try {
          agentReview = await af05AssessSubmission({
            data: {
              skill: task.skills[0] ?? "javascript",
              concept: task.title,
              instructions: spec.instructions,
              code,
              testsPassed: run.passed,
              testsTotal: run.total,
              failures: run.failures.map((f) => ({
                expected: f.expected,
                received: f.received,
              })),
              attempts: attempt,
              hintsUsed: hintsShown,
            },
          });
          setReview(agentReview);
        } catch {
          // The execution result above remains the source of truth.
        }
      }

      const misconception =
        agentReview?.misconception ??
        (!allPassed
          ? {
              id: `task_${task.id}_gap`,
              label: `Implementation of "${task.title}" does not pass its tests yet`,
              severity: "medium" as const,
            }
          : undefined);

      updateAf05((s) => {
        const prog = s.projectProgress[projectId];
        if (!prog) return;
        prog.tasks[task.id] = {
          ...prog.tasks[task.id],
          status: prog.tasks[task.id]?.status === "done" ? "done" : "active",
          attempts: attempt,
          lastTestScore: { passed: run.passed, total: run.total },
        };

        recordEvidence(s, task.skills[0] ?? "javascript", {
          at: Date.now(),
          kind: "project_task",
          summary: `Project task "${task.title}": ${run.passed}/${run.total} tests passed (attempt ${attempt})`,
          weight,
          source: "execution",
        });
        if (agentReview) {
          recordEvidence(s, task.skills[0] ?? "javascript", {
            at: Date.now(),
            kind: "project_task",
            summary: `Assessment Agent review of "${task.title}": ${agentReview.score}/3 - ${agentReview.feedback.slice(0, 100)}`,
            weight: agentReview.score,
            source: "ai_rubric",
          });
        }
        if (misconception && !allPassed) {
          recordMisconception(
            s,
            task.skills[0] ?? "javascript",
            misconception,
            misconception.severity,
          );
          scheduleRevision(
            s,
            task.skills[0] ?? "javascript",
            task.title,
            misconception.id,
          );
        }
        addHistory(s, {
          at: Date.now(),
          kind: "project_task",
          skill: task.skills[0] ?? "javascript",
          result: allPassed ? "pass" : run.passed > 0 ? "partial" : "fail",
          detail: `${task.title}: ${run.passed}/${run.total} tests passed.`,
        });

        if (allPassed) {
          prog.tasks[task.id] = {
            ...prog.tasks[task.id],
            status: "done",
            completedAt: Date.now(),
            attempts: attempt,
            lastTestScore: { passed: run.passed, total: run.total },
          };
          const project = getProject(projectId)!;
          const next = nextTaskId(project, prog.tasks);
          if (next) prog.tasks[next] = { status: "active", attempts: 0 };
          else prog.completedAt = Date.now();
          decideNext(s, Date.now(), { record: true });
        }
      });
      if (allPassed) {
        logActivity({
          kind: "mission",
          text: `Passed: ${task.title} (${run.total}/${run.total} tests)`,
        });
      }
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="mt-3">
      <textarea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        rows={8}
        spellCheck={false}
        className="w-full rounded-xl border border-border bg-ink p-3.5 font-mono text-[13px] leading-6 text-ink-foreground outline-none focus:border-primary"
      />
      {spec.hints.length > 0 && hintsShown < spec.hints.length && (
        <button
          type="button"
          onClick={() => setHintsShown(hintsShown + 1)}
          className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-medium text-accent-foreground"
        >
          <Lightbulb className="h-4 w-4" /> Hint {hintsShown + 1}/
          {spec.hints.length}
        </button>
      )}
      {spec.hints.slice(0, hintsShown).map((hint, i) => (
        <p
          key={i}
          className="mt-2 rounded-lg bg-primary-soft px-3 py-2 text-[13px] text-accent-foreground"
        >
          {hint}
        </p>
      ))}
      {result && (
        <div
          className={`mt-3 rounded-xl border px-4 py-3 text-[13px] ${result.error || result.passed < result.total ? "border-amber-300 bg-amber-50 text-amber-900" : "border-success/30 bg-success/10 text-success"}`}
        >
          {result.error
            ? `Could not run: ${result.error}`
            : result.passed === result.total
              ? `All ${result.total} tests passed. Real execution evidence recorded.`
              : `${result.passed}/${result.total} tests passed. Failing case: expected ${JSON.stringify(result.failures[0]?.expected)}, got ${JSON.stringify(result.failures[0]?.received)}.`}
        </div>
      )}
      {review && (
        <div className="mt-3 rounded-xl border border-border bg-card px-4 py-3">
          <p className="text-[13px] font-semibold">
            Assessment Agent ({review.score}/3)
          </p>
          <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
            {review.feedback}
          </p>
          {review.improvements.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-[12px] leading-5 text-muted-foreground">
              {review.improvements.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {error && <p className="mt-2 text-[13px] text-destructive">{error}</p>}
      <button
        type="button"
        disabled={running}
        onClick={() => void submit()}
        className="btn-base btn-primary-solid mt-3 inline-flex items-center gap-2 disabled:opacity-50"
      >
        {running ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Play className="h-4 w-4" />
        )}
        {running ? "Running tests..." : "Run tests & submit"}
      </button>
      <p className="mt-2 text-[12px] text-muted-foreground">
        Tests run for real in an isolated in-browser runner.{" "}
        {signedIn
          ? "The Assessment Agent reviews your approach against those results."
          : "Sign in for an Assessment Agent review of your approach."}
      </p>
    </div>
  );
}
