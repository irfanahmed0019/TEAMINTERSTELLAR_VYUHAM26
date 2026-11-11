import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, ArrowUpRight, BarChart3, BookOpen, Camera, Check, ChevronRight, Code2, File, FolderOpen, Layers, Lock, Paperclip, Play, RotateCcw, Send, Sparkles, Target, Terminal, UserRound, X, Lightbulb } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { clearLearningChatMessages, logActivity, recordMissionEvidence, recordSkillEvidence, resetLoop, saveLearningChat, selectLearningMission, setMissionProgress, useLoop } from "@/lib/loop-store";
import type { LearningMode, Mission } from "@/lib/loop-types";
import { aiTeachMicroLesson } from "@/lib/sarvam.functions";
import { dedupeMentorReplies, dedupeMentorText, normalizeSentence } from "@/lib/chat-dedupe";
import { getAuthSessionForApi } from "@/lib/auth";
import { C_CURRICULUM_MAP, parseDrillState } from "@/lib/curriculum-engine";


export const Route = createFileRoute("/learn")({ head: () => ({ meta: [{ title: "Learn — BuildMyLogic" }] }), component: Learn });

const fallbackTopics = [
  ["Problem Solving", "Break the mission into smaller decisions."],
  ["Input & Output", "Move data safely through your program."],
  ["Conditionals", "Make your program react to state."],
  ["Loops", "Repeat work without repeating code."],
  ["Functions", "Turn repeated logic into reusable units."],
  ["Debugging", "Find the actual cause instead of guessing."],
] as const;

type Level = "zero" | "some" | "comfortable";
type Attachment = { name: string; size: number; path?: string | undefined; text?: string | undefined };
type ChatMessage = { role: "mentor" | "student"; text: string; attachments?: { name: string; size: number }[] };

function renderRichText(text: string, role: ChatMessage["role"]): ReactNode {
  const renderProse = (segment: string, keyPrefix: string): ReactNode =>
    segment.split(/\n/).map((line, lineIndex, lines) => {
      const tokens = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
      return (
        <span key={`${keyPrefix}-line-${lineIndex}`} className="learn-rich-line">
          {tokens.map((token, tokenIndex) => {
            if (token.startsWith("**") && token.endsWith("**")) {
              return <strong key={`token-${tokenIndex}`} className="font-black">{token.slice(2, -2)}</strong>;
            }
            if (token.startsWith("`") && token.endsWith("`")) {
              return <code key={`token-${tokenIndex}`} className={`learn-inline-code ${role === "student" ? "is-student" : ""}`}>{token.slice(1, -1)}</code>;
            }
            return <span key={`token-${tokenIndex}`}>{token}</span>;
          })}
          {lineIndex < lines.length - 1 ? <br /> : null}
        </span>
      );
    });

  // Fenced code blocks (```lang ... ```) render as real code blocks instead of
  // raw backtick lines. Anything outside fences keeps the plain-line treatment.
  const blocks = text.split(/(```[\s\S]*?(?:```|$))/g);
  return blocks.map((block, blockIndex) => {
    if (blockIndex % 2 === 1) {
      const body = block.replace(/^```/, "").replace(/```\s*$/, "");
      const newline = body.indexOf("\n");
      let lang = "";
      let code = body;
      if (newline !== -1) {
        const firstLine = body.slice(0, newline).trim();
        if (/^[A-Za-z0-9#+._-]{1,24}$/.test(firstLine)) {
          lang = firstLine;
          code = body.slice(newline + 1);
        }
      }
      return (
        <pre key={`code-${blockIndex}`} className="learn-code-block" data-lang={lang || undefined}>
          <code>{code.replace(/\n$/, "")}</code>
        </pre>
      );
    }
    return block ? <span key={`prose-${blockIndex}`}>{renderProse(block, `prose-${blockIndex}`)}</span> : null;
  });
}

const modeOptions: { id: LearningMode; title: string; detail: string; emoji: string }[] = [
  { id: "practical", title: "Practical-first", detail: "Build first. Learn only the theory you need.", emoji: "🛠️" },
  { id: "balanced", title: "Theory + practice", detail: "A little theory, then use it immediately.", emoji: "⚖️" },
  { id: "theory", title: "Theory-first", detail: "Understand the idea, then practice it.", emoji: "🧠" },
];

const levelOptions: { id: Level; title: string; detail: string; emoji: string }[] = [
  { id: "zero", title: "I know nothing yet", detail: "Start from the beginning.", emoji: "🌱" },
  { id: "some", title: "I know a little", detail: "I have seen it, but need practice.", emoji: "🙂" },
  { id: "comfortable", title: "I'm comfortable", detail: "Skip the easy parts and test me.", emoji: "🚀" },
];

const textLike = /\.(c|h|cpp|cc|cxx|py|js|jsx|ts|tsx|java|go|rs|rb|php|html?|css|scss|json|md|txt|sql|sh|bash|yml|yaml|xml|toml|env)$/i;

function difficultyLabel(difficulty: number) {
  if (difficulty <= 1) return "Beginner";
  if (difficulty === 2) return "Intermediate";
  return "Advanced";
}

function PythonMark({ className = "h-7 w-7" }: { className?: string }) {
  return <img src="/python-logo.png" alt="" className={`${className} object-contain`} />;
}

function Learn() {
  const state = useLoop();
  const navigate = useNavigate();
  const missions = state.plan?.missions ?? [];
  const selectedMission = missions.find((m) => m.id === state.selectedLearningMissionId);
  const activeMission = missions.find((m) => state.missionProgress[m.id]?.status === "active") ?? missions[0];
  const current = selectedMission ?? activeMission;
  const [tab, setTab] = useState<"path" | "topics" | "resources">("path");
  const [view, setView] = useState<"path" | "setup">("path");
  const [topic, setTopic] = useState("");
  const [mode, setMode] = useState<LearningMode>("balanced");
  const [level, setLevel] = useState<Level | null>(null);
  const [started, setStarted] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [memory, setMemory] = useState("");
  const [lessonState, setLessonState] = useState<string>("hello_world");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [understood, setUnderstood] = useState(false);
  const [readyForProject, setReadyForProject] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sendingRef = useRef(false);
  const [vscodeSession, setVscodeSession] = useState<{ sessionId: string; challengeId: string; status?: string } | null>(null);
  const [vscodeLoading, setVscodeLoading] = useState(false);


  useEffect(() => {
    if (current && !topic) setTopic(current.skills?.[0] ?? fallbackTopics[0][0]);
  }, [current, topic]);

  const missionTopics = useMemo(() => {
    if (!current) return [] as readonly [string, string][];
    return [...new Set([...current.skills, ...fallbackTopics.map((x) => x[0])])]
      .slice(0, 8)
      .map((name) => fallbackTopics.find((x) => x[0] === name) ?? [name, `Learn ${name} only when it helps you build ${current.title}.`] as const);
  }, [current]);

  useEffect(() => {
    if (!topic || !current || started) return;
    const cached = state.learningChats[`v5::${current.id}::${topic}`];
    if (cached) {
      setMode(cached.mode || "balanced");
      setLevel((cached as any).level || "zero");
      setMessages(cached.messages as ChatMessage[]);
      setMemory(cached.memory ?? "");
      setLessonState(cached.lessonState ?? "hello_world");
      if (cached.messages.length) setStarted(true);
    }
  }, [current, state.learningChats, started, topic]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  function resizeComposer() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const maxHeight = 180;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  }

  useEffect(() => {
    resizeComposer();
  }, [answer]);

  // Display-only cleanup: the mentor used to re-greet and repeat its question
  // inside one reply. This folds those repeats away at render time; the saved
  // chat history itself is never rewritten.
  const visibleMessages = useMemo(() => dedupeMentorReplies(messages), [messages]);

  if (!state.plan || !current) {
    return <AppShell crumb="Learn" title="Your Learning Path" subtitle="Build skills step by step, with practical tasks and real projects." quote="Learn by doing, not just by watching."><section className="card-surface p-10 text-center"><BookOpen className="mx-auto h-9 w-9 text-primary" /><h2 className="display mt-4 text-2xl font-black">Your learning path is waiting.</h2><p className="mx-auto mt-2 max-w-xl text-sm font-semibold">Finish onboarding and BuildMyLogic will connect learning directly to your first mission.</p><Link to="/" className="btn-base btn-primary-solid mt-5">Start onboarding</Link></section></AppShell>;
  }

  const chatKey = `v5::${current.id}::${topic}`;
  const isPythonPlan = /python/i.test(`${state.plan.projectTitle} ${activeMission?.stack ?? ""} ${current.stack ?? ""}`);
  const doneCount = missions.filter((m) => state.missionProgress[m.id]?.status === "done").length;
  const pathPct = missions.length ? Math.round((doneCount / missions.length) * 100) : 0;
  const activeStepsDone = state.missionProgress[activeMission?.id ?? ""]?.completedSteps?.length ?? 0;
  const activeStepsTotal = activeMission?.steps.length ?? 1;
  const projectPct = Math.min(100, Math.round((activeStepsDone / activeStepsTotal) * 100));
  const goals: [string, boolean][] = [
    ["Complete the current topic", doneCount > 0 && (state.missionProgress[activeMission?.id ?? ""]?.status === "done")],
    ["Log at least one practice session", state.sessions.length > 0],
    ["Make progress on the current project", activeStepsDone > 0],
  ];
  const goalsDone = goals.filter(([, done]) => done).length;

  function chooseMission(mission: Mission) {
    selectLearningMission(mission.id);
    setTopic(mission.skills?.[0] ?? fallbackTopics[0][0]);
    setMessages([]);
    setStarted(false);
    setUnderstood(false);
    setReadyForProject(false);
    setView("setup");
  }

  async function readAttachment(file: File, relativePath?: string): Promise<Attachment> {
    const base = { name: relativePath || file.name, size: file.size, path: relativePath };
    if (!textLike.test(file.name) || file.size > 40_000) return base;
    try { return { ...base, text: await file.text() }; } catch { return base; }
  }

  async function addFiles(files: FileList | File[]) {
    const incoming = Array.from(files).slice(0, 30);
    const read = await Promise.all(incoming.map((file) => readAttachment(file, (file as File & { webkitRelativePath?: string }).webkitRelativePath)));
    setAttachments((prev) => [...prev, ...read].slice(0, 30));
  }

  async function startChat() {
    const effectiveMode = mode || "balanced";
    const effectiveLevel: Level = level || "zero";
    const cached = state.learningChats[chatKey];
    setStarted(true);
    setError(null);
    if (cached?.messages?.length) {
      setMessages(cached.messages as ChatMessage[]);
      setMode(cached.mode || "balanced");
      setLevel((cached as any).level || "zero");
      setMemory(cached.memory ?? "");
      setLessonState(cached.lessonState ?? "hello_world");
      setUnderstood(false);
      requestAnimationFrame(() => textareaRef.current?.focus());
      return;
    }

    // Zero-knowledge users should not be asked to self-diagnose again. Start at
    // the smallest useful artifact. This also prevents stale/advanced mission
    // context from becoming the learner's first step.
    const isC = /(^|[^a-z])(c|cmake)([^a-z]|$)/i.test(`${current!.stack} ${topic} ${current!.title}`);
    const starter = effectiveLevel === "zero" && isC
      ? "Let's start from zero. We'll make your first tiny C program: **Hello World**.\n\n```c\n#include <stdio.h>\n\nint main(void) {\n    printf(\"Hello World\\n\");\n    return 0;\n}\n```\n\nPut that in `hello.c` and run it. Do you see `Hello World` in the terminal?"
      : isC
        ? "Hey 👋\n\nDo you know C, or should we start from the beginning?"
        : `Hey 👋\n\nHave you used ${topic} before?`;
    const initial: ChatMessage = { role: "mentor", text: starter };
    setMessages([initial]);
    const initialLessonState = isC ? "hello_world" : "assessment";
    setMemory(cached?.memory ?? "");
    setLessonState(initialLessonState);
    saveLearningChat(chatKey, { mode: effectiveMode, level: effectiveLevel, lessonState: initialLessonState, messages: [initial], memory: cached?.memory ?? "", updatedAt: Date.now() } as any);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  async function sendCurrentMessage() {
    const outgoing = answer.trim();
    if (busy || sendingRef.current || (!outgoing && !attachments.length)) return;
    sendingRef.current = true;
    try {
      await teach(outgoing || "I uploaded my project. Please look at it with me.");
    } finally {
      sendingRef.current = false;
    }
  }

  async function teach(studentAnswer?: string, wantsSimpler = false, forcedLevel = level, forcedTopic = topic, forcedMode = mode) {
    const outgoing = String(studentAnswer ?? answer).trim();
    const effectiveLevel: Level = forcedLevel || level || (state.learningChats[chatKey] as any)?.level || "zero";
    const effectiveMode: LearningMode = forcedMode || mode || state.learningChats[chatKey]?.mode || "balanced";
    if (!current || busy || (!outgoing && !attachments.length && !wantsSimpler)) return;
    setBusy(true);
    setError(null);
    const history = messages.slice(-6);
    const currentMemory = memory || state.learningChats[chatKey]?.memory || "";
    const attachmentContext = attachments.filter((file) => file.text).map((file) => `FILE: ${file.name}\n${file.text}`).join("\n\n").slice(0, 40000);
    try {
      const result = await aiTeachMicroLesson({
        data: {
          topic: forcedTopic,
          missionTitle: current.title,
          missionDescription: current.description,
          level: effectiveLevel === "zero" ? "zero prior knowledge" : effectiveLevel === "some" ? "some prior exposure" : "comfortable with the basics",
          learningMode: effectiveMode,
          history,
          memory: currentMemory,
          studentAnswer,
          wantsSimpler,
          attachmentContext,
          lessonState,
        },
      });
      // The model often puts its question inside the message already; only
      // append it when it is genuinely separate, then drop any sentence the
      // reply repeats within itself.
      const questionKey = normalizeSentence(result.question ?? "");
      const messageKey = normalizeSentence(result.message ?? "");
      const mentorText = dedupeMentorText(
        questionKey.length >= 3 && messageKey.includes(questionKey)
          ? result.message
          : `${result.message}${result.question ? `\n\n${result.question}` : ""}`,
      );
      const next: ChatMessage[] = [
        ...history,
        ...(studentAnswer ? [{ role: "student" as const, text: studentAnswer, attachments: attachments.map(({ name, size }) => ({ name, size })) }] : []),
        { role: "mentor" as const, text: mentorText },
      ];
      setMessages(next);
      const nextMemory = String(result.memory ?? currentMemory).slice(0, 900);
      setMemory(nextMemory);
      setLessonState(result.lessonState ?? lessonState);
      saveLearningChat(chatKey, { mode: effectiveMode, level: effectiveLevel, lessonState: result.lessonState ?? lessonState, messages: next.slice(-60), memory: nextMemory, updatedAt: Date.now() } as any);
      setUnderstood(result.understood);
      setReadyForProject(result.readyForProject);
      setAnswer("");
      setAttachments([]);
      if (result.understood) {
        recordMissionEvidence(current.id, 1);
        recordSkillEvidence(result.nextConcept || topic, `Understood ${result.nextConcept || topic} concept checkpoint`, 4, "checkpoint_answer");
      }
      requestAnimationFrame(() => textareaRef.current?.focus());
    } catch (err) {
      setError(err instanceof Error ? err.message : "BuildMyLogic Mentor could not answer right now. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  const finishConcept = () => {
    setMissionProgress(current.id, { status: "active", completedSteps: Array.from(new Set([...(state.missionProgress[current.id]?.completedSteps ?? []), 0])) });
    recordMissionEvidence(current.id, 2);
    recordSkillEvidence(topic, `Understood ${topic} while preparing for “${current.title}”`, 6, "checkpoint_answer");
    logActivity({ kind: "skill", text: `Understood ${topic} while preparing for “${current.title}”` });
    if (readyForProject) void navigate({ to: "/sessions" });
    else void teach("I understand this. What is the next small thing I need to learn?", false);
  };

  if (started) {
    return <AppShell crumb={`Learn › ${topic}`} title={current.title} subtitle="Ask BuildMyLogic Mentor anything about the part you're building. Your chat is saved automatically." quote={state.plan.quote} wide>
      <div className="mx-auto flex max-w-[980px] flex-col">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => { setStarted(false); setView("path"); }} className="btn-base btn-outline"><ArrowLeft className="h-4 w-4" />Back to learning path</button>
            <button type="button" onClick={() => { if (window.confirm("Reset your build path and start fresh onboarding with simple beginner projects?")) { resetLoop(); void navigate({ to: "/" }); } }} className="btn-base btn-outline text-xs text-muted-foreground hover:text-destructive">Reset project path</button>
          </div>
          <div className="flex items-center gap-2"><span className="rounded-full border border-black/15 bg-white px-3 py-1 text-xs font-bold">{modeOptions.find((x) => x.id === mode)?.emoji} {modeOptions.find((x) => x.id === mode)?.title}</span><span className="rounded-full border border-black/15 bg-white px-3 py-1 text-xs font-bold">Saved</span></div>
        </div>

        <section className="learn-chat-shell">
          <div className="learn-chat-header"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary"><Sparkles className="h-4 w-4" /></span><div className="min-w-0"><p className="text-sm font-black">BuildMyLogic Mentor</p><p className="truncate text-[11px] font-medium text-muted-foreground">Learning with you · {current.title}</p></div><div className="ml-auto flex items-center gap-2"><span className="learn-memory-pill">Memory active</span><button type="button" onClick={() => { clearLearningChatMessages(chatKey); setMessages([]); setMemory(""); setLessonState("hello_world"); setError(null); setUnderstood(false); setReadyForProject(false); setStarted(false); }} className="learn-clear-chat"><RotateCcw className="h-3 w-3" />Reset chat</button></div></div>
          {(() => {
            const { conceptId, drillIndex } = parseDrillState(lessonState);
            const step = C_CURRICULUM_MAP[conceptId];
            if (!step) return null;
            return (
              <div className="flex flex-wrap items-center justify-between border-b border-black/10 bg-black/[0.02] px-5 py-2 text-xs font-semibold">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-black px-2 py-0.5 text-[10px] font-black text-white">
                    Step {step.stepNumber} / 14
                  </span>
                  <span className="font-bold">{step.title}</span>
                  {drillIndex !== undefined ? (
                    <span className="rounded-full bg-blue-100 text-blue-800 px-2 py-0.5 text-[10px] font-black">
                      Practice {drillIndex + 1} / 3 · No Hints
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-28 overflow-hidden rounded-full bg-black/10">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${(step.stepNumber / 14) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-bold text-muted-foreground">
                    {Math.round((step.stepNumber / 14) * 100)}%
                  </span>
                </div>
              </div>
            );
          })()}

          <div className="learn-chat-messages">
            {visibleMessages.map((message, i) => <div key={`${message.role}-${i}`} className={`learn-message-row ${message.role === "student" ? "is-student" : "is-mentor"}`}>
              {message.role === "mentor" ? <span className="learn-avatar mentor"><Sparkles className="h-4 w-4" /></span> : null}
              <div className={`learn-message ${message.role === "student" ? "student" : "mentor"}`}>
                <div className={`learn-rich-text ${message.role === "student" ? "is-student" : "is-mentor"}`}>{renderRichText(message.text, message.role)}</div>
                {message.attachments?.length ? <div className="mt-3 flex flex-wrap gap-2">{message.attachments.map((file) => <span key={file.name} className="learn-attachment"><File className="h-3.5 w-3.5" />{file.name}</span>)}</div> : null}
              </div>
              {message.role === "student" ? <span className="learn-avatar student"><UserRound className="h-4 w-4" /></span> : null}
            </div>)}
            {busy && <div className="learn-message-row is-mentor"><span className="learn-avatar mentor"><Sparkles className="h-4 w-4" /></span><div className="learn-message mentor"><span className="learn-dots"><i /><i /><i /></span></div></div>}
            <div ref={messagesEndRef} className="h-px" />
          </div>

          {error && <div className="mx-5 mb-3 rounded-xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold">⚠ {error}</div>}
          {attachments.length > 0 && <div className="mx-5 mb-2 flex flex-wrap gap-2">{attachments.map((file, i) => <span key={`${file.name}-${i}`} className="learn-attachment removable"><File className="h-3.5 w-3.5" />{file.name}<button type="button" onClick={() => setAttachments((prev) => prev.filter((_, index) => index !== i))} aria-label={`Remove ${file.name}`}><X className="h-3 w-3" /></button></span>)}</div>}
          <div className="learn-composer-wrap">
            <form
              className="learn-composer"
              onSubmit={(e) => {
                e.preventDefault();
                if (busy || (!answer.trim() && !attachments.length)) return;
                void sendCurrentMessage();
              }}
            >
              <button type="button" onClick={() => fileInputRef.current?.click()} className="learn-composer-icon" aria-label="Attach files or a folder"><Paperclip className="h-5 w-5" /></button>
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => { if (e.target.files) void addFiles(e.target.files); e.currentTarget.value = ""; }} />
              <input type="file" multiple className="hidden" id="bml-folder-upload" {...({ webkitdirectory: "", directory: "" } as Record<string, string>)} onChange={(e) => { if (e.target.files) void addFiles(e.target.files); e.currentTarget.value = ""; }} />
              <label htmlFor="bml-folder-upload" className="learn-composer-icon cursor-pointer" aria-label="Upload a folder"><FolderOpen className="h-5 w-5" /></label>
              <textarea
                ref={textareaRef}
                value={answer}
                onChange={(e) => { setAnswer(e.target.value); resizeComposer(); }}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
                  e.preventDefault();
                  void sendCurrentMessage();
                }}
                onFocus={resizeComposer}
                placeholder="Ask the mentor…"
                rows={1}
                className="learn-composer-input"
                disabled={busy}
                aria-label="Message BuildMyLogic Mentor"
              />
              <button
                type="submit"
                disabled={busy || (!answer.trim() && !attachments.length)}
                className="learn-send"
                aria-label="Send message"
                title={busy ? "Sending…" : "Send message"}
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">Enter to send · Shift + Enter for a new line · attach files or a whole folder</p>
          </div>
        </section>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void teach("💡 Give me a hint for this step", false)}
              className="btn-base btn-outline text-xs"
            >
              <Lightbulb className="h-3.5 w-3.5" /> Give me a hint
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void teach("I don't know yet. Please explain with an easy example.", true)}
              className="btn-base btn-outline text-xs text-muted-foreground"
            >
              🤷 I don't know
            </button>
          </div>
          <div className="flex items-center gap-2">
            {understood && <button type="button" disabled={busy} onClick={finishConcept} className="btn-base btn-ink"><Check className="h-4 w-4" />I get it — next</button>}
            {readyForProject ? (
              <button type="button" onClick={() => void navigate({ to: "/sessions" })} className="btn-base btn-primary-solid text-xs font-bold"><Code2 className="h-4 w-4" />Ready to build in VS Code →</button>
            ) : (
              <button type="button" onClick={() => void navigate({ to: "/sessions" })} className="ml-auto text-xs font-bold text-muted-foreground hover:text-foreground">Go build →</button>
            )}
          </div>
        </div>
      </div>

    </AppShell>;
  }

  if (view === "setup") {
    return <AppShell crumb="Learn" title="Before we teach, choose what you're building. 👋" subtitle="Pick the real project part you want to work on. Then BuildMyLogic Mentor will meet you at your level." quote="Don't collect lessons. Build evidence." wide>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="card-surface p-7">
          <button type="button" onClick={() => setView("path")} className="btn-base btn-outline mb-5 text-xs"><ArrowLeft className="h-3.5 w-3.5" />Back to learning path</button>
          <div className="rounded-2xl bg-black p-5 text-white"><div className="flex items-start gap-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-black"><Terminal className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="text-[10px] font-black uppercase tracking-widest text-white/55">Current project</p><h2 className="mt-1 text-xl font-black">{state.plan.projectTitle}</h2><p className="mt-2 text-xs font-semibold leading-5 text-white/70">{state.plan.projectPitch}</p></div><span className="rounded-full border border-white/25 px-3 py-1 text-[10px] font-black">✓ Selected</span></div></div>
          <div className="mt-7"><p className="text-xs font-black uppercase tracking-widest text-muted-foreground">1 · Project part</p><h2 className="display mt-2 text-3xl font-black">What are you working on right now?</h2><p className="mt-2 text-sm font-semibold">BuildMyLogic remembers each conversation separately. Switching missions won't erase your previous learning.</p></div>
          <div className="mt-5 grid gap-2.5">{missions.map((mission, index) => { const isSelected = mission.id === current.id; const status = state.missionProgress[mission.id]?.status ?? (index === 0 ? "active" : "locked"); return <button key={mission.id} type="button" onClick={() => { selectLearningMission(mission.id); setTopic(mission.skills?.[0] ?? fallbackTopics[0][0]); setMessages([]); setStarted(false); setUnderstood(false); setReadyForProject(false); }} className={`flex items-center gap-4 rounded-2xl border-2 p-4 text-left transition ${isSelected ? "border-black bg-primary-soft" : "border-black/10 hover:border-black"}`}><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isSelected ? "bg-black text-white" : "bg-muted"}`}>{status === "done" ? "✓" : index + 1}</span><span className="min-w-0 flex-1"><b className="block text-sm">{mission.title}</b><span className="mt-1 block text-xs font-semibold text-muted-foreground">{mission.stack} · {mission.description}</span></span>{isSelected && <Check className="h-5 w-5" />}</button>; })}</div>
          <div className="mt-8"><p className="text-xs font-black uppercase tracking-widest text-muted-foreground">2 · Learning style</p><h2 className="display mt-2 text-3xl font-black">How should BuildMyLogic Mentor teach you?</h2></div>
          <div className="mt-5 grid gap-2.5">{modeOptions.map((option) => <button key={option.id} type="button" onClick={() => setMode(option.id)} className={`flex items-center gap-4 rounded-2xl border-2 p-4 text-left ${mode === option.id ? "border-black bg-primary-soft" : "border-black/10 hover:border-black"}`}><span className="text-xl">{option.emoji}</span><span className="flex-1"><b className="block text-sm">{option.title}</b><span className="mt-1 block text-xs font-semibold text-muted-foreground">{option.detail}</span></span>{mode === option.id && <Check className="h-5 w-5" />}</button>)}</div>
          <div className="mt-8"><p className="text-xs font-black uppercase tracking-widest text-muted-foreground">3 · Starting point</p><h2 className="display mt-2 text-3xl font-black">Do you know this already?</h2></div>
          <div className="mt-5 grid gap-2.5">{levelOptions.map((option) => <button key={option.id} type="button" onClick={() => setLevel(option.id)} className={`flex items-center gap-4 rounded-2xl border-2 p-4 text-left ${level === option.id ? "border-black bg-primary-soft" : "border-black/10 hover:border-black"}`}><span className="text-xl">{option.emoji}</span><span className="flex-1"><b className="block text-sm">{option.title}</b><span className="mt-1 block text-xs font-semibold text-muted-foreground">{option.detail}</span></span>{level === option.id && <Check className="h-5 w-5" />}</button>)}</div>
          <button type="button" disabled={!level || busy} onClick={() => void startChat()} className="btn-base btn-primary-solid mt-6 disabled:opacity-50">{state.learningChats[chatKey]?.messages?.length ? "Continue where I left off" : "Start with BuildMyLogic Mentor"}<ArrowRight className="h-4 w-4" /></button>
        </section>
        <aside className="space-y-4">
          <section className="card-surface p-5">
            <p className="text-xs font-black uppercase tracking-widest">BuildMyLogic Mentor's rule</p>
            <h2 className="mt-2 text-xl font-black">Simple first. Build next.</h2>
            <p className="mt-3 text-sm font-semibold leading-6">BuildMyLogic Mentor starts with a basic question, listens to your answer, then teaches only the next thing you need.</p>
          </section>
          <section className="card-surface p-5">
            <h2 className="text-sm font-black">Mission skills</h2>
            <div className="mt-3 flex flex-wrap gap-2">{current.skills.map((skill) => <span key={skill} className="rounded-full border border-black/15 bg-white px-3 py-1.5 text-xs font-black">{skill}</span>)}</div>
          </section>
        </aside>
      </div>
    </AppShell>;
  }

  return (
    <AppShell
      crumb="Learn"
      title="Your Learning Path"
      subtitle="Build skills step by step, with practical tasks and real projects."
      quote="Learn by doing, not just by watching."
      wide
    >
      {/* Tabs */}
      <div className="inline-flex flex-wrap gap-1 rounded-2xl border border-border bg-card p-1.5">
        {([
          { id: "path", label: "Learning Path", icon: BookOpen },
          { id: "topics", label: "Topics", icon: Layers },
          { id: "resources", label: "Resources", icon: Play },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-bold transition ${tab === id ? "bg-primary-soft text-accent-foreground" : "text-muted-foreground hover:bg-muted"}`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Main column */}
        <div className="lg:col-span-7 xl:col-span-8">
          {tab === "path" && (
            <>
              <section className="card-surface flex items-center gap-4 p-5 sm:p-6">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                  {isPythonPlan ? <PythonMark className="h-8 w-8" /> : <Code2 className="h-6 w-6" />}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="display text-[19px] font-extrabold tracking-[-0.02em]">{state.plan.projectTitle} Path</h2>
                  <p className="mt-0.5 text-[13px] text-muted-foreground">From basics to building real-world projects.</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[13px] font-bold">{pathPct}% Complete</p>
                  <div className="mt-1.5 h-1.5 w-24 overflow-hidden rounded-full bg-muted sm:w-36">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${pathPct}%` }} />
                  </div>
                </div>
              </section>

              <h3 className="display mt-7 text-[19px] font-extrabold tracking-[-0.02em]">Learning Path</h3>
              <div className="mt-4 space-y-3">
                {missions.map((mission, index) => {
                  const status = state.missionProgress[mission.id]?.status ?? (index === 0 ? "active" : "locked");
                  const isDone = status === "done";
                  const isActive = !isDone && mission.id === activeMission?.id;
                  const locked = !isDone && !isActive && status === "locked";
                  const isLast = index === missions.length - 1;
                  const prevDone = index > 0 && (state.missionProgress[missions[index - 1]!.id]?.status === "done");
                  return (
                    <button
                      key={mission.id}
                      type="button"
                      onClick={() => chooseMission(mission)}
                      className={`flex w-full items-stretch rounded-2xl border bg-card text-left transition hover:border-primary ${isActive ? "border-primary/40 bg-primary-soft/50 shadow-sm" : "border-border"}`}
                    >
                      <span className="relative flex w-14 shrink-0 flex-col items-center self-stretch sm:w-16">
                        {index > 0 && <span aria-hidden className={`w-0.5 flex-none basis-4 sm:basis-5 ${prevDone ? "bg-emerald-400" : "bg-border"}`} />}
                        {index === 0 && <span aria-hidden className="basis-4 sm:basis-5" />}
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                            isDone
                              ? "bg-emerald-500 text-white"
                              : isActive
                                ? "border-[3px] border-primary bg-card"
                                : "border border-border bg-muted"
                          }`}
                        >
                          {isDone && <Check className="h-4 w-4" strokeWidth={3.2} />}
                        </span>
                        {!isLast && <span aria-hidden className={`absolute bottom-[-12px] left-1/2 top-[48px] w-0.5 -translate-x-1/2 sm:top-[52px] ${isDone ? "bg-emerald-400" : "bg-border"}`} />}
                      </span>
                      <span className="min-w-0 flex-1 py-4 sm:py-5">
                        <p className="text-[15px] font-bold">{index + 1}. {mission.title}</p>
                        <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-muted-foreground">{mission.description}</p>
                      </span>
                      <span className="flex items-center gap-2 pr-4 sm:pr-5">
                        {isDone ? (
                          <span className="pill shrink-0 bg-emerald-100 font-bold text-emerald-700">Completed</span>
                        ) : isActive ? (
                          <span className="pill shrink-0 bg-primary-soft font-bold text-accent-foreground">In Progress</span>
                        ) : locked ? (
                          <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
                        ) : null}
                        {!locked && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-6 text-center">
                <button type="button" onClick={() => void navigate({ to: "/missions" })} className="btn-base btn-outline rounded-full px-6">
                  View Full Roadmap <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </>
          )}

          {tab === "topics" && (
            <section className="card-surface p-5 sm:p-6">
              <h2 className="display text-[19px] font-extrabold tracking-[-0.02em]">Topics for {current.title}</h2>
              <p className="mt-1 text-[13px] text-muted-foreground">Pick a topic and BuildMyLogic Mentor will teach it at your level, connected to what you're building.</p>
              <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
                {missionTopics.map(([name, detail]) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => { setTopic(name); setView("setup"); }}
                    className={`rounded-2xl border p-4 text-left transition hover:border-primary ${topic === name ? "border-primary/40 bg-primary-soft/60" : "border-border bg-card"}`}
                  >
                    <p className="text-[14px] font-bold">{name}</p>
                    <p className="mt-1 text-[12.5px] leading-5 text-muted-foreground">{detail}</p>
                  </button>
                ))}
              </div>
            </section>
          )}

          {tab === "resources" && (
            <div className="space-y-4">
              <Link to="/videos" className="card-surface flex items-center gap-4 p-5 transition hover:border-primary">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary"><Camera className="h-6 w-6" /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-bold">Watch the full course video</p>
                  <p className="mt-0.5 text-[13px] text-muted-foreground">A free full-length course video with an on-device focus check. Nothing is recorded or uploaded.</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
              <a href="/extension.html" className="card-surface flex items-center gap-4 p-5 transition hover:border-primary">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary"><Code2 className="h-6 w-6" /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-bold">VS Code extension</p>
                  <p className="mt-0.5 text-[13px] text-muted-foreground">Install once to run checkpoints locally and sync real evidence from your editor.</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </a>
              <Link to="/mentor" className="card-surface flex items-center gap-4 p-5 transition hover:border-primary">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary"><Sparkles className="h-6 w-6" /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-bold">Practice workspace (C)</p>
                  <p className="mt-0.5 text-[13px] text-muted-foreground">Guided C exercises with real test runs, checked by the mentor.</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
              <section className="card-surface p-5">
                <div className="mb-3 flex items-center gap-2"><Code2 className="h-4 w-4" /><h2 className="text-sm font-black">Build with VS Code</h2>{vscodeSession && <span className="ml-auto rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-black text-green-700">● {vscodeSession.status === "active" || vscodeSession.status === "connected" ? "CONNECTED" : "READY"}</span>}</div>
              {!vscodeSession ? <><p className="mb-3 text-xs font-semibold text-muted-foreground">Open the existing BuildMyLogic extension with the same challenge. Only the Session ID is needed.</p><button type="button" disabled={vscodeLoading} onClick={async () => { setVscodeLoading(true); try { const auth = await getAuthSessionForApi(); const headers: Record<string, string> = { "content-type": "application/json" }; if (auth?.idToken) headers["Authorization"] = `Bearer ${auth.idToken}`; const res = await fetch("/api/sessions/start", { method: "POST", headers, body: JSON.stringify({ challenge_id: current.id, user_id: auth?.uid || "local-user", title: current.title, language: current.stack, concept: current.skills?.[0] || "problem solving", instructions: current.description + "\n\nRequirements:\n" + current.steps.map((step) => `• ${step.title}: ${step.detail}`).join("\n"), expected_skills: current.skills }) }); const data = await res.json() as { ok?: boolean; session_id?: string; error?: string }; if (!res.ok || !data.ok || !data.session_id) throw new Error(data.error || "Could not start the VS Code session."); const next = { sessionId: data.session_id, challengeId: current.id, status: "waiting" }; setVscodeSession(next); const anchor = document.createElement("a"); anchor.href = `vscode://buildmylogic.buildmylogic/connect?sessionId=${encodeURIComponent(next.sessionId)}&apiBaseUrl=${encodeURIComponent(window.location.origin)}`; anchor.click(); } catch (e) { setError(e instanceof Error ? e.message : "Could not open the VS Code session."); } finally { setVscodeLoading(false); } }} className="btn-base btn-ink w-full text-xs">{vscodeLoading ? "Opening VS Code…" : "Open session in VS Code"}</button></> : <div className="space-y-3"><p className="text-xs font-black text-green-700">✅ Session ID ready. VS Code is opening the same mission.</p><button type="button" onClick={() => { const anchor = document.createElement("a"); anchor.href = `vscode://buildmylogic.buildmylogic/connect?sessionId=${encodeURIComponent(vscodeSession.sessionId)}&apiBaseUrl=${encodeURIComponent(window.location.origin)}`; anchor.click(); }} className="btn-base btn-outline w-full text-xs">Open VS Code again</button><button type="button" onClick={() => setVscodeSession(null)} className="w-full text-center text-[10px] font-bold text-muted-foreground hover:text-destructive">Start a new session</button></div>}
              </section>
            </div>
          )}
        </div>

        {/* Right rail */}
        <aside className="space-y-5 lg:col-span-5 xl:col-span-4">
          {activeMission && (
            <section className="card-surface p-5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                <Layers className="h-[18px] w-[18px] text-primary" />
                <h3 className="text-[15px] font-extrabold">Current Project</h3>
                </div>
                <span className="pill bg-primary-soft text-accent-foreground">In Progress</span>
              </div>
              <div className="mt-4 flex items-start gap-3.5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                  {isPythonPlan ? <PythonMark className="h-7 w-7" /> : <Terminal className="h-5 w-5" />}
                </span>
                <div className="min-w-0">
                  <p className="text-[15px] font-bold">{activeMission.title}</p>
                  <p className="mt-1 line-clamp-2 text-[12.5px] leading-5 text-muted-foreground">{activeMission.description}</p>
                </div>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${projectPct}%` }} />
              </div>
              <p className="mt-1.5 text-right text-[12px] font-bold">{projectPct}%</p>
              <button
                type="button"
                onClick={() => void navigate({ to: "/sessions" })}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-primary/25 bg-primary-soft py-3 text-[13px] font-bold text-accent-foreground transition hover:bg-primary/20"
              >
                Open Project in Sessions <ArrowUpRight className="h-4 w-4" />
              </button>
            </section>
          )}

          {activeMission && (
            <section className="card-surface p-5">
              <div className="flex items-center gap-2.5">
                <Target className="h-[18px] w-[18px] text-primary" />
                <h3 className="text-[15px] font-extrabold">Next Milestone</h3>
              </div>
              <p className="mt-3 text-[14px] font-bold">Complete {activeMission.title}</p>
              <div className="mt-3 space-y-2.5">
                {activeMission.steps.slice(0, 3).map((step, index) => {
                  const done = state.missionProgress[activeMission.id]?.completedSteps?.includes(index) ?? false;
                  return (
                    <div key={step.title} className="flex items-center gap-2.5">
                      <span className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 ${done ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
                        {done && <Check className="h-2.5 w-2.5" strokeWidth={3.5} />}
                      </span>
                      <p className={`text-[13px] ${done ? "font-semibold" : "text-muted-foreground"}`}>{step.title}</p>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <section className="card-surface p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <BarChart3 className="h-[18px] w-[18px] text-primary" />
                <h3 className="text-[15px] font-extrabold">Learning Goals</h3>
              </div>
              <span className="pill bg-primary-soft text-accent-foreground">{goalsDone} / {goals.length}</span>
            </div>
            <p className="mt-1.5 text-[12px] text-muted-foreground">Your targets for this week.</p>
            <div className="mt-3 space-y-2.5">
              {goals.map(([label, done]) => (
                <div key={label} className="flex items-center gap-2.5">
                  <span className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border-2 ${done ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
                    {done && <Check className="h-2.5 w-2.5" strokeWidth={3.5} />}
                  </span>
                  <p className={`text-[13px] ${done ? "font-semibold" : "text-muted-foreground"}`}>{label}</p>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
