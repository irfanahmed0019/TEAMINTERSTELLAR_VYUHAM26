/**
 * BuildMyLogic — Learner Dashboard
 *
 * Central hub for the learner's journey: daily build rhythm scheduler
 * (Google Calendar sync), the 6-stage learning loop, the current task,
 * real progress, and the learning path timeline.
 */

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import {
  ArrowRight,
  Calendar,
  Check,
  Code2,
  Rocket,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { applyBuildSessionEvidence, applySarvamDashboardPlan, getLoopState, logActivity, setMissionProgress, useLoop } from "@/lib/loop-store";
import type { BuildSessionState } from "@/lib/loop-types";
import { aiRetunePlan } from "@/lib/sarvam.functions";
import { ScheduleModal } from "@/components/ScheduleModal";

export const Route = createFileRoute("/auth/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — BuildMyLogic" }] }),
  component: Dashboard,
});

/**
 * Calculates a friendly greeting based on local time
 */
function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

const LOOP_STEPS: [string, string][] = [
  ["Learn", "Understand the concept"],
  ["Build", "Write code"],
  ["Fail", "Face challenges"],
  ["Understand", "Get feedback"],
  ["Improve", "Fix & improve"],
  ["Loop", "Repeat & level up"],
];

function Dashboard() {
  const state = useLoop();
  const navigate = useNavigate();
  const plan = state.plan;
  const name = state.profile?.name?.trim() || "Builder";
  const missions = plan?.missions ?? [];
  const current = missions.find((m) => state.missionProgress[m.id]?.status === "active") ?? missions[0];
  const doneCount = missions.filter((m) => state.missionProgress[m.id]?.status === "done").length;
  const pct = missions.length ? Math.round((doneCount / missions.length) * 100) : 0;
  const doneMissions = missions.filter((m) => state.missionProgress[m.id]?.status === "done");
  const nextMission = current ? missions[missions.findIndex((m) => m.id === current.id) + 1] : undefined;

  // Google Calendar scheduling modal state
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [showPromptBanner, setShowPromptBanner] = useState(false);
  const dashboardRetuneKey = useRef("");

  useEffect(() => {
    let cancelled = false;
    const syncBuildSession = async () => {
      const raw = window.localStorage.getItem("bml-vscode-session");
      if (!raw) return;
      try {
        const saved = JSON.parse(raw) as { sessionId?: string };
        if (!saved.sessionId) return;
        const response = await fetch(`/api/sessions/${encodeURIComponent(saved.sessionId)}/state`, { cache: "no-store" });
        if (!response.ok) return;
        const result = await response.json() as { ok?: boolean; state?: BuildSessionState };
        const remote = result.state;
        if (cancelled || !result.ok || !remote) return;
        const shouldRetune = remote.status === "completed" || remote.status === "failed" || Boolean(remote.potential_struggle);
        if (!shouldRetune) return;
        applyBuildSessionEvidence(remote);
        const key = `${remote.session_id}:${remote.status}:${remote.attempts}:${remote.test_score?.passed ?? 0}:${remote.potential_struggle ? "struggle" : "normal"}`;
        if (dashboardRetuneKey.current === key) return;
        dashboardRetuneKey.current = key;
        const currentState = getLoopState();
        if (!currentState.profile || !currentState.plan) return;
        void aiRetunePlan({ data: { profile: currentState.profile, plan: currentState.plan, activity: currentState.activity } }).then((suggested) => {
          applySarvamDashboardPlan(suggested);
          logActivity({ kind: "ai", text: remote.status === "completed" ? "BuildMyLogic Mentor updated the dashboard after you proved the challenge." : "BuildMyLogic Mentor updated the dashboard with a focused recovery path." });
        }).catch(() => {
          // The deterministic dashboard adjustment remains available without AI provider.
        });
      } catch {
        // The Sessions page displays the actionable expired-session message.
      }
    };
    void syncBuildSession();
    const timer = window.setInterval(() => void syncBuildSession(), 5000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, []);

  // Check if learner has booked a Google Calendar reminder recently
  useEffect(() => {
    const calendarPromptDismissed = window.sessionStorage.getItem("bml-calendar-dismissed");
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
      subtitle={plan ? `Let's continue your ${state.profile?.goal || plan.projectTitle} journey.` : "Your next skill is waiting to be proven."}
      quote={plan?.quote ?? "Small steps every day build big skills."}
      wide
    >
      {/* Schedule & Google Calendar Modal */}
      <ScheduleModal
        isOpen={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
        missionTitle={current?.title}
        missionDescription={current?.description}
      />

      {!plan || !current ? (
        <section className="card-surface p-12 text-center">
          <Rocket className="mx-auto h-9 w-9 text-primary" />
          <h2 className="display mt-4 text-2xl font-bold">Your build path is waiting.</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Tell BuildMyLogic what you want to achieve and we'll build the path around it.
          </p>
          <Link to="/" className="btn-base btn-primary-solid mt-6 inline-flex items-center gap-2">
            <span>Start onboarding</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      ) : (
        <>
          {/* Daily Build Rhythm Banner (Google Calendar reminder prompt) */}
          {showPromptBanner && (
            <div className="mb-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl bg-primary-soft/60 p-4 sm:px-5">
              <div className="flex items-center gap-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-[15px] font-bold text-foreground">Set your daily learning time</h4>
                  <p className="mt-0.5 text-[13px] text-muted-foreground">
                    Block {state.profile?.startTime || "19:00"} – {state.profile?.endTime || "21:00"} on Google Calendar so you never miss your build streak.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() => setScheduleModalOpen(true)}
                  className="btn-base btn-primary-solid rounded-full text-xs py-2.5 px-4 flex items-center gap-1.5 font-bold"
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
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {LOOP_STEPS.map(([label, caption], i) => (
              <div
                key={label}
                className={`rounded-2xl border px-4 py-4 ${i === 0 ? "border-primary/20 bg-primary-soft" : "border-border bg-card"}`}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                      i === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="text-[13px] font-bold">{label}</span>
                </div>
                <p className="mt-1.5 text-[11px] leading-4 text-muted-foreground">{caption}</p>
              </div>
            ))}
          </section>

          {/* Current Task + Your Progress */}
          <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-12">
            <section className="card-surface p-6 sm:p-7 lg:col-span-7">
              <div className="flex h-full flex-col justify-between gap-6 sm:flex-row sm:items-center">
                <div className="min-w-0">
                  <span className="pill bg-primary-soft text-accent-foreground">Current Task</span>
                  <h2 className="display mt-4 text-[24px] font-extrabold leading-tight tracking-[-0.02em]">{current.title}</h2>
                  <p className="mt-2 max-w-md text-[14px] leading-6 text-muted-foreground">{current.description}</p>
                  <button
                    type="button"
                    className="btn-base btn-primary-solid mt-6"
                    onClick={() => {
                      setMissionProgress(current.id, { status: "active" });
                      window.localStorage.setItem("loop-auto-start-session", "1");
                      void navigate({ to: "/sessions" });
                    }}
                  >
                    <span>Start Task</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
                <div className="relative hidden h-36 w-44 shrink-0 items-center justify-center sm:flex">
                  <div className="absolute inset-0 rounded-full bg-primary-soft" />
                  <div className="relative flex h-24 w-32 items-center justify-center rounded-2xl border border-primary/20 bg-card shadow-sm">
                    <Code2 className="h-10 w-10 text-primary" />
                  </div>
                </div>
              </div>
            </section>

            <section className="card-surface p-6 lg:col-span-5">
              <div className="flex items-center justify-between">
                <h3 className="text-[16px] font-extrabold">Your Progress</h3>
                <span className="display text-[22px] font-black">{pct}%</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
              </div>
              <div className="mt-4 space-y-2">
                {doneMissions.slice(-1).map((m) => (
                  <div key={m.id} className="flex items-center gap-3 rounded-xl bg-emerald-50 px-3.5 py-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white"><Check className="h-3 w-3" strokeWidth={3.2} /></span>
                    <p className="truncate text-[13px] font-semibold">{m.title}</p>
                  </div>
                ))}
                <div className="flex items-center gap-3 rounded-xl bg-primary-soft px-3.5 py-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-card" />
                  <p className="truncate text-[13px] font-semibold">
                    {current.title} <span className="font-bold text-accent-foreground">(Current)</span>
                  </p>
                </div>
                {nextMission && (
                  <div className="flex items-center gap-3 px-3.5 py-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-border" />
                    <p className="truncate text-[13px] font-medium text-muted-foreground">Next: {nextMission.title}</p>
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Learning Path Timeline */}
          <section className="card-surface mt-5 p-6 sm:p-7">
            <div className="flex items-center justify-between gap-3">
              <h3 className="display text-[19px] font-extrabold tracking-[-0.02em]">
                Your Learning Path – {plan.projectTitle}
              </h3>
              <button
                type="button"
                onClick={() => void navigate({ to: "/missions" })}
                className="shrink-0 text-[13px] font-bold text-accent-foreground hover:text-primary"
              >
                View Full Path →
              </button>
            </div>
            <div className="mt-8 overflow-x-auto pb-2">
              <div className="flex min-w-[640px] items-start">
                {missions.slice(0, 9).map((mission, index) => {
                  const status = state.missionProgress[mission.id]?.status ?? (index === 0 ? "active" : "locked");
                  const isCurrent = mission.id === current.id;
                  const isDone = status === "done";
                  const last = index === Math.min(9, missions.length) - 1;
                  return (
                    <div key={mission.id} className="flex flex-1 flex-col items-center text-center">
                      <div className="flex w-full items-center">
                        <span className={`h-[3px] flex-1 ${index === 0 ? "bg-transparent" : isDone || isCurrent ? "bg-primary" : "bg-border"}`} />
                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${
                            isDone
                              ? "bg-emerald-500 text-white"
                              : isCurrent
                                ? "bg-primary text-primary-foreground"
                                : "border border-border bg-muted text-muted-foreground"
                          }`}
                        >
                          {isDone ? <Check className="h-4 w-4" strokeWidth={3.2} /> : index + 1}
                        </span>
                        <span className={`h-[3px] flex-1 ${last ? "bg-transparent" : isDone ? "bg-primary" : "bg-border"}`} />
                      </div>
                      <p className="mt-3 max-w-[110px] text-[11.5px] font-semibold leading-4">{mission.title}</p>
                      {isCurrent && (
                        <span className="mt-1.5 rounded-full bg-primary-soft px-2.5 py-0.5 text-[10px] font-bold text-accent-foreground">Now</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </>
      )}
    </AppShell>
  );
}
