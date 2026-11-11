import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  BarChart3,
  Check,
  ChevronRight,
  Code2,
  Layers,
  Lightbulb,
  Paperclip,
  Send,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { aiMentorChat } from "@/lib/sarvam.functions";
import { getLoopState, useLoop } from "@/lib/loop-store";

type ChatMessage = { role: "mentor" | "student"; text: string; at: number };

const CHAT_STORAGE = "bml-mentor-home-v1";
const textLike = /\.(c|h|cpp|cc|cxx|py|js|jsx|ts|tsx|java|go|rs|rb|php|html?|css|scss|json|md|txt|sql|sh|bash|yml|yaml|xml|toml|env)$/i;

const CAPABILITIES = [
  "Understand concepts in simple terms",
  "Find and fix errors in your code",
  "Plan your learning and next project",
  "Identify your weak areas and suggest practice",
  "Prepare for exams, internships and interviews",
];

const TRY_ASKING = ["Explain a concept", "Debug my code", "Plan my next project", "Find my weak areas"];

function welcomeMessage(name: string): string {
  return `Hi ${name}! 👋\nI'm your BuildMyLogic AI Mentor.\nI can help you with:\n${CAPABILITIES.map((c) => `• ${c}`).join("\n")}`;
}

function renderBubble(text: string) {
  return text.split("\n").map((line, i) => {
    const isCapability = CAPABILITIES.some((c) => line === `• ${c}`);
    return (
      <span key={i} className="block">
        {isCapability ? (
          <span className="flex items-center gap-2 py-0.5">
            <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
            </span>
            <span>{line.slice(2)}</span>
          </span>
        ) : (
          line || " "
        )}
      </span>
    );
  });
}

export function MentorHome() {
  const state = useLoop();
  const plan = state.plan;
  const name = state.profile?.name?.trim() || "Builder";
  const missions = plan?.missions ?? [];
  const activeMission = missions.find((m) => state.missionProgress[m.id]?.status === "active") ?? missions[0];

  const currentTopic = useMemo(() => {
    const selected = missions.find((m) => m.id === state.selectedLearningMissionId);
    return selected?.skills?.[0] ?? activeMission?.skills?.[0] ?? plan?.skills?.[0]?.name ?? "Not set yet";
  }, [missions, state.selectedLearningMissionId, activeMission, plan]);

  const suggestion = useMemo(() => {
    if (plan?.progress?.insights?.[0]) return plan.progress.insights[0];
    const skills = [...(plan?.skills ?? [])].sort((a, b) => a.level - b.level);
    if (skills.length >= 2) {
      return `You're making progress. Practice more on ${skills[0]!.name} and then move to ${skills[1]!.name} for better mastery.`;
    }
    if (skills.length === 1) return `Keep practicing ${skills[0]!.name} to raise your mastery.`;
    return "Finish onboarding and your mentor will personalize suggestions from your real progress.";
  }, [plan]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [chatError, setChatError] = useState("");
  const [attachmentNote, setAttachmentNote] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const attachmentTextRef = useRef("");

  useEffect(() => {
    // Read the store directly here: during hydration the render-scoped `name`
    // still holds the empty server snapshot, which would greet "Builder".
    const liveName = getLoopState().profile?.name?.trim() || "Builder";
    try {
      const saved = JSON.parse(window.localStorage.getItem(CHAT_STORAGE) || "[]") as ChatMessage[];
      setMessages(saved.length ? saved : [{ role: "mentor", text: welcomeMessage(liveName), at: Date.now() }]);
    } catch {
      setMessages([{ role: "mentor", text: welcomeMessage(liveName), at: Date.now() }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  function save(next: ChatMessage[]) {
    setMessages(next);
    try {
      window.localStorage.setItem(CHAT_STORAGE, JSON.stringify(next.slice(-60)));
    } catch {
      // Chat still works if storage is unavailable.
    }
  }

  async function attachFiles(files: FileList | null) {
    if (!files?.length) return;
    const picked = Array.from(files).slice(0, 5);
    const parts: string[] = [];
    let skipped = 0;
    for (const file of picked) {
      if (!textLike.test(file.name) || file.size > 40_000) { skipped += 1; continue; }
      try { parts.push(`FILE: ${file.name}\n${await file.text()}`); } catch { skipped += 1; }
    }
    attachmentTextRef.current = [attachmentTextRef.current, ...parts].filter(Boolean).join("\n\n").slice(0, 40000);
    setAttachmentNote(
      parts.length
        ? `${parts.length} file${parts.length === 1 ? "" : "s"} attached to your next message${skipped ? ` (${skipped} skipped: only text/code files under 40 KB)` : ""}.`
        : "Only text/code files under 40 KB can be attached."
    );
  }

  async function send(text?: string) {
    const outgoing = (text ?? draft).trim();
    if (!outgoing || busy) return;
    const withContext = attachmentTextRef.current
      ? `${outgoing}\n\n${attachmentTextRef.current}`
      : outgoing;
    const next = [...messages, { role: "student" as const, text: outgoing, at: Date.now() }];
    save(next);
    setDraft("");
    setAttachmentNote("");
    attachmentTextRef.current = "";
    setBusy(true);
    setChatError("");
    try {
      const result = await aiMentorChat({
        data: {
          mentorName: "BuildMyLogic Mentor",
          mentorSpecialty: "Coding help, debugging, learning planning, and simple explanations",
          learnerMessage: withContext,
          history: next.slice(-10).map((item) => ({ role: item.role, text: item.text })),
        },
      });
      save([...next, { role: "mentor", text: result.message, at: Date.now() }]);
    } catch {
      save([...next, { role: "mentor", text: "I'm offline right now, so I can't give a full answer. Tell me your goal, what you tried, and what happened - and try again in a moment.", at: Date.now() }]);
      setChatError("BuildMyLogic Mentor is offline right now, so I gave you a simple starting reply.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell
      crumb="AI Mentor"
      title="Your AI Learning Mentor"
      subtitle="Get personalized guidance, clear doubts, plan your next steps, and improve your skills."
      quote="Ask, plan, build and improve with your AI Mentor."
      wide
    >
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Chat column */}
        <div className="lg:col-span-7 xl:col-span-8">
          <section className="card-surface flex items-center gap-3.5 px-5 py-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
              <Sparkles className="h-5 w-5" />
            </span>
            <div className="flex flex-wrap items-center gap-2.5">
              <p className="text-[16px] font-extrabold">BuildMyLogic Mentor</p>
              <span className="pill bg-primary-soft text-accent-foreground">AI Mentor</span>
            </div>
            <span className="ml-auto flex items-center gap-1.5 text-[12px] font-semibold text-emerald-600">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Online
            </span>
          </section>

          <div className="mt-4 max-h-[52vh] space-y-4 overflow-y-auto pr-1 lg:max-h-[46vh]">
            {messages.map((message, i) =>
              message.role === "mentor" ? (
                <div key={`${message.at}-${i}`}>
                  <div className="max-w-[92%] rounded-2xl bg-primary-soft/70 px-5 py-4 text-[14px] font-medium leading-6 sm:max-w-[80%]">
                    {renderBubble(message.text)}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-soft text-primary">
                      <Sparkles className="h-3 w-3" />
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(message.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              ) : (
                <div key={`${message.at}-${i}`} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-3 text-[14px] font-medium leading-6 text-primary-foreground">
                    <p className="whitespace-pre-wrap">{message.text}</p>
                  </div>
                </div>
              )
            )}
            {busy && (
              <div className="max-w-[60%] rounded-2xl bg-primary-soft/70 px-5 py-3.5 text-[13px] font-medium text-muted-foreground">
                BuildMyLogic Mentor is typing…
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {chatError && <p className="mt-3 rounded-xl bg-amber-50 px-4 py-2.5 text-[12px] font-semibold text-amber-800">{chatError}</p>}
          {attachmentNote && <p className="mt-3 rounded-xl bg-muted px-4 py-2.5 text-[12px] font-semibold">{attachmentNote}</p>}

          <p className="mt-5 text-[14px] font-semibold">Try asking:</p>
          <div className="mt-2.5 flex flex-wrap gap-2.5">
            {TRY_ASKING.map((chip) => (
              <button
                key={chip}
                type="button"
                disabled={busy}
                onClick={() => void send(chip)}
                className="rounded-full border border-border bg-card px-4 py-2 text-[13px] font-medium transition hover:border-primary hover:text-accent-foreground disabled:opacity-50"
              >
                {chip}
              </button>
            ))}
          </div>

          <form
            className="mt-4 flex items-center gap-2 rounded-full border border-border bg-card py-2 pl-4 pr-2 shadow-sm focus-within:border-primary"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="shrink-0 text-muted-foreground transition hover:text-foreground"
              aria-label="Attach a code or text file"
            >
              <Paperclip className="h-[18px] w-[18px]" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => { void attachFiles(e.target.files); e.currentTarget.value = ""; }}
            />
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Ask anything about your learning, project or skills…"
              className="min-w-0 flex-1 bg-transparent text-[14px] font-medium outline-none placeholder:text-muted-foreground"
              aria-label="Message BuildMyLogic Mentor"
            />
            <button
              type="submit"
              disabled={busy || !draft.trim()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:opacity-90 disabled:opacity-40"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>

        {/* Right rail */}
        <aside className="space-y-5 lg:col-span-5 xl:col-span-4">
          <section className="card-surface p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <Layers className="h-[18px] w-[18px] text-primary" />
                <h3 className="text-[15px] font-extrabold">Your Learning Context</h3>
              </div>
              <span className="pill bg-primary-soft text-accent-foreground">Live from your progress</span>
            </div>
            <div className="mt-4 space-y-3.5">
              {[
                { icon: Target, label: "Current Topic", value: currentTopic },
                { icon: Code2, label: "Current Project", value: plan?.projectTitle ?? "No project yet" },
                { icon: BarChart3, label: "Focus Area", value: state.profile?.goal || "Set your goal in onboarding" },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
                    <Icon className="h-4 w-4 text-primary" /> {label}
                  </span>
                  <span className="max-w-[55%] truncate text-right text-[13px] font-bold">{value}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="card-surface p-5">
            <div className="flex items-center gap-2.5">
              <Sparkles className="h-[18px] w-[18px] text-primary" />
              <h3 className="text-[15px] font-extrabold">Quick Actions</h3>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => void send("Explain a concept I'm learning in simple terms.")}
                className="rounded-2xl border border-border bg-card p-4 text-left transition hover:border-primary disabled:opacity-50"
              >
                <Code2 className="h-5 w-5 text-primary" />
                <p className="mt-2.5 text-[13.5px] font-bold">Explain Concept</p>
                <p className="mt-0.5 text-[11.5px] text-muted-foreground">Learn in simple terms</p>
              </button>
              <Link to="/learn" className="rounded-2xl border border-border bg-card p-4 text-left transition hover:border-primary">
                <Target className="h-5 w-5 text-primary" />
                <p className="mt-2.5 text-[13.5px] font-bold">Get Practice</p>
                <p className="mt-0.5 text-[11.5px] text-muted-foreground">Relevant exercises</p>
              </Link>
              <button
                type="button"
                disabled={busy}
                onClick={() => void send("Help me plan my next project based on my current skills.")}
                className="rounded-2xl border border-border bg-card p-4 text-left transition hover:border-primary disabled:opacity-50"
              >
                <Layers className="h-5 w-5 text-primary" />
                <p className="mt-2.5 text-[13.5px] font-bold">Plan Next Project</p>
                <p className="mt-0.5 text-[11.5px] text-muted-foreground">Based on your skills</p>
              </button>
              <Link to="/progress" className="rounded-2xl border border-border bg-card p-4 text-left transition hover:border-primary">
                <TrendingUp className="h-5 w-5 text-primary" />
                <p className="mt-2.5 text-[13.5px] font-bold">Skill Guidance</p>
                <p className="mt-0.5 text-[11.5px] text-muted-foreground">Improve & level up</p>
              </Link>
            </div>
          </section>

          <section className="card-surface p-5">
            <div className="flex items-center gap-2.5">
              <BarChart3 className="h-[18px] w-[18px] text-primary" />
              <h3 className="text-[15px] font-extrabold">Personalized Insights</h3>
            </div>
            <Link
              to="/learn"
              className="mt-4 flex items-center gap-3 rounded-2xl bg-primary-soft/70 px-4 py-4 transition hover:bg-primary-soft"
            >
              <Lightbulb className="h-5 w-5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-bold">Suggestion for you</p>
                <p className="mt-1 text-[12.5px] leading-5 text-muted-foreground">{suggestion}</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
