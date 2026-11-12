import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Calendar,
  Camera,
  Check,
  ChevronDown,
  Code2,
  LayoutGrid,
  MessageCircle,
  RefreshCw,
  Settings as SettingsIcon,
  Timer,
} from "lucide-react";
import type { Plan, Profile } from "@/lib/loop-types";
import { REVEAL_STAGES, REVEAL_TOTAL_MS, revealGreeting } from "@/lib/reveal-schedule";

const LOOP_STEPS: [string, string][] = [
  ["Learn", "Understand the concept"],
  ["Build", "Write code"],
  ["Fail", "Face challenges"],
  ["Understand", "Get feedback"],
  ["Improve", "Fix & improve"],
  ["Loop", "Repeat & level up"],
];

const NAV_ITEMS = [
  { label: "Home", icon: LayoutGrid, active: true },
  { label: "Learn", icon: BookOpen, active: false },
  { label: "Videos", icon: Camera, active: false },
  { label: "Mentor", icon: MessageCircle, active: false },
  { label: "Progress", icon: BarChart3, active: false },
  { label: "Sessions", icon: Timer, active: false },
  { label: "Settings", icon: SettingsIcon, active: false },
] as const;

export type RevealStatus = "working" | "ready" | "error";

/**
 * Full-screen staged reveal of the learner's brand-new dashboard, played the
 * moment they press "I'm Ready" in onboarding. The backend research (topic
 * planning) is launched at the same moment and runs DURING this animation:
 * `plan` starts as null and arrives whenever the research finishes. Sections
 * that depend on researched topics (current task, progress, learning path)
 * appear only once real plan data exists - nothing is mocked or cosmetic. If
 * the research outlasts the animation, the reveal honestly waits on a
 * "finishing" caption; if it fails, an honest error with retry is shown.
 */
export function DashboardReveal({
  plan,
  profile,
  status,
  errorMessage,
  onRetry,
  onFinish,
}: {
  plan: Plan | null;
  profile: Profile;
  status: RevealStatus;
  errorMessage?: string;
  onRetry: () => void;
  onFinish: () => void;
}) {
  const [stage, setStage] = useState(0);
  const [timerDone, setTimerDone] = useState(false);
  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;

  // Stage timeline. On error we freeze the visuals on the final stage so the
  // error card is the only thing the learner is asked to look at.
  useEffect(() => {
    const reduceMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setStage(REVEAL_STAGES.length - 1);
      const timer = window.setTimeout(() => setTimerDone(true), 1200);
      return () => window.clearTimeout(timer);
    }
    const timers = REVEAL_STAGES.map((s, index) => window.setTimeout(() => setStage(index), s.at));
    timers.push(window.setTimeout(() => setTimerDone(true), REVEAL_TOTAL_MS));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, []);

  useEffect(() => {
    if (status === "error") {
      setStage(REVEAL_STAGES.length - 1);
      setTimerDone(true);
    }
  }, [status]);

  // Navigate only when the animation has played out AND real plan data is in.
  useEffect(() => {
    if (timerDone && status === "ready" && plan) finishRef.current();
  }, [timerDone, status, plan]);

  const name = profile.name?.trim() || "Builder";
  const firstName = name.split(" ")[0] ?? name;
  const tech = profile.technologies[0]?.name?.trim() || plan?.projectTitle || "coding";
  const missions = plan?.missions ?? [];
  const current = missions[0];
  const next = missions[1];
  const startTime = profile.startTime || "19:00";
  const endTime = profile.endTime || "21:00";
  const lastStage = REVEAL_STAGES.length - 1;
  const baseCaption = REVEAL_STAGES[Math.min(stage, lastStage)]?.caption ?? "Preparing your dashboard…";
  const caption =
    status === "error" ? "" : stage >= lastStage && status !== "ready" ? "Finishing your learning path…" : baseCaption;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Header - mirrors the real app header, non-interactive during the reveal */}
      <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border/60 px-4 sm:px-6 lg:h-[76px] lg:px-8">
        <div className="display flex items-center text-lg font-black tracking-[-0.05em]">
          BuildMyLogic<span className="mb-2 ml-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
        </div>
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-xs font-semibold text-ink-foreground">
            {name.slice(0, 1).toUpperCase()}
          </span>
          <span className="hidden text-sm font-semibold sm:inline">{name}</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1420px] flex-1 overflow-y-auto px-4 pb-28 pt-5 sm:px-7 sm:pt-7">
        {status === "error" ? (
          /* Honest failure: the topic research did not complete. No fake dashboard. */
          <section className="reveal-rise card-surface mx-auto mt-16 max-w-xl p-8 text-center">
            <h1 className="display text-[24px] font-extrabold tracking-[-0.02em]">I couldn't research your topics just now</h1>
            <p className="mt-3 text-[14px] leading-6 text-muted-foreground">
              {errorMessage?.trim() || "Something went wrong while building your learning path. Your answers are saved - please try again."}
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="btn-base btn-primary-solid mx-auto mt-6 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Try again</span>
            </button>
          </section>
        ) : (
          <>
            {/* What the app is doing while the dashboard assembles */}
            <div className="mb-5 flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              <span key={caption} className="reveal-rise">{caption}</span>
            </div>

            {/* Stage 1+: greeting header */}
            {stage >= 1 && (
              <div className="reveal-rise mb-7 flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                <div>
                  <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Dashboard</p>
                  <h1 className="display text-[28px] font-extrabold leading-[1.08] tracking-[-0.055em] sm:text-[42px] sm:leading-[1.04]">
                    {revealGreeting()}, {firstName}.
                  </h1>
                  <p className="mt-2 max-w-4xl text-[15px] leading-6 text-muted-foreground sm:text-[17px]">
                    Let's continue your {tech} learning journey.
                  </p>
                </div>
                <p className="hidden max-w-[190px] pt-3 text-right text-[13px] leading-5 text-muted-foreground lg:block">
                  “{plan?.quote || "Small steps every day build big skills."}”
                </p>
              </div>
            )}

            {/* Stage 2+: daily rhythm banner + 6-step learning loop */}
            {stage >= 2 && (
              <>
                <div className="reveal-rise mb-5 flex flex-col items-start justify-between gap-4 rounded-2xl bg-primary-soft/60 p-4 sm:flex-row sm:items-center sm:px-5">
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Calendar className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-[15px] font-bold text-foreground">Set your daily learning time</h4>
                      <p className="mt-0.5 text-[13px] text-muted-foreground">
                        Block {startTime} – {endTime} on Google Calendar so you never miss your build streak.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 self-end sm:self-auto">
                    <span className="btn-base btn-primary-solid flex items-center gap-1.5 rounded-full px-4 py-2.5 text-xs font-bold">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>Add to Google Calendar</span>
                    </span>
                    <span className="rounded-xl px-2.5 py-2 text-xs font-semibold text-muted-foreground">Dismiss</span>
                  </div>
                </div>
                <section className="reveal-rise grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  {LOOP_STEPS.map(([label, stepCaption], i) => (
                    <div key={label} className={`rounded-2xl border px-4 py-4 ${i === 0 ? "border-primary/20 bg-primary-soft" : "border-border bg-card"}`}>
                      <div className="flex items-center gap-2.5">
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${i === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                          {i + 1}
                        </span>
                        <span className="text-[13px] font-bold">{label}</span>
                      </div>
                      <p className="mt-1.5 text-[11px] leading-4 text-muted-foreground">{stepCaption}</p>
                    </div>
                  ))}
                </section>
              </>
            )}

            {/* Stage 3+: current task card - only once the researched plan exists */}
            {stage >= 3 && plan && current && (
              <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-12">
                <section className="reveal-rise card-surface p-6 sm:p-7 lg:col-span-7">
                  <div className="flex h-full flex-col justify-between gap-6 sm:flex-row sm:items-center">
                    <div className="min-w-0">
                      <span className="pill bg-primary-soft text-accent-foreground">Current Task</span>
                      <h2 className="display mt-4 text-[24px] font-extrabold leading-tight tracking-[-0.02em]">{current.title}</h2>
                      <p className="mt-2 max-w-md text-[14px] leading-6 text-muted-foreground">{current.description}</p>
                      <span className="btn-base btn-primary-solid mt-6 inline-flex">
                        <span>Start Task</span>
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    </div>
                    <div className="relative hidden h-36 w-44 shrink-0 items-center justify-center sm:flex">
                      <div className="absolute inset-0 rounded-full bg-primary-soft" />
                      <div className="relative flex h-24 w-32 items-center justify-center rounded-2xl border border-primary/20 bg-card shadow-sm">
                        <Code2 className="h-10 w-10 text-primary" />
                      </div>
                    </div>
                  </div>
                </section>

                {/* Stage 4+: progress card */}
                {stage >= 4 && (
                  <section className="reveal-rise card-surface p-6 lg:col-span-5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[16px] font-extrabold">Your Progress</h3>
                      <span className="display text-[22px] font-black">0%</span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: "0%" }} />
                    </div>
                    <div className="mt-4 space-y-2">
                      <div className="flex items-center gap-3 rounded-xl bg-primary-soft px-3.5 py-3">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-card" />
                        <p className="truncate text-[13px] font-semibold">
                          {current.title} <span className="font-bold text-accent-foreground">(Current)</span>
                        </p>
                      </div>
                      {next && (
                        <div className="flex items-center gap-3 px-3.5 py-3">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-border" />
                          <p className="truncate text-[13px] font-medium text-muted-foreground">Next: {next.title}</p>
                        </div>
                      )}
                    </div>
                  </section>
                )}
              </div>
            )}

            {/* Stage 5: the learning path - the topics the backend just researched */}
            {stage >= 5 && plan && missions.length > 0 && (
              <section className="reveal-rise card-surface mt-5 p-6 sm:p-7">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="display text-[19px] font-extrabold tracking-[-0.02em]">Your Learning Path – {plan.projectTitle}</h3>
                  <span className="shrink-0 text-[13px] font-bold text-accent-foreground">View Full Path →</span>
                </div>
                <div className="mt-8 overflow-x-auto pb-2">
                  <div className="flex min-w-[640px] items-start">
                    {missions.slice(0, 9).map((mission, index) => {
                      const isCurrent = index === 0;
                      const last = index === Math.min(9, missions.length) - 1;
                      return (
                        <div key={mission.id} className="flex flex-1 flex-col items-center text-center">
                          <div className="flex w-full items-center">
                            <span className={`h-[3px] flex-1 ${index === 0 ? "bg-transparent" : isCurrent ? "bg-primary" : "bg-border"}`} />
                            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${isCurrent ? "bg-primary text-primary-foreground" : "border border-border bg-muted text-muted-foreground"}`}>
                              {isCurrent ? <Check className="h-4 w-4" strokeWidth={3.2} /> : index + 1}
                            </span>
                            <span className={`h-[3px] flex-1 ${last ? "bg-transparent" : "bg-border"}`} />
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
            )}
          </>
        )}
      </main>

      {/* Bottom navigation - matches the current app chrome on every screen size */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur" aria-label="Preview">
        <div className="mx-auto flex w-full max-w-3xl">
          {NAV_ITEMS.map(({ label, icon: Icon, active }) => (
            <div
              key={label}
              className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-2 text-[10px] sm:py-2.5 sm:text-[11px] ${active ? "font-bold text-primary" : "font-medium text-muted-foreground"}`}
            >
              <Icon className="h-5 w-5" strokeWidth={1.9} />
              <span className="max-w-full truncate">{label}</span>
            </div>
          ))}
        </div>
      </nav>
    </div>
  );
}
