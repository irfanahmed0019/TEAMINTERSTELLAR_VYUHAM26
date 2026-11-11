import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, Check, Loader2, Send, Sparkles, WandSparkles } from "lucide-react";
import { aiGeneratePlan } from "@/lib/sarvam.functions";
import type { Plan, Profile } from "@/lib/loop-types";
import { logActivity, setLoopState, useLoop } from "@/lib/loop-store";
import { useCloudHydrated } from "@/lib/cloud-sync";
import { hasCloudConfig, signInWithGoogle, useAuth } from "@/lib/auth";

type Message = { role: "mentor" | "student"; text: string };
const initialProfile: Profile = {
  name: "", resumeText: "", resumeSummary: "", technologies: [], goal: "",
  goalDetail: "", experience: "First time building", experienceDetail: "",
  startTime: "19:00", endTime: "21:00", repeatDaily: true, followUps: [],
  projectIdea: "", challenge: "Guide me",
};

const prompts = [
  "What would you like to learn or build? Tell me your goal in your own words.",
  "What's your current experience level? For example, complete beginner, know some basics, or already building projects.",
  "How much time can you realistically spend learning each week, and which area should we focus on first?",
];

export function ConversationalOnboarding() {
  const navigate = useNavigate();
  const auth = useAuth();
  const loop = useLoop();
  const cloudReady = hasCloudConfig();
  const hydrated = useCloudHydrated(auth?.uid);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<Message[]>([
    { role: "mentor", text: "Hi! I'm your BuildMyLogic Mentor. Tell me what you want to learn, build, or become. I'll understand your starting point and create a practical learning path with real projects." },
  ]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [stage, setStage] = useState<"chat" | "plan" | "building">("chat");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [profile, setProfile] = useState<Profile>(initialProfile);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const currentPrompt = prompts[answers.length];
  const firstName = auth?.displayName?.split(" ")[0] ?? "";

  useEffect(() => {
    if (auth && hydrated && loop.onboarded && stage === "chat") void navigate({ to: "/auth/dashboard" });
  }, [auth, hydrated, loop.onboarded, stage, navigate]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, busy, stage, plan]);

  async function continueWithGoogle() {
    setSigningIn(true);
    setAuthError("");
    try {
      await signInWithGoogle();
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "Google sign-in failed. Please try again.");
      setSigningIn(false);
    }
  }

  async function sendAnswer(value = draft) {
    const answer = value.trim();
    if (!answer || busy || stage !== "chat") return;
    const nextAnswers = [...answers, answer];
    setAnswers(nextAnswers);
    setMessages((old) => [...old, { role: "student", text: answer }]);
    setDraft("");
    if (nextAnswers.length < prompts.length) {
      setMessages((old) => [...old, { role: "mentor", text: prompts[nextAnswers.length] ?? "" }]);
      return;
    }
    const goal = nextAnswers[0] ?? "";
    const experienceText = nextAnswers[1] ?? "";
    const scheduleText = nextAnswers[2] ?? "";
    const isBeginner = /beginner|new|never|zero|no experience/i.test(experienceText);
    const techMatch = goal.match(/\b(python|javascript|typescript|java|c\+\+|c|react|django|html|css|machine learning|data science)\b/i);
    const tech = techMatch?.[0] ?? "Python";
    const nextProfile: Profile = {
      ...initialProfile,
      name: auth?.displayName ?? "",
      goal: goal.toLowerCase().includes("job") ? "Prepare for a job" : "Build a real product",
      goalDetail: goal,
      experience: isBeginner ? "First time building" : "Yes, but got stuck",
      experienceDetail: experienceText,
      technologies: [{ name: tech, level: isBeginner ? "beginner" : "intermediate" }],
      projectIdea: goal,
      followUps: [
        { question: prompts[1] ?? "", answer: experienceText },
        { question: prompts[2] ?? "", answer: scheduleText },
      ],
      challenge: isBeginner ? "Guide me" : "Balance me",
    };
    setProfile(nextProfile);
    setBusy(true);
    setMessages((old) => [...old, { role: "mentor", text: "I've got what I need. I'm shaping your learning path around your goal, current level and available time. One moment…" }]);
    try {
      const generated = await aiGeneratePlan({ data: { profile: nextProfile } });
      const cleanPlan = generated as Plan;
      setPlan(cleanPlan);
      setStage("plan");
      setMessages((old) => [...old, { role: "mentor", text: "Your personalized plan is ready. Review it below. You can start when it feels right." }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "I couldn't create the plan. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function startLearning() {
    if (!plan || busy) return;
    setStage("building");
    setBusy(true);
    const steps = [
      "Understanding your goals and current skill level…",
      "Organizing your personalized learning path…",
      "Preparing practical missions and project tasks…",
      "Setting up your competency tracking…",
      "Your workspace is almost ready…",
    ];
    for (const step of steps) {
      setMessages((old) => [...old, { role: "mentor", text: step }]);
      await new Promise((resolve) => setTimeout(resolve, 650));
    }
    setLoopState((prev) => ({
      ...prev,
      onboarded: true,
      profile,
      plan: { ...plan, skills: (plan.skills ?? []).map((skill) => ({ ...skill, level: 0, note: "No BuildMyLogic evidence yet. Complete practical tasks to demonstrate this skill." })) },
      missionProgress: Object.fromEntries((plan.missions ?? []).map((mission, index) => [
        mission.id, { status: index === 0 ? "active" : "locked", completedSteps: [] } as const,
      ])),
    }));
    logActivity({ kind: "ai", text: `Created a personalized practical learning path for ${plan.projectTitle}.` });
    setBusy(false);
    await navigate({ to: "/auth/dashboard" });
  }

  const loadingAccount = !mounted || (!!auth && !hydrated);
  const needsGoogle = !auth;

  if (needsGoogle || loadingAccount) {
    const unavailable = mounted && !auth && !cloudReady;
    return (
      <main className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-background px-5 pb-8 pt-5 sm:px-10">
        <div className="pointer-events-none absolute -left-32 -top-40 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <header className="relative mx-auto flex w-full max-w-6xl items-center justify-between">
          <div className="display text-xl font-black tracking-[-0.05em] sm:text-2xl">BuildMyLogic<span className="text-primary">•</span></div>
        </header>
        <section className="relative mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary-soft px-3.5 py-1.5 text-[11px] font-bold text-accent-foreground"><Sparkles className="h-3.5 w-3.5" /> PERSONALIZED LEARNING</div>
          <h1 className="display text-[2rem] font-black leading-[1.1] tracking-[-0.05em] sm:text-5xl">What do you want to <span className="text-primary">build?</span></h1>
          <p className="mt-3 text-[15px] leading-6 text-muted-foreground">Sign in once with Google. Your mentor asks everything else in a quick chat.</p>
          {unavailable ? (
            <p className="mt-8 rounded-2xl bg-destructive/10 px-4 py-4 text-sm font-medium text-destructive">Google sign-in is not configured on this site right now. Please try again shortly.</p>
          ) : loadingAccount ? (
            <div className="mt-8 flex items-center gap-2 text-sm font-medium text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin text-primary" /> Loading your account…</div>
          ) : (
            <>
              <button type="button" onClick={() => void continueWithGoogle()} disabled={signingIn} className="mt-8 flex h-14 w-full items-center justify-center gap-3 rounded-2xl border border-border bg-surface text-base font-bold shadow-sm transition active:scale-[0.99] disabled:opacity-60">
                {signingIn ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>}
                Continue with Google
              </button>
              {authError && <p className="mt-3 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{authError}</p>}
              <p className="mt-4 text-xs text-muted-foreground">No resume or forms. Just Google, then a short chat.</p>
            </>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-background px-3 pb-3 pt-4 sm:px-10 sm:py-6">
      <div className="pointer-events-none absolute -left-32 -top-40 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-48 -right-24 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
      <header className="relative mx-auto flex w-full max-w-6xl items-center justify-between px-2 sm:px-0">
        <div className="display text-xl font-black tracking-[-0.05em] sm:text-2xl">BuildMyLogic<span className="text-primary">•</span></div>
        <div className="hidden rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-muted-foreground sm:block">Your practical learning partner</div>
      </header>

      <section className="relative mx-auto mt-3 flex w-full max-w-4xl flex-1 flex-col items-center sm:mt-10">
        <div className="mb-2 hidden items-center gap-2 rounded-full border border-primary/15 bg-primary-soft px-4 py-2 text-xs font-bold text-accent-foreground sm:mb-4 sm:inline-flex">
          <Sparkles className="h-4 w-4" /> PERSONALIZED LEARNING STARTS HERE
        </div>
        <h1 className="display max-w-3xl px-2 text-center text-[1.6rem] font-black leading-tight tracking-[-0.05em] sm:text-6xl">{firstName ? `Hi ${firstName}, what do you want to ` : "What do you want to "}<span className="text-primary">build?</span></h1>
        <p className="mt-2 hidden max-w-2xl text-center text-base text-muted-foreground sm:mt-4 sm:block sm:text-lg">Tell us where you are. We'll understand your goals, create your learning path, and get you building real projects.</p>

        <div className="mt-3 flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-3xl border border-primary/15 bg-surface/90 shadow-[0_18px_70px_rgba(91,33,182,0.08)] backdrop-blur sm:mt-9 sm:flex-none">
          <div className="flex items-center gap-3 border-b border-border px-4 py-3 sm:px-5 sm:py-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground sm:h-10 sm:w-10"><Sparkles className="h-5 w-5" /></div>
            <div className="min-w-0"><p className="text-sm font-extrabold">BuildMyLogic Mentor</p><p className="truncate text-xs text-muted-foreground">Personalized guidance</p></div>
            <span className="ml-auto flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Ready</span>
          </div>
          <div className="min-h-[200px] flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:max-h-[430px] sm:min-h-[260px] sm:space-y-4 sm:px-8 sm:py-6">
            {messages.map((message, index) => (
              <div key={index} className={`flex ${message.role === "student" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 sm:text-base ${message.role === "student" ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-primary-soft/70 text-foreground"}`}>
                  {message.role === "mentor" && <p className="mb-1 text-[11px] font-extrabold text-primary">BUILDMYLOGIC</p>}
                  {message.text}
                </div>
              </div>
            ))}
            {busy && <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin text-primary" /> Working on your learning experience…</div>}
            {stage === "plan" && plan && (
              <div className="rounded-2xl border border-primary/20 bg-background p-5">
                <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary"><WandSparkles className="h-5 w-5" /></div><div><h2 className="text-lg font-black">Your Learning Plan</h2><p className="text-xs text-muted-foreground">A practical path designed around your goal</p></div></div>
                <h3 className="mt-5 text-xl font-extrabold">{plan.projectTitle}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{plan.projectPitch}</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-primary-soft/60 p-3"><p className="text-xs font-bold text-primary">YOUR STARTING POINT</p><p className="mt-1 text-sm font-semibold">{profile.experience}</p></div>
                  <div className="rounded-xl bg-primary-soft/60 p-3"><p className="text-xs font-bold text-primary">YOUR FOCUS</p><p className="mt-1 text-sm font-semibold">{profile.goalDetail}</p></div>
                </div>
                <div className="mt-4"><p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Your first milestones</p><ol className="space-y-2">{plan.missions.slice(0, 5).map((mission, index) => <li key={mission.id} className="flex items-start gap-2 text-sm"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[11px] font-bold text-primary">{index + 1}</span><span><b>{mission.title}</b><span className="block text-xs text-muted-foreground">{mission.description}</span></span></li>)}</ol></div>
                <button onClick={() => void startLearning()} disabled={busy} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition hover:opacity-90 disabled:opacity-60"><Check className="h-4 w-4" /> I'm Ready <ArrowRight className="h-4 w-4" /></button>
              </div>
            )}
            {stage === "building" && <div className="rounded-2xl border border-primary/20 bg-primary-soft/50 p-5"><div className="flex items-center gap-3"><Loader2 className="h-5 w-5 animate-spin text-primary"/><p className="font-bold">Building your dashboard</p></div><p className="mt-2 text-sm text-muted-foreground">Preparing your missions, progress view and learning workspace.</p><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-primary/10"><div className="h-full w-2/3 animate-pulse rounded-full bg-primary"/></div><div className="mt-3 flex gap-2 text-xs text-primary"><span className="animate-pulse">▍</span><span className="animate-pulse delay-150">▍</span><span className="animate-pulse delay-300">▍</span><span>Configuring your learning environment…</span></div></div>}
            {error && <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}
            <div ref={bottomRef} />
          </div>
          {stage === "chat" && (
            <div className="border-t border-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-5">
              {answers.length === 0 && <div className="-mx-1 mb-3 flex flex-wrap gap-2">{["Learn Python and build a project", "Build a web application", "Become job-ready", "Improve my coding skills"].map((choice) => <button key={choice} onClick={() => void sendAnswer(choice)} className="rounded-full border border-primary/15 bg-primary-soft/40 px-3 py-2 text-xs font-semibold text-foreground transition hover:border-primary/40">{choice}</button>)}</div>}
              <div className="flex items-center gap-2 rounded-2xl border border-primary/30 bg-background p-2 shadow-sm focus-within:ring-2 focus-within:ring-primary/15">
                <input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void sendAnswer(); }} placeholder={currentPrompt ?? "Tell your mentor what you want to build…"} className="min-w-0 flex-1 bg-transparent px-3 py-3 text-base outline-none placeholder:text-muted-foreground"/>
                <button onClick={() => void sendAnswer()} disabled={!draft.trim() || busy} aria-label="Send message" className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40"><Send className="h-5 w-5"/></button>
              </div>
              <p className="mt-2 hidden text-center text-[11px] text-muted-foreground sm:block">Your plan adapts to your goals, current level and available time.</p>
            </div>
          )}
        </div>
        <div className="mt-8 hidden w-full gap-5 text-center sm:grid sm:grid-cols-4">
          {[["Understand you","Detect your current level"],["Create your path","A personalized roadmap"],["Guide & build","Hands-on practical tasks"],["Track & improve","Measure demonstrated skills"]].map(([title, desc], i) => <div key={title} className="px-2"><div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-primary-soft text-primary">{[<Sparkles className="h-4 w-4"/>,<WandSparkles className="h-4 w-4"/>,<ArrowRight className="h-4 w-4"/>,<Check className="h-4 w-4"/>][i]}</div><p className="text-sm font-bold">{title}</p><p className="mt-1 text-xs text-muted-foreground">{desc}</p></div>)}
        </div>
      </section>
    </main>
  );
}
