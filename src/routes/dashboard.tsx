/**
 * BuildMyLogic - Learner Dashboard
 *
 * Central hub for the learner's journey: active missions, skill radar,
 * daily build rhythm scheduler (Google Calendar sync), and real-time telemetry.
 */

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import {
  ArrowRight,
  BarChart3,
  Play,
  BookOpen,
  Calendar,
  CheckCircle2,
  Folder,
  Lock,
  Rocket,
  Sparkles,
  Target,
  Terminal,
  TrendingUp,
  Clock,
  ExternalLink,
  Zap,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { emptyAf05, SKILL_LABELS, type SkillId } from "@/lib/af05/types";
import { getProject, recommendProjects } from "@/lib/af05/projects";
import {
  applyBuildSessionEvidence,
  applySarvamDashboardPlan,
  getLoopState,
  logActivity,
  setMissionProgress,
  useLoop,
} from "@/lib/loop-store";
import type { BuildSessionState } from "@/lib/loop-types";
import { aiRetunePlan } from "@/lib/sarvam.functions";
import { ScheduleModal, ScheduleSyncCard } from "@/components/ScheduleModal";
import { Af05Focus } from "@/components/Af05Focus";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard - BuildMyLogic" }] }),
  component: Dashboard,
});

/**
 * Calculates a friendly greeting based on local time
 */
function greeting() {
  const hour = new Date().getHours();
  return hour < 12
    ? "Good morning"
    : hour < 17
      ? "Good afternoon"
      : "Good evening";
}

function Dashboard() {
  const state = useLoop();
  const navigate = useNavigate();
  const plan = state.plan;
  const name = state.profile?.name?.trim() || "Builder";
  const missions = plan?.missions ?? [];
  const current =
    missions.find((m) => state.missionProgress[m.id]?.status === "active") ??
    missions[0];
  const currentIndex = Math.max(
    0,
    missions.findIndex((m) => m.id === current?.id),
  );
  const doneCount = missions.filter(
    (m) => state.missionProgress[m.id]?.status === "done",
  ).length;
  const currentSteps = current
    ? (state.missionProgress[current.id]?.completedSteps?.length ?? 0)
    : 0;
  const currentTotalSteps = current?.steps.length ?? 1;
  const goal = state.profile?.goal || "Build real-world skills";

  // Mockup metrics row - every value derives from live state. Competency
  // numbers come only from AF-05 evidence (practical + reassessment gates),
  // never from legacy plan percentages.
  const af05 = state.af05 ?? emptyAf05;
  const assessed = Object.values(af05.competencies).filter(
    (c): c is NonNullable<typeof c> => Boolean(c) && c.state !== "not_assessed",
  );
  const masteredSkills = assessed.filter((c) => c.state === "mastered").length;
  const avgEvidence =
    assessed.length > 0
      ? assessed.reduce((sum, c) => sum + c.score, 0) / assessed.length
      : 0;
  const currentLevel =
    assessed.length === 0
      ? "Not assessed"
      : avgEvidence < 34
        ? "Beginner"
        : avgEvidence < 67
          ? "Developing"
          : "Proficient";
  // Actual project workspaces started, not missions.
  const startedProjects = Object.keys(af05.projectProgress).length;
  const metrics = [
    {
      icon: BarChart3,
      tint: "bg-blue-50 text-blue-600",
      label: "Current Level",
      value: currentLevel,
      to: "/skill-analysis",
    },
    {
      icon: Zap,
      tint: "bg-emerald-50 text-emerald-600",
      label: "Skills Mastered",
      value:
        assessed.length === 0 ? "Not assessed" : `${masteredSkills} / 7`,
      to: "/skill-analysis",
    },
    {
      icon: Folder,
      tint: "bg-violet-50 text-violet-600",
      label: "Active Projects",
      value: String(startedProjects),
      to: "/projects",
    },
    {
      icon: Target,
      tint: "bg-sky-50 text-sky-600",
      label: "Plan Progress",
      value: missions.length > 0 ? `${doneCount} / ${missions.length}` : "0 / 0",
      to: "/learning-path",
    },
  ] as const;

  // Current Project: the learner's selected project workspace.
  const activeProject = af05.activeProjectId
    ? getProject(af05.activeProjectId)
    : undefined;
  const activeProgress = af05.activeProjectId
    ? af05.projectProgress[af05.activeProjectId]
    : undefined;
  const doneTasks = activeProgress
    ? Object.values(activeProgress.tasks).filter((t) => t.status === "done")
        .length
    : 0;
  const totalTasks = activeProject?.tasks.length ?? 0;
  const projectPct =
    totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  // Today's Focus: the plan's session tasks (real minutes from the planner).
  const focusTasks = (plan?.session.tasks ?? []).slice(0, 4);

  // Recommendations: rule-based engine output with explanations.
  const recommendations = recommendProjects(af05, 3);

  // Google Calendar scheduling modal state
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [showPromptBanner, setShowPromptBanner] = useState(false);
  const dashboardRetuneKey = useRef("");

  useEffect(() => {
    let cancelled = false;
    let since: number | null = null;
    const sleep = (ms: number) =>
      new Promise<void>((resolve) => window.setTimeout(resolve, ms));
    // Long-poll loop: hold the request until the session's `rev` changes (up
    // to 8s), so a finished/struggling build in VS Code retunes the dashboard
    // instantly instead of on a 5 second timer.
    const syncBuildSession = async () => {
      while (!cancelled) {
        try {
          const raw = window.localStorage.getItem("bml-vscode-session");
          const saved = raw
            ? (JSON.parse(raw) as { sessionId?: string })
            : null;
          if (!saved?.sessionId) {
            await sleep(5000);
            continue;
          }
          const params = new URLSearchParams({ wait: "8000" });
          if (since !== null) params.set("since", String(since));
          const response = await fetch(
            `/api/sessions/${encodeURIComponent(saved.sessionId)}/state?${params.toString()}`,
            { cache: "no-store" },
          );
          const result = (await response.json()) as {
            ok?: boolean;
            state?: BuildSessionState & { rev?: number };
          };
          if (cancelled) return;
          const remote = result.state;
          if (!response.ok || !result.ok || !remote) {
            await sleep(5000);
            continue;
          }
          const rev = typeof remote.rev === "number" ? remote.rev : null;
          if (rev !== null && rev === since) continue; // waited, no change yet
          since = rev;
          const shouldRetune =
            remote.status === "completed" ||
            remote.status === "failed" ||
            Boolean(remote.potential_struggle);
          if (!shouldRetune) continue;
          applyBuildSessionEvidence(remote);
          const key = `${remote.session_id}:${remote.status}:${remote.attempts}:${remote.test_score?.passed ?? 0}:${remote.potential_struggle ? "struggle" : "normal"}`;
          if (dashboardRetuneKey.current === key) continue;
          dashboardRetuneKey.current = key;
          const currentState = getLoopState();
          if (!currentState.profile || !currentState.plan) continue;
          void aiRetunePlan({
            data: {
              profile: currentState.profile,
              plan: currentState.plan,
              activity: currentState.activity,
            },
          })
            .then((suggested) => {
              applySarvamDashboardPlan(suggested);
              logActivity({
                kind: "ai",
                text:
                  remote.status === "completed"
                    ? "Vibe updated the dashboard after you proved the challenge."
                    : "Vibe updated the dashboard with a focused recovery path.",
              });
            })
            .catch(() => {
              // The deterministic dashboard adjustment remains available without Sarvam.
            });
        } catch {
          if (cancelled) return;
          // The Sessions page displays the actionable expired-session message.
          await sleep(5000);
        }
      }
    };
    void syncBuildSession();
    return () => {
      cancelled = true;
    };
  }, []);

  // Check if learner has booked a Google Calendar reminder recently
  useEffect(() => {
    const calendarPromptDismissed = window.sessionStorage.getItem(
      "bml-calendar-dismissed",
    );
    if (!calendarPromptDismissed && plan) {
      // Show subtle reminder banner to set their learning rhythm
      setShowPromptBanner(true);
    }
  }, [plan]);

  const dismissBanner = () => {
    setShowPromptBanner(false);
    window.sessionStorage.setItem("bml-calendar-dismissed", "1");
  };

  return (
    <AppShell
      crumb="Dashboard"
      title={`${greeting()}, ${name}.`}
      subtitle={plan?.headline ?? "Your next skill is waiting to be proven."}
      {...(plan?.quote ? { quote: plan.quote } : {})}
      wide
    >
      <Af05Focus />

      {/* Schedule & Google Calendar Modal */}
      <ScheduleModal
        isOpen={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
        {...(current?.title ? { missionTitle: current.title } : {})}
        {...(current?.description
          ? { missionDescription: current.description }
          : {})}
      />

      {!plan || !current ? (
        <section className="card-surface p-12 text-center">
          <Rocket className="mx-auto h-9 w-9 text-primary" />
          <h2 className="display mt-4 text-2xl font-bold">
            Your build path is waiting.
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Tell BuildMyLogic what you want to achieve and we'll build the path
            around it.
          </p>
          <Link
            to="/"
            className="btn-base btn-primary-solid mt-6 inline-flex items-center gap-2"
          >
            <span>Start onboarding</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      ) : (
        <>
          {/* Metrics row - design target: four live cards */}
          <section className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {metrics.map(({ icon: Icon, tint, label, value, to }) => (
              <Link
                key={label}
                to={to}
                className="card-surface flex items-center gap-3.5 px-4 py-4 transition-shadow hover:shadow-md"
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tint}`}
                >
                  <Icon className="h-5 w-5" strokeWidth={2} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[12px] font-medium leading-tight text-muted-foreground">
                    {label}
                  </span>
                  <span className="block text-[15px] font-bold leading-tight tracking-[-0.01em] sm:text-[17px]">
                    {value}
                  </span>
                </span>
              </Link>
            ))}
          </section>

          {/* Current Project + Today's Focus (design target two-column) */}
          <section className="mb-6 grid gap-4 lg:grid-cols-2">
            <div className="card-surface px-5 py-5">
              <div className="flex items-center justify-between">
                <h3 className="text-[15px] font-bold">Current Project</h3>
                <Link
                  to="/projects"
                  className="text-[12.5px] font-semibold text-primary hover:underline"
                >
                  View Projects
                </Link>
              </div>
              {activeProject ? (
                <div className="mt-4">
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                    {activeProgress?.completedAt ? "Completed" : "In Progress"}
                  </span>
                  <h4 className="mt-3 text-[19px] font-extrabold tracking-[-0.02em]">
                    {activeProject.name}
                  </h4>
                  <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-muted-foreground">
                    {activeProject.tagline}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {activeProject.tools.slice(0, 3).map((tool) => (
                      <span
                        key={tool}
                        className="rounded-full bg-muted px-2.5 py-1 text-[11.5px] font-medium text-muted-foreground"
                      >
                        {tool}
                      </span>
                    ))}
                  </div>
                  <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${projectPct}%` }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[12px] text-muted-foreground">
                    <span>
                      {doneTasks} of {totalTasks} tasks completed
                    </span>
                    <span className="font-semibold text-foreground">
                      {projectPct}%
                    </span>
                  </div>
                  <Link
                    to="/projects/$projectId"
                    params={{ projectId: activeProject.id }}
                    className="btn-base btn-primary-solid mt-4 inline-flex items-center gap-2"
                  >
                    <span>Continue Building</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-dashed border-border px-4 py-6 text-center">
                  <p className="text-[13.5px] font-medium">
                    No project selected yet.
                  </p>
                  <p className="mt-1 text-[12.5px] text-muted-foreground">
                    Pick a project to start building with real checkpoints.
                  </p>
                  <Link
                    to="/projects"
                    className="btn-base btn-primary-solid mt-4 inline-flex items-center gap-2"
                  >
                    <span>Choose a project</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              )}
            </div>

            <div className="card-surface px-5 py-5">
              <div className="flex items-center justify-between">
                <h3 className="text-[15px] font-bold">Today's Focus</h3>
                <span className="text-[12px] text-muted-foreground">
                  {new Date().toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
              {focusTasks.length > 0 ? (
                <ol className="mt-4 space-y-3.5">
                  {focusTasks.map((task, i) => (
                    <li key={task.title} className="flex items-center gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[12px] font-bold text-accent-foreground">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">
                        {task.title}
                      </span>
                      <span className="shrink-0 text-[12px] text-muted-foreground">
                        ~ {task.minutes} min
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-4 rounded-xl border border-dashed border-border px-4 py-6 text-center text-[12.5px] text-muted-foreground">
                  Finish onboarding and your daily plan appears here.
                </p>
              )}
              <Link
                to="/learn"
                className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-primary-soft px-4 py-3 text-[13.5px] font-bold text-accent-foreground transition-colors hover:bg-accent"
              >
                <Play className="h-4 w-4" />
                <span>Start Today's Plan</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </section>

          {/* Recommended for You (rule-based engine, real explanations) */}
          <section className="mb-6">
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-bold">Recommended for You</h3>
              <Link
                to="/projects"
                className="text-[12.5px] font-semibold text-primary hover:underline"
              >
                View All
              </Link>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {recommendations.map(({ project }) => (
                <Link
                  key={project.id}
                  to="/projects/$projectId"
                  params={{ projectId: project.id }}
                  className="card-surface group flex items-center gap-3.5 px-4 py-4 transition-shadow hover:shadow-md"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-accent-foreground">
                    <Folder className="h-5 w-5" strokeWidth={2} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold">
                      {project.name}
                    </span>
                    <span
                      className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        project.difficulty === "Beginner"
                          ? "bg-emerald-50 text-emerald-700"
                          : project.difficulty === "Advanced"
                            ? "bg-rose-50 text-rose-700"
                            : "bg-violet-50 text-violet-700"
                      }`}
                    >
                      {project.difficulty}
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </Link>
              ))}
            </div>
          </section>

          {/* Daily Build Rhythm Banner (Google Calendar reminder prompt) */}
          {showPromptBanner && (
            <div className="mb-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-primary/30 bg-primary-soft/50 p-4 shadow-sm backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-foreground">
                    Set your daily learning time
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Block {state.profile?.startTime || "19:00"} -{" "}
                    {state.profile?.endTime || "20:00"} on Google Calendar so
                    you never miss your build streak.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() => setScheduleModalOpen(true)}
                  className="btn-base btn-primary-solid text-xs py-2 px-3.5 flex items-center gap-1.5 font-bold shadow-sm"
                >
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Add to Google Calendar</span>
                </button>
                <button
                  type="button"
                  onClick={dismissBanner}
                  className="rounded-xl px-2.5 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* 6-Stage Pedagogical Loop Progress Tracker */}
          <section className="card-surface rise overflow-hidden">
            <div className="grid grid-cols-2 md:grid-cols-6">
              {["Learn", "Build", "Fail", "Understand", "Improve", "Loop"].map(
                (label, i) => (
                  <div
                    key={label}
                    className={`group relative border-r border-border/70 px-4 py-4 transition-colors last:border-r-0 ${
                      i === 0
                        ? "bg-gradient-to-b from-primary-soft/80 to-transparent"
                        : "hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold transition-colors ${
                          i === 0
                            ? "bg-primary text-primary-foreground shadow-sm shadow-primary/30"
                            : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-accent-foreground"
                        }`}
                      >
                        {i + 1}
                      </span>
                      <span className="text-xs font-bold">{label}</span>
                    </div>
                    <p className="mt-1 pl-9 text-[10px] leading-4 text-muted-foreground">
                      {
                        [
                          "Understand the concept",
                          "Write code",
                          "Face challenges",
                          "Get feedback",
                          "Fix & improve",
                          "Repeat & level up",
                        ][i]
                      }
                    </p>
                  </div>
                ),
              )}
            </div>
          </section>

          {/* Main Dashboard Grid */}
          <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-12">
            {/* Left Column - Current Mission & Skills */}
            <div className="space-y-5 lg:col-span-8">
              {/* Current Active Mission Card */}
              <section className="card-surface rise p-6">
                <div className="flex items-center justify-between">
                  <p className="eyebrow">Current Mission</p>
                  <span className="pill bg-primary-soft text-accent-foreground flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> Recommended for you
                  </span>
                </div>

                <div className="mt-5 flex items-start gap-5">
                  <div className="flex h-[74px] w-[74px] shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/20">
                    <Terminal className="h-8 w-8 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="display text-2xl font-bold">
                      {current.title}
                    </h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {current.stack} <span className="mx-1">•</span> Difficulty{" "}
                      {current.difficulty} <span className="mx-1">•</span> ~
                      {current.minutes} mins
                    </p>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                      {current.description}
                    </p>
                  </div>
                </div>

                <div className="mt-5">
                  <p className="text-[11px] font-semibold text-muted-foreground">
                    Skills you'll practice
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {current.skills.map((skill) => (
                      <span
                        key={skill}
                        className="rounded-lg border border-border/70 bg-muted/60 px-2.5 py-1.5 text-xs font-medium transition-colors hover:border-primary/40 hover:bg-primary-soft"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-4">
                  <button
                    type="button"
                    className="group inline-flex items-center gap-1.5 text-xs font-semibold text-accent-foreground hover:text-primary transition-colors"
                    onClick={() => {
                      setMissionProgress(current.id, { status: "active" });
                      void navigate({ to: "/learn" });
                    }}
                  >
                    <BookOpen className="h-4 w-4" />
                    <span>Need to learn something?</span>
                    <span className="font-bold underline">
                      Learn for this mission →
                    </span>
                  </button>
                  <button
                    type="button"
                    className="btn-base btn-ink"
                    onClick={() => {
                      window.localStorage.setItem(
                        "loop-auto-start-session",
                        "1",
                      );
                      void navigate({ to: "/sessions" });
                    }}
                  >
                    <Terminal className="h-4 w-4" />
                    <span>Start building</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </section>

              {/* Skills Radar & Recent Activity */}
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <section className="card-surface p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-sm font-bold">Your Skills</h3>
                    <Link
                      to="/skills"
                      className="text-xs font-semibold text-accent-foreground hover:underline"
                    >
                      View all →
                    </Link>
                  </div>
                  <div className="space-y-3.5">
                    {(plan.skills ?? []).slice(0, 5).map((s) => (
                      <div
                        key={s.name}
                        className="flex items-center gap-3 text-xs"
                      >
                        <span className="w-28 truncate font-medium">
                          {s.name}
                        </span>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-1.5 rounded-full bg-gradient-to-r from-primary to-accent transition-[width] duration-700 ease-out"
                            style={{ width: `${s.level}%` }}
                          />
                        </div>
                        <span className="w-8 text-right text-[11px] font-semibold">
                          {s.level}%
                        </span>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="card-surface p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-sm font-bold">Recent Activity</h3>
                    <TrendingUp className="h-4 w-4 text-primary" />
                  </div>
                  {state.activity.length === 0 ? (
                    <p className="text-xs leading-5 text-muted-foreground">
                      Finish a session and your real build history will appear
                      here.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {state.activity.slice(0, 4).map((a) => (
                        <div
                          key={a.at}
                          className="border-l-2 border-primary pl-3"
                        >
                          <p className="text-xs font-medium">{a.text}</p>
                          <p className="mt-0.5 text-[10px] text-muted-foreground">
                            {new Date(a.at).toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </div>

            {/* Right Column - Calendar Rhythm & Insights */}
            <aside className="space-y-5 lg:col-span-4">
              {/* Daily Build Rhythm Quick Sync Card */}
              <ScheduleSyncCard
                onOpenModal={() => setScheduleModalOpen(true)}
              />

              {/* Learning Flow Progress */}
              <section className="card-surface p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold">Your Learning Flow</h3>
                  <span className="text-xs font-bold text-primary">
                    {current
                      ? `${Math.min(
                          4,
                          2 +
                            (currentSteps > 0 ? 1 : 0) +
                            (doneCount > 0 ? 1 : 0),
                        )} / 4`
                      : "0 / 4"}
                  </span>
                </div>
                <div className="mt-5 space-y-4">
                  {[
                    ["Onboarding", "Completed"],
                    ["Personalized Path", plan ? "Ready" : "Waiting"],
                    [
                      "Build & Learn",
                      current
                        ? `${currentSteps}/${currentTotalSteps} mission steps`
                        : "Waiting",
                    ],
                    [
                      "Prove & Grow",
                      `${doneCount}/${missions.length} missions completed`,
                    ],
                  ].map(([t, s], i) => (
                    <div key={t} className="flex items-start gap-3">
                      <span
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                          i < 2
                            ? "border-ink bg-ink text-white"
                            : i === 2
                              ? "border-primary text-primary"
                              : "border-border"
                        }`}
                      >
                        {i < 2 ? (
                          <CheckCircle2 className="h-3 w-3 text-white" />
                        ) : i === 2 ? (
                          <span className="h-2 w-2 rounded-full bg-primary" />
                        ) : null}
                      </span>
                      <div>
                        <p className="text-xs font-semibold">{t}</p>
                        <p className="text-[11px] text-muted-foreground">{s}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* AI Insight Card */}
              <section className="card-surface p-5">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-bold">BuildMyLogic Insight</h3>
                  <span className="pill bg-primary-soft text-accent-foreground text-[10px]">
                    AI
                  </span>
                </div>
                <p className="mt-3 text-xs leading-5 text-muted-foreground">
                  {plan.progress.insights?.[0] ??
                    `Your path is optimized for ${goal}. Each mission produces verifiable proof that you can architect, test, and ship.`}
                </p>
                <div className="mt-3 rounded-xl bg-primary-soft px-3 py-2.5 text-xs font-bold">
                  Next adaptive task: {current?.title ?? "Start a mission"}
                </div>
              </section>

              {/* Next Upcoming Missions */}
              <section className="card-surface p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-bold">Next Missions</h3>
                  <Link
                    to="/missions"
                    className="text-xs font-semibold text-accent-foreground hover:underline"
                  >
                    View all →
                  </Link>
                </div>
                {missions.slice(currentIndex + 1, currentIndex + 4).map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center gap-3 border-t border-border py-3"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold">
                        {m.title}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {m.stack} · Difficulty {m.difficulty}
                      </p>
                    </div>
                  </div>
                ))}
                <p className="mt-2 text-[10px] text-muted-foreground">
                  {doneCount} of {missions.length} missions completed
                </p>
              </section>
            </aside>
          </div>
        </>
      )}
    </AppShell>
  );
}
