import { isPublicDemo } from "@/lib/demo-mode";
import { EmailPasswordSignIn } from "@/components/EmailPasswordSignIn";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, Check, Loader2, Send, Sparkles, WandSparkles } from "lucide-react";
import { aiGeneratePlan } from "@/lib/sarvam.functions";
import type { Plan, Profile } from "@/lib/loop-types";
import { DashboardReveal } from "@/components/DashboardReveal";
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
  const [stage, setStage] = useState<"chat" | "plan" | "reveal">("chat");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [profile, setProfile] = useState<Profile>(initialProfile);
  const [genStatus, setGenStatus] = useState<"working" | "ready" | "error">("working");
  const [genError, setGenError] = useState("");

  const currentPrompt = prompts[answers.length];
  const firstName = auth?.displayName?.split(" ")[0] ?? "";

  useEffect(() => {
    if (isPublicDemo()) { void navigate({to:"/auth/dashboard"}); return; }
    if (auth && hydrated && loop.onboarded && stage === "chat") void navigate({ to: "/auth/dashboard" });
  }, [auth, hydrated, loop.onboarded, stage, navigate]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, stage, plan]);

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

  function sendAnswer(value = draft) {
    const answer = value.trim();
    if (!answer || stage !== "chat") return;
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
    // No backend call here anymore: the topic research starts only when the
    // learner presses "I'm Ready" and runs underneath the staged reveal.
    setMessages((old) => [...old, { role: "mentor", text: "I've got what I need. When you're ready, I'll research which topics you need and build your personalized path around them." }]);
    setStage("plan");
  }

  function startLearning() {
    if (stage !== "plan") return;
    setStage("reveal");
    void runResearch();
  }

  // The topic research starts the moment the learner presses "I'm Ready" and
  // runs underneath the staged dashboard reveal. The reveal shows only real
  // states: sections that need the researched topics appear when the plan
  // actually arrives, a slower backend shows an honest "finishing" wait, and
  // a failure shows an honest error with retry - never a cosmetic success.
  async function runResearch() {
    setGenStatus("working");
    setGenError("");
    try {
      const generated = (await aiGeneratePlan({ data: { profile } })) as Plan;
      setPlan(generated);
      // Persist the researched plan right away: topics, missions and progress
      // tracking are saved to local state and the cloud while the reveal is
      // playing, so the dashboard that opens is the one just assembled.
      setLoopState((prev) => ({
        ...prev,
        onboarded: true,
        profile,
        plan: { ...generated, skills: (generated.skills ?? []).map((skill) => ({ ...skill, level: 0, note: "No BuildMyLogic evidence yet. Complete practical tasks to demonstrate this skill." })) },
        missionProgress: Object.fromEntries((generated.missions ?? []).map((mission, index) => [
          mission.id, { status: index === 0 ? "active" : "locked", completedSteps: [] } as const,
        ])),
      }));
      logActivity({ kind: "ai", text: `Created a personalized practical learning path for ${generated.projectTitle}.` });
      setGenStatus("ready");
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "I couldn't research your topics just now. Please try again.");
      setGenStatus("error");
    }
  }

  if (stage === "reveal") {
    return (
      <DashboardReveal
        plan={plan}
        profile={profile}
        status={genStatus}
        errorMessage={genError}
        onRetry={() => void runResearch()}
        onFinish={() => void navigate({ to: "/auth/dashboard" })}
      />
    );
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
          <p className="mt-3 text-[15px] leading-6 text-muted-foreground">Sign in with Google or your email and password. Your mentor asks everything else in a quick chat.</p>
          {unavailable ? (
            <p className="mt-8 rounded-2xl bg-destructive/10 px-4 py-4 text-sm font-medium text-destructive">Sign-in is not configured on this site right now. Please try again shortly.</p>
          ) : loadingAccount ? (
            <div className="mt-8 flex items-center gap-2 text-sm font-medium text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin text-primary" /> Loading your account…</div>
          ) : (
            <>
              <button type="button" onClick={() => void continueWithGoogle()} disabled={signingIn} className="mt-8 flex h-14 w-full items-center justify-center gap-3 rounded-2xl border border-border bg-surface text-base font-bold shadow-sm transition active:scale-[0.99] disabled:opacity-60">
                {signingIn ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>}
                Continue with Google
              </button>
              {authError && <p className="mt-3 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{authError}</p>}
              <EmailPasswordSignIn />
              <p className="mt-4 text-xs text-muted-foreground">No resume needed. Sign in, then a short chat.</p>
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
            {stage === "plan" && (
              <div className="rounded-2xl border border-primary/20 bg-background p-5">
                <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary"><WandSparkles className="h-5 w-5" /></div><div><h2 className="text-lg font-black">Everything's noted</h2><p className="text-xs text-muted-foreground">Your goal, level and time are saved</p></div></div>
                <p className="mt-4 text-sm leading-6 text-muted-foreground">When you press <b>I'm Ready</b>, your mentor researches which topics you need and builds your personalized learning path while your new dashboard assembles.</p>
                <button onClick={startLearning} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition hover:opacity-90"><Check className="h-4 w-4" /> I'm Ready <ArrowRight className="h-4 w-4" /></button>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          {stage === "chat" && (
            <div className="border-t border-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-5">
              {answers.length === 0 && <div className="-mx-1 mb-3 flex flex-wrap gap-2">{["Learn Python and build a project", "Build a web application", "Become job-ready", "Improve my coding skills"].map((choice) => <button key={choice} onClick={() => void sendAnswer(choice)} className="rounded-full border border-primary/15 bg-primary-soft/40 px-3 py-2 text-xs font-semibold text-foreground transition hover:border-primary/40">{choice}</button>)}</div>}
              <div className="flex items-center gap-2 rounded-2xl border border-primary/30 bg-background p-2 shadow-sm focus-within:ring-2 focus-within:ring-primary/15">
                <input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void sendAnswer(); }} placeholder={currentPrompt ?? "Tell your mentor what you want to build…"} className="min-w-0 flex-1 bg-transparent px-3 py-3 text-base outline-none placeholder:text-muted-foreground"/>
                <button onClick={() => sendAnswer()} disabled={!draft.trim()} aria-label="Send message" className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40"><Send className="h-5 w-5"/></button>
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
