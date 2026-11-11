import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, Check, Loader2, Paperclip, Send, Sparkles, WandSparkles } from "lucide-react";
import { aiGeneratePlan } from "@/lib/sarvam.functions";
import type { Plan, Profile } from "@/lib/loop-types";
import { logActivity, setLoopState } from "@/lib/loop-store";

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
  const [messages, setMessages] = useState<Message[]>([
    { role: "mentor", text: "Hi! I'm your BuildMyLogic Mentor. 👋 Tell me what you want to learn, build, or become. I'll understand your starting point and create a practical learning path with real projects." },
  ]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [stage, setStage] = useState<"chat" | "plan" | "building">("chat");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [profile, setProfile] = useState<Profile>(initialProfile);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const currentPrompt = prompts[answers.length];
  async function sendAnswer(value = draft) {
    const answer = value.trim();
    if (!answer || busy || stage !== "chat") return;
    const nextAnswers = [...answers, answer];
    setAnswers(nextAnswers);
    setMessages((old) => [...old, { role: "student", text: answer }]);
    setDraft("");
    if (nextAnswers.length < prompts.length) {
      setMessages((old) => [...old, { role: "mentor", text: prompts[nextAnswers.length] }]);
      return;
    }
    const goal = nextAnswers[0];
    const experienceText = nextAnswers[1];
    const scheduleText = nextAnswers[2];
    const isBeginner = /beginner|new|never|zero|no experience/i.test(experienceText);
    const techMatch = goal.match(/\b(python|javascript|typescript|java|c\+\+|c|react|django|html|css|machine learning|data science)\b/i);
    const tech = techMatch?.[0] ?? "Python";
    const nextProfile: Profile = {
      ...initialProfile,
      name: "",
      goal: goal.toLowerCase().includes("job") ? "Prepare for a job" : "Build a real product",
      goalDetail: goal,
      experience: isBeginner ? "First time building" : "Yes, but got stuck",
      experienceDetail: experienceText,
      technologies: [{ name: tech, level: isBeginner ? "beginner" : "intermediate" }],
      projectIdea: goal,
      followUps: [
        { question: prompts[1], answer: experienceText },
        { question: prompts[2], answer: scheduleText },
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

  return (
    <main className="relative min-h-screen overflow-hidden bg-background px-5 py-6 sm:px-10">
      <div className="pointer-events-none absolute -left-32 -top-40 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-48 -right-24 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
      <header className="relative mx-auto flex max-w-6xl items-center justify-between">
        <div className="display text-2xl font-black tracking-[-0.05em]">BuildMyLogic<span className="text-primary">•</span></div>
        <div className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-muted-foreground">Your practical learning partner</div>
      </header>

      <section className="relative mx-auto mt-10 flex max-w-4xl flex-col items-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary-soft px-4 py-2 text-xs font-bold text-accent-foreground">
          <Sparkles className="h-4 w-4" /> PERSONALIZED LEARNING STARTS HERE
        </div>
        <h1 className="display max-w-3xl text-center text-4xl font-black leading-tight tracking-[-0.05em] sm:text-6xl">What do you want to <span className="text-primary">build?</span></h1>
        <p className="mt-4 max-w-2xl text-center text-base text-muted-foreground sm:text-lg">Tell us where you are. We'll understand your goals, create your learning path, and get you building real projects.</p>

        <div className="mt-9 w-full overflow-hidden rounded-3xl border border-primary/15 bg-surface/90 shadow-[0_18px_70px_rgba(91,33,182,0.08)] backdrop-blur">
          <div className="flex items-center gap-3 border-b border-border px-5 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><Sparkles className="h-5 w-5" /></div>
            <div><p className="text-sm font-extrabold">BuildMyLogic Mentor</p><p className="text-xs text-muted-foreground">Personalized guidance · Practical learning</p></div>
            <span className="ml-auto flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Ready</span>
          </div>
          <div className="max-h-[430px] min-h-[260px] space-y-4 overflow-y-auto px-5 py-6 sm:px-8">
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
          </div>
          {stage === "chat" && (
            <div className="border-t border-border p-4 sm:p-5">
              {answers.length === 0 && <div className="mb-3 flex flex-wrap gap-2">{["Learn Python and build a project", "Build a web application", "Become job-ready", "Improve my coding skills"].map((choice) => <button key={choice} onClick={() => void sendAnswer(choice)} className="rounded-full border border-primary/15 bg-primary-soft/40 px-3 py-2 text-xs font-semibold text-foreground transition hover:border-primary/40">{choice}</button>)}</div>}
              <div className="flex items-center gap-2 rounded-2xl border border-primary/30 bg-background p-2 shadow-sm focus-within:ring-2 focus-within:ring-primary/15">
                <Paperclip className="ml-2 h-5 w-5 text-muted-foreground"/>
                <input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void sendAnswer(); }} placeholder={currentPrompt ?? "Tell your mentor what you want to build…"} className="min-w-0 flex-1 bg-transparent px-2 py-3 text-sm outline-none placeholder:text-muted-foreground"/>
                <button onClick={() => void sendAnswer()} disabled={!draft.trim() || busy} aria-label="Send message" className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40"><Send className="h-5 w-5"/></button>
              </div>
              <p className="mt-2 text-center text-[11px] text-muted-foreground">Your plan adapts to your goals, current level and available time.</p>
            </div>
          )}
        </div>
        <div className="mt-8 grid w-full gap-5 text-center sm:grid-cols-4">
          {[["Understand you","Detect your current level"],["Create your path","A personalized roadmap"],["Guide & build","Hands-on practical tasks"],["Track & improve","Measure demonstrated skills"]].map(([title, desc], i) => <div key={title} className="px-2"><div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-primary-soft text-primary">{[<Sparkles className="h-4 w-4"/>,<WandSparkles className="h-4 w-4"/>,<ArrowRight className="h-4 w-4"/>,<Check className="h-4 w-4"/>][i]}</div><p className="text-sm font-bold">{title}</p><p className="mt-1 text-xs text-muted-foreground">{desc}</p></div>)}
        </div>
      </section>
    </main>
  );
}
