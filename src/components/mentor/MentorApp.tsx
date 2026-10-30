import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronRight, Circle, Loader2, Lock, Play, RotateCcw, Send, Sparkles, TriangleAlert, Lightbulb, Cloud, HardDrive } from "lucide-react";
import { Card, DemoShell } from "@/components/demo/DemoScreens";
import { CodeEditor } from "./CodeEditor";
import { CATEGORIES, LESSONS, LEVEL_RULES, MISCONCEPTIONS, PROJECTS, SKILLS, exerciseById, lessonById, type Exercise, type Level } from "@/lib/mentor/curriculum";
import {
  assess, curatedRoadmap, dueRevisions, exerciseFor, gradeRun, masteryOverview, newState, recordSubmission,
  type Assessment, type Attempt, type MentorState, type Roadmap, type TestResult,
} from "@/lib/mentor/engine";
import { executeC, generateRoadmapAI, mentorAsk, type MentorAsk } from "@/lib/mentor/mentor.functions";
import { isSignedIn, loadCloud, loadLocal, saveCloud, saveEvent, saveLocal } from "@/lib/mentor/persistence";
import { useAuth } from "@/lib/auth";

const BLUE = "#2563eb";
const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong.");
const uid = () => `at-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;

type Persist = { mode: "device" | "cloud"; note: string };

function Pill({ children, tone = "gray" }: { children: React.ReactNode; tone?: "gray" | "green" | "amber" | "blue" | "red" }) {
  const t = { gray: "bg-gray-100 text-gray-600", green: "bg-emerald-50 text-emerald-600", amber: "bg-amber-50 text-amber-700", blue: "bg-blue-50 text-blue-600", red: "bg-red-50 text-red-600" }[tone];
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ${t}`}>{children}</span>;
}

export function MentorApp() {
  const auth = useAuth();
  const [state, setState] = useState<MentorState | null>(null);
  const [ready, setReady] = useState(false);
  const [persist, setPersist] = useState<Persist>({ mode: "device", note: "Saved on this device only. Sign in to save to your account." });
  const [roadmapDraft, setRoadmapDraft] = useState<{ level: Level; roadmap: Roadmap } | null>(null);

  const commit = useCallback(async (next: MentorState | null) => {
    setState(next);
    saveLocal(next);
    if (!next) return;
    const r = await saveCloud(next);
    if (r.cloud === "saved") setPersist({ mode: "cloud", note: "Saved to your account." });
    else if (r.cloud === "error") setPersist({ mode: "device", note: `Cloud save failed (${r.message}). Progress is saved on this device.` });
    else setPersist({ mode: "device", note: "Saved on this device only. Sign in to save to your account." });
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const local = loadLocal();
      let chosen = local;
      if (await isSignedIn()) {
        const cloud = await loadCloud();
        if (cloud.error) setPersist({ mode: "device", note: `Cloud load failed (${cloud.error}). Using this device's copy.` });
        else if (cloud.state && (!local || cloud.state.updatedAt >= local.updatedAt)) { chosen = cloud.state; setPersist({ mode: "cloud", note: "Resumed from your account." }); }
        else if (local) void commit(local);
      }
      if (alive) { setState(chosen); setReady(true); }
    })();
    return () => { alive = false; };
  }, [commit, auth?.uid]);

  const user = { name: auth?.displayName || "Learner", role: auth ? "Student" : "Not signed in" };

  return (
    <DemoShell active="AI Mentor" user={user}>
      {!ready ? (
        <div className="flex items-center gap-2 py-16 text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading your learning session...</div>
      ) : state ? (
        <Workspace state={state} commit={commit} persist={persist} signedIn={!!auth} onReset={() => { setRoadmapDraft(null); void commit(null); }} />
      ) : roadmapDraft ? (
        <RoadmapView draft={roadmapDraft} onBack={() => setRoadmapDraft(null)} onStart={() => { const s = newState(roadmapDraft.level, roadmapDraft.roadmap); setRoadmapDraft(null); void commit(s); void saveEvent(s.id, "session_started", s.roadmap.source); }} />
      ) : (
        <Setup signedIn={!!auth} onRoadmap={(level, roadmap) => setRoadmapDraft({ level, roadmap })} />
      )}
    </DemoShell>
  );
}

/* ------------------------------ Steps A-D ------------------------------ */

function Setup({ onRoadmap, signedIn }: { onRoadmap: (l: Level, r: Roadmap) => void; signedIn: boolean }) {
  const [category, setCategory] = useState<string>("Programming Fundamentals");
  const [projectId, setProjectId] = useState<string>("arithmetic-c");
  const [custom, setCustom] = useState("");
  const [language, setLanguage] = useState("C");
  const [level, setLevel] = useState<Level>("beginner");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const project = PROJECTS.find((p) => p.id === projectId);
  const isCustom = category === "Custom Learning Goal";
  const ready = !isCustom && !!project?.available && language === "C";

  async function generate() {
    setBusy(true); setErr(null);
    const base = curatedRoadmap(level);
    let roadmap = base;
    if (signedIn) {
      try {
        const ai = await generateRoadmapAI({ data: { level, project: base.title, language, lessonTitles: LESSONS.map((l) => l.title) } });
        roadmap = { ...base, source: "ai", objective: ai.objective, prerequisites: ai.prerequisites.length ? ai.prerequisites : base.prerequisites, difficulty: ai.difficulty || base.difficulty, finalProject: ai.finalProject, modules: base.modules.map((m, i) => ({ ...m, ...(ai.moduleNotes[i] ? { note: ai.moduleNotes[i] } : {}) })) };
      } catch (e) {
        roadmap = { ...base, aiNote: `AI roadmap unavailable (${errMsg(e)}). Showing the curated roadmap for this journey.` };
      }
    } else roadmap = { ...base, aiNote: "Sign in to get an AI-tuned roadmap. Showing the curated roadmap for this journey." };
    setBusy(false);
    onRoadmap(level, roadmap);
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-[28px] font-extrabold tracking-[-0.03em]">Let's build something real.</h1>
      <p className="mt-1 text-[14px] text-gray-500">Choose what you want to learn. Your AI Mentor will create a practical learning journey.</p>

      <Card className="mt-6 p-5">
        <h2 className="text-[15px] font-bold">What would you like to learn or build?</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button key={c} type="button" onClick={() => { setCategory(c); const first = PROJECTS.find((p) => p.category === c); if (first) setProjectId(first.id); }}
              className={`rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${category === c ? "border-blue-600 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>{c}</button>
          ))}
        </div>
        {isCustom ? (
          <div className="mt-4">
            <label className="text-[12.5px] font-semibold text-gray-600" htmlFor="custom-goal">Describe your goal</label>
            <input id="custom-goal" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="e.g. Build a unit converter in C" className="mt-1 h-10 w-full rounded-lg border border-gray-200 px-3 text-[13.5px] outline-none focus:border-blue-400" />
            <p className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-[12.5px] text-amber-800"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />Custom goals cannot be turned into a full journey yet. This release has one complete journey: Arithmetic Operations in C. Pick it from Programming Fundamentals.</p>
          </div>
        ) : (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {PROJECTS.filter((p) => p.category === category).map((p) => (
              <button key={p.id} type="button" onClick={() => { setProjectId(p.id); setLanguage(p.languages[0]!); }}
                className={`rounded-xl border p-3 text-left transition-colors ${projectId === p.id ? "border-blue-600 bg-blue-50/60" : "border-gray-200 hover:bg-gray-50"}`}>
                <span className="block text-[13.5px] font-bold">{p.title}</span>
                <span className="mt-1 block text-[12px] text-gray-500">{p.available ? "Full journey available" : "Journey not built yet"}</span>
              </button>
            ))}
            {PROJECTS.filter((p) => p.category === category).length === 0 && <p className="text-[13px] text-gray-500">No example projects in this category yet. Choose Programming Fundamentals for the available journey.</p>}
          </div>
        )}
      </Card>

      {!isCustom && project && (
        <Card className="mt-4 p-5">
          <h2 className="text-[15px] font-bold">Which technology would you like to use?</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {project.languages.map((l) => (
              <button key={l} type="button" onClick={() => setLanguage(l)} className={`rounded-lg border px-4 py-2 text-[13px] font-semibold ${language === l ? "border-blue-600 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>{l}</button>
            ))}
          </div>
          {project.available && language !== "C" && <p className="mt-2 text-[12.5px] text-amber-700">Only C is available for this journey right now.</p>}
        </Card>
      )}

      <Card className="mt-4 p-5">
        <h2 className="text-[15px] font-bold">How would you describe your current level?</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {(Object.keys(LEVEL_RULES) as Level[]).map((l) => (
            <button key={l} type="button" onClick={() => setLevel(l)} className={`rounded-xl border p-4 text-left transition-colors ${level === l ? "border-blue-600 bg-blue-50/60" : "border-gray-200 hover:bg-gray-50"}`}>
              <span className="block text-[12px] font-extrabold tracking-wider text-blue-600">{LEVEL_RULES[l].label.toUpperCase()}</span>
              <span className="mt-1 block text-[13px] text-gray-600">{LEVEL_RULES[l].blurb}</span>
              <span className="mt-2 block text-[11.5px] text-gray-400">{LEVEL_RULES[l].hintsAllowed} hint{LEVEL_RULES[l].hintsAllowed > 1 ? "s" : ""} per exercise{LEVEL_RULES[l].openOrder ? " | any lesson order" : ""}</span>
            </button>
          ))}
        </div>
      </Card>

      {err && <p role="alert" className="mt-3 text-[13px] text-red-600">{err}</p>}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="button" disabled={!ready || busy} onClick={generate} className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13.5px] font-bold text-white disabled:opacity-40" style={{ backgroundColor: BLUE }}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Generate my learning roadmap
        </button>
        {!ready && <span className="text-[12.5px] text-gray-500">Select Arithmetic Operations Calculator with C to continue.</span>}
      </div>
    </div>
  );
}

function RoadmapView({ draft, onStart, onBack }: { draft: { level: Level; roadmap: Roadmap }; onStart: () => void; onBack: () => void }) {
  const r = draft.roadmap;
  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center gap-2">
        <h1 className="text-[26px] font-extrabold tracking-[-0.03em]">{r.title}</h1>
        <Pill tone={r.source === "ai" ? "blue" : "amber"}>{r.source === "ai" ? "AI-tuned roadmap" : "Curated roadmap"}</Pill>
        <Pill>{LEVEL_RULES[draft.level].label}</Pill>
      </div>
      {r.aiNote && <p className="mt-2 rounded-lg bg-amber-50 p-3 text-[12.5px] text-amber-800">{r.aiNote}</p>}
      <p className="mt-2 text-[14px] text-gray-600">{r.objective}</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Card className="p-4"><p className="text-[11px] text-gray-400">Difficulty</p><p className="mt-1 text-[13.5px] font-semibold">{r.difficulty}</p></Card>
        <Card className="p-4"><p className="text-[11px] text-gray-400">Hints per exercise</p><p className="mt-1 text-[13.5px] font-semibold">{r.rules.hintsAllowed}</p></Card>
        <Card className="p-4"><p className="text-[11px] text-gray-400">Explanations</p><p className="mt-1 text-[13.5px] font-semibold">{r.rules.depth}</p></Card>
      </div>
      <Card className="mt-4 p-5">
        <h2 className="text-[14px] font-bold">Prerequisites</h2>
        <ul className="mt-2 list-disc pl-5 text-[13px] text-gray-600">{r.prerequisites.map((p) => <li key={p}>{p}</li>)}</ul>
      </Card>
      {r.modules.map((m) => (
        <Card key={m.title} className="mt-4 p-5">
          <h2 className="text-[14px] font-bold">{m.title}</h2>
          {m.note && <p className="mt-1 text-[12.5px] text-gray-500">{m.note}</p>}
          <ol className="mt-3 space-y-2">
            {m.lessonIds.map((id) => { const l = lessonById(id)!; return (
              <li key={id} className="rounded-lg border border-gray-100 p-3">
                <p className="text-[13.5px] font-semibold">{l.order}. {l.title}</p>
                <p className="text-[12.5px] text-gray-500">{l.objective}</p>
                <p className="mt-1 text-[11.5px] text-gray-400">Concepts: {l.concepts.join(", ")}. Assessment: every test case passes on real execution.</p>
              </li>
            ); })}
          </ol>
        </Card>
      ))}
      <Card className="mt-4 p-5"><h2 className="text-[14px] font-bold">Final practical project</h2><p className="mt-1 text-[13px] text-gray-600">{r.finalProject}</p></Card>
      <div className="mt-5 flex gap-3">
        <button type="button" onClick={onStart} className="rounded-xl px-5 py-2.5 text-[13.5px] font-bold text-white" style={{ backgroundColor: BLUE }}>Start learning</button>
        <button type="button" onClick={onBack} className="rounded-xl border border-gray-200 px-5 py-2.5 text-[13.5px] font-semibold text-gray-600">Change selections</button>
      </div>
    </div>
  );
}

/* ------------------------------ Workspace ------------------------------ */

type Mentor = { text: string; source: "ai" | "curated" | "error" };

function Workspace({ state, commit, persist, signedIn, onReset }: { state: MentorState; commit: (s: MentorState | null) => Promise<void>; persist: Persist; signedIn: boolean; onReset: () => void }) {
  const lesson = lessonById(state.currentLessonId)!;
  const lp = state.lessons[lesson.id]!;
  const [revisionId, setRevisionId] = useState<string | null>(null);
  const rev = revisionId ? state.revisions.find((r) => r.id === revisionId) : undefined;
  const active = rev ? { exercise: exerciseById(rev.exerciseId)!.exercise, remedialFor: exerciseById(rev.exerciseId)!.remedialFor } : exerciseFor(state, lesson.id);
  const exercise: Exercise = active.exercise;
  const [tab, setTab] = useState<"Explanation" | "Example" | "Practice" | "Resources">("Explanation");
  const [view, setView] = useState<"lesson" | "progress">("lesson");
  const [simple, setSimple] = useState(false);
  const [code, setCode] = useState("");
  const [results, setResults] = useState<TestResult[] | null>(null);
  const [custom, setCustom] = useState<{ stdin: string; out: string } | null>(null);
  const [customIn, setCustomIn] = useState("");
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [decision, setDecision] = useState("");
  const [busy, setBusy] = useState<"run" | "submit" | "ask" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mentor, setMentor] = useState<Mentor | null>(null);
  const [question, setQuestion] = useState("");
  const [hintShown, setHintShown] = useState<string[]>([]);
  const [sandboxNote, setSandboxNote] = useState("");
  const stateRef = useRef(state);
  stateRef.current = state;

  // Load the saved code (or starter) when the exercise changes.
  useEffect(() => {
    setCode(stateRef.current.lessons[lesson.id]!.code[exercise.id] ?? exercise.starter);
    setResults(null); setAssessment(null); setDecision(""); setError(null); setCustom(null); setHintShown([]); setMentor(null);
  }, [lesson.id, exercise.id]);

  const saveCodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function editCode(v: string) {
    setCode(v);
    if (saveCodeTimer.current) clearTimeout(saveCodeTimer.current);
    saveCodeTimer.current = setTimeout(() => {
      const s = structuredClone(stateRef.current);
      s.lessons[lesson.id]!.code[exercise.id] = v;
      saveLocal(s);
    }, 600);
  }

  const hintsAllowed = state.roadmap.rules.hintsAllowed;
  const hintsUsed = lp.hintsUsed;

  async function execute(tests: Exercise["tests"]) {
    const res = await executeC({ data: { code, stdins: tests.map((t) => t.stdin) } });
    setSandboxNote(res.sandbox);
    return res.items;
  }

  async function run() {
    setBusy("run"); setError(null); setAssessment(null); setDecision("");
    try {
      const visible = exercise.tests.filter((t) => !t.hidden);
      const items = await execute(visible);
      setResults(gradeRun(visible, items));
      setCustom(null);
    } catch (e) { setError(errMsg(e)); setResults(null); } finally { setBusy(null); }
  }

  async function runCustom() {
    setBusy("run"); setError(null);
    try {
      const res = await executeC({ data: { code, stdins: [customIn] } });
      const r = res.items[0]!;
      setSandboxNote(res.sandbox);
      setCustom({ stdin: customIn, out: r.statusId === 3 ? r.stdout || "(no output)" : `${r.status}\n${r.compileOutput || r.stderr}` });
      setResults(null);
    } catch (e) { setError(errMsg(e)); } finally { setBusy(null); }
  }

  async function submit() {
    setBusy("submit"); setError(null);
    try {
      const tests = exercise.tests;
      const items = await execute(tests);
      const graded = gradeRun(tests, items);
      const prior = state.attempts.filter((a) => a.exerciseId === exercise.id && a.mode === "submit").length;
      const a = assess(exercise, code, tests, graded, items, prior);
      const attempt: Attempt = { id: uid(), ts: new Date().toISOString(), lessonId: lesson.id, exerciseId: exercise.id, code, mode: "submit", results: graded, assessment: a, hintsUsed };
      const { state: next, decision: d } = recordSubmission(state, attempt, exercise, revisionId ?? undefined);
      setResults(graded); setAssessment(a); setDecision(d); setCustom(null);
      await commit(next);
      void saveEvent(next.id, a.status, d);
      if (revisionId) setRevisionId(null);
    } catch (e) { setError(errMsg(e)); } finally { setBusy(null); }
  }

  function showHint() {
    if (hintsUsed >= hintsAllowed) return;
    const idx = hintShown.length;
    const hint = exercise.hints[Math.min(hintsUsed, exercise.hints.length - 1)]!;
    void idx;
    const s = structuredClone(state);
    s.lessons[lesson.id]!.hintsUsed += 1;
    setHintShown((h) => [...h, hint]);
    void commit(s);
  }

  async function ask(kind: MentorAsk["kind"], message = "") {
    setBusy("ask"); setMentor(null);
    const activeMis = Object.values(state.misconceptions).filter((m) => m.status !== "resolved").map((m) => `${MISCONCEPTIONS[m.id]?.label} (seen ${m.count}x)`);
    const curated = (): Mentor | null => {
      if (kind === "simpler") return { text: lesson.simpler.join(" "), source: "curated" };
      if (kind === "another_example") return { text: `Another worked example from this lesson:\n\n${lesson.example.code}\nOutput: ${lesson.example.output}`, source: "curated" };
      if (kind === "explain_mistake") {
        const m = assessment?.misconceptions[0];
        return { text: m ? MISCONCEPTIONS[m.id]!.explain : assessment ? assessment.feedback : "Submit your code first so I can explain from real test results.", source: "curated" };
      }
      if (kind === "hint") return { text: exercise.hints[Math.min(hintsUsed, exercise.hints.length - 1)]!, source: "curated" };
      return null;
    };
    try {
      const r = await mentorAsk({ data: { kind, level: state.level, lessonTitle: lesson.title, objective: lesson.objective, exercisePrompt: exercise.prompt, code, lastFeedback: assessment?.feedback ?? "", misconceptions: activeMis, hintsUsed, message } });
      setMentor({ text: r.message, source: "ai" });
    } catch (e) {
      const c = curated();
      setMentor(c ? { text: `${c.text}\n\n(AI mentor unavailable: ${errMsg(e)} Showing curated content instead.)`, source: "curated" } : { text: `The AI mentor is unavailable right now: ${errMsg(e)}`, source: "error" });
    } finally { setBusy(null); }
  }

  const overview = masteryOverview(state);
  const revs = dueRevisions(state);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-extrabold tracking-[-0.03em]">{state.roadmap.title}</h1>
          <p className="mt-1 text-[13.5px] text-gray-500">{state.roadmap.objective}</p>
        </div>
        <div className="w-56">
          <div className="flex items-center justify-between text-[12px] text-gray-500"><span>Project progress</span><span className="font-semibold text-gray-700">{overview.lessonsCompleted} / {LESSONS.length} lessons</span></div>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full" style={{ width: `${overview.progressPct}%`, backgroundColor: BLUE }} /></div>
            <span className="text-[12px] font-semibold text-gray-700">{overview.progressPct}%</span>
          </div>
        </div>
      </div>
      <p className={`mt-2 flex items-center gap-1.5 text-[12px] ${persist.mode === "cloud" ? "text-emerald-600" : "text-gray-500"}`}>{persist.mode === "cloud" ? <Cloud className="h-3.5 w-3.5" /> : <HardDrive className="h-3.5 w-3.5" />}{persist.note}</p>

      <div className="mt-4 grid gap-4 lg:grid-cols-12">
        {/* Left: navigation */}
        <div className="space-y-4 lg:col-span-3">
          <Card className="p-4">
            <p className="text-[11px] text-gray-400">Current project</p>
            <p className="text-[13.5px] font-bold">Arithmetic Operations in C</p>
            <p className="mt-2 text-[11px] text-gray-400">Your level</p>
            <Pill tone="green">{LEVEL_RULES[state.level].label}</Pill>
            <button type="button" onClick={() => { if (confirm("Start a new learning session? Your current session stays saved only if you are signed in.")) onReset(); }} className="mt-3 block text-[12px] font-semibold text-blue-600 hover:underline">New learning session</button>
          </Card>
          <Card className="p-4">
            <p className="mb-2 text-[13.5px] font-bold">Learning steps</p>
            <ol className="space-y-1">
              {LESSONS.map((l) => {
                const p = state.lessons[l.id]!;
                const locked = p.status === "locked";
                const current = l.id === lesson.id;
                return (
                  <li key={l.id}>
                    <button type="button" disabled={locked} onClick={() => { setRevisionId(null); setView("lesson"); setTab("Explanation"); setState_current(l.id); }}
                      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12.5px] ${current && view === "lesson" ? "bg-blue-50 font-semibold text-blue-700" : "text-gray-700 hover:bg-gray-50"} ${locked ? "opacity-50" : ""}`}>
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                        {p.status === "completed" ? <Check className="h-4 w-4 text-emerald-600" /> : locked ? <Lock className="h-3.5 w-3.5 text-gray-400" /> : p.status === "needs_review" ? <TriangleAlert className="h-4 w-4 text-amber-500" /> : p.status === "in_progress" ? <Circle className="h-4 w-4 fill-blue-100 text-blue-600" /> : <Circle className="h-4 w-4 text-gray-300" />}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{l.order}. {l.title}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
            <p className="mt-2 text-[11px] text-gray-400">Completed, in progress, available, needs review, locked.</p>
            <button type="button" onClick={() => setView(view === "progress" ? "lesson" : "progress")} className="mt-3 w-full rounded-lg border border-gray-200 py-1.5 text-[12.5px] font-semibold text-gray-700 hover:bg-gray-50">{view === "progress" ? "Back to lesson" : `Progress and revision${revs.filter((r) => r.due).length ? ` (${revs.filter((r) => r.due).length} due)` : ""}`}</button>
          </Card>
        </div>

        {view === "progress" ? (
          <div className="lg:col-span-9"><ProgressPanel state={state} onRevision={(id) => { const r = state.revisions.find((x) => x.id === id)!; setRevisionId(id); const target = r.lessonId; setState_current(target); setView("lesson"); setTab("Practice"); }} /></div>
        ) : (
          <>
            {/* Center: teaching */}
            <div className="space-y-4 lg:col-span-5">
              <Card className="p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[17px] font-extrabold tracking-tight">{lesson.order}. {lesson.title}</h2>
                  <Pill tone="blue">Step {lesson.order} of {LESSONS.length}</Pill>
                  {rev && <Pill tone="amber">Revision task</Pill>}
                  {active.remedialFor && <Pill tone="amber">Targeted exercise</Pill>}
                </div>
                <p className="mt-1 text-[13px] text-gray-500"><b className="text-gray-700">Objective:</b> {lesson.objective}</p>
                <div className="mt-3 flex gap-1 border-b border-gray-100" role="tablist">
                  {(["Explanation", "Example", "Practice", "Resources"] as const).map((t) => (
                    <button key={t} role="tab" aria-selected={tab === t} type="button" onClick={() => setTab(t)} className={`px-3 py-2 text-[13px] font-semibold ${tab === t ? "border-b-2 border-blue-600 text-blue-700" : "text-gray-500"}`}>{t}</button>
                  ))}
                </div>
                <div className="mt-3 text-[13.5px] leading-6 text-gray-700">
                  {tab === "Explanation" && (<>
                    {(simple ? lesson.simpler : lesson.explanation).map((p) => <p key={p} className="mb-2">{p}</p>)}
                    <p className="mt-3 text-[12px] font-bold uppercase tracking-wide text-gray-400">Key points</p>
                    <ul className="list-disc pl-5">{lesson.keyPoints.map((k) => <li key={k}>{k}</li>)}</ul>
                    <button type="button" onClick={() => setSimple((v) => !v)} className="mt-3 text-[12.5px] font-semibold text-blue-600 hover:underline">{simple ? "Show the full explanation" : "Explain in simpler words"}</button>
                  </>)}
                  {tab === "Example" && (<>
                    <pre className="overflow-x-auto rounded-lg bg-gray-50 p-3 text-[12.5px] leading-5">{lesson.example.code}</pre>
                    {lesson.example.stdin && <p className="mt-2 text-[12.5px] text-gray-500">Input: <code>{lesson.example.stdin}</code></p>}
                    <p className="mt-1 text-[12.5px] text-gray-500">Expected output:</p>
                    <pre className="rounded-lg bg-gray-50 p-3 text-[12.5px]">{lesson.example.output}</pre>
                    <button type="button" onClick={() => { editCode(lesson.example.code); setTab("Practice"); }} className="mt-2 text-[12.5px] font-semibold text-blue-600 hover:underline">Load this example into the editor</button>
                  </>)}
                  {tab === "Practice" && (<>
                    <p className="font-semibold text-gray-900">{exercise.title}</p>
                    <p className="mt-1 whitespace-pre-line">{exercise.prompt}</p>
                    <p className="mt-2 text-[12px] text-gray-400">Run checks the visible tests. Submit answer also runs hidden tests and is assessed.</p>
                  </>)}
                  {tab === "Resources" && (<ul className="list-disc pl-5">{lesson.resources.map((r) => <li key={r.url}><a className="text-blue-600 hover:underline" href={r.url} target="_blank" rel="noreferrer">{r.label}</a></li>)}</ul>)}
                </div>
              </Card>

              <Card className="p-5">
                <p className="flex items-center gap-2 text-[13.5px] font-bold"><Sparkles className="h-4 w-4 text-blue-600" /> AI Mentor</p>
                <p className="mt-1 text-[12px] text-gray-400">{signedIn ? "Uses this lesson, your code and your mistake history." : "Sign in to use the AI mentor. Curated explanations and hints work without it."}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {([["simpler", "Explain in simpler words"], ["another_example", "Show another example"], ["why_works", "Why does this code work?"], ["similar_problem", "Give me a similar problem"], ["explain_mistake", "Explain my mistake"]] as const).map(([k, label]) => (
                    <button key={k} type="button" disabled={busy === "ask"} onClick={() => void ask(k)} className="rounded-full border border-gray-200 px-3 py-1 text-[12px] font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50">{label}</button>
                  ))}
                </div>
                <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (question.trim()) { void ask("chat", question); setQuestion(""); } }}>
                  <input value={question} onChange={(e) => setQuestion(e.target.value)} aria-label="Ask the mentor" placeholder="Ask about this lesson..." className="h-9 min-w-0 flex-1 rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-blue-400" />
                  <button type="submit" aria-label="Send" disabled={busy === "ask"} className="rounded-lg px-3 text-white disabled:opacity-50" style={{ backgroundColor: BLUE }}><Send className="h-4 w-4" /></button>
                </form>
                {busy === "ask" && <p className="mt-3 flex items-center gap-2 text-[12.5px] text-gray-500"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking...</p>}
                {mentor && (
                  <div className={`mt-3 rounded-xl p-3 text-[13px] leading-6 ${mentor.source === "error" ? "bg-red-50 text-red-700" : "bg-blue-50/60 text-gray-700"}`}>
                    <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-gray-400">{mentor.source === "ai" ? "AI generated" : mentor.source === "curated" ? "Curated content" : "Unavailable"}</p>
                    <p className="whitespace-pre-line">{mentor.text}</p>
                  </div>
                )}
              </Card>
            </div>

            {/* Right: workspace */}
            <div className="space-y-4 lg:col-span-4">
              <Card className="p-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[13.5px] font-bold">main.c <span className="ml-1 font-normal text-gray-400">C</span></p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => { editCode(exercise.starter); setResults(null); setAssessment(null); setCustom(null); }} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-[12px] font-semibold text-gray-600 hover:bg-gray-50"><RotateCcw className="h-3.5 w-3.5" /> Reset</button>
                    <button type="button" disabled={!!busy} onClick={run} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-[12px] font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">{busy === "run" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />} Run</button>
                    <button type="button" disabled={!!busy} onClick={submit} className="inline-flex items-center gap-1 rounded-lg px-3 py-1 text-[12px] font-bold text-white disabled:opacity-50" style={{ backgroundColor: BLUE }}>{busy === "submit" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Submit answer</button>
                  </div>
                </div>
                <CodeEditor value={code} onChange={editCode} label="C code editor" />
                <p className="mt-2 text-[11px] text-gray-400">Your code runs on the public Judge0 sandbox (ce.judge0.com), a shared third-party service with rate limits and no uptime guarantee. Your code and test input are sent to it. Do not paste secrets.</p>
                <div className="mt-2 flex gap-2">
                  <input value={customIn} onChange={(e) => setCustomIn(e.target.value)} aria-label="Custom input" placeholder="Custom input (optional)" className="h-8 min-w-0 flex-1 rounded-lg border border-gray-200 px-2 text-[12px] outline-none focus:border-blue-400" />
                  <button type="button" disabled={!!busy} onClick={runCustom} className="rounded-lg border border-gray-200 px-2.5 text-[12px] font-semibold text-gray-600 disabled:opacity-50">Run with input</button>
                </div>
              </Card>

              {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-[13px] text-red-700">{error}</div>}

              <Card className="p-4">
                <p className="text-[13.5px] font-bold">Test results and output</p>
                {!results && !custom && <p className="mt-2 text-[12.5px] text-gray-500">No execution yet. Press Run to compile and run your code against the visible tests.</p>}
                {custom && <div className="mt-2"><p className="text-[12px] text-gray-500">Input: <code>{custom.stdin || "(none)"}</code></p><pre className="mt-1 whitespace-pre-wrap rounded-lg bg-gray-50 p-2 text-[12px]">{custom.out}</pre></div>}
                {results && (
                  <ul className="mt-2 space-y-2">
                    {results.map((r, i) => (
                      <li key={i} className={`rounded-lg border p-2 text-[12px] ${r.passed ? "border-emerald-200 bg-emerald-50/50" : "border-red-200 bg-red-50/50"}`}>
                        <p className="font-semibold">{r.passed ? "Passed" : "Failed"}: {r.hidden && !assessment ? "Hidden test" : r.name}</p>
                        {!r.passed && (r.hidden && !assessment ? <p className="text-gray-500">Hidden test details appear after you submit.</p> : (<>
                          <p className="mt-1 text-gray-500">Expected</p><pre className="whitespace-pre-wrap rounded bg-white p-1">{r.expected}</pre>
                          <p className="mt-1 text-gray-500">Actual ({r.status})</p><pre className="whitespace-pre-wrap rounded bg-white p-1">{r.actual || "(no output)"}</pre>
                          {r.stderr && <><p className="mt-1 text-gray-500">Error output</p><pre className="whitespace-pre-wrap rounded bg-white p-1 text-red-600">{r.stderr.slice(0, 600)}</pre></>}
                        </>))}
                      </li>
                    ))}
                  </ul>
                )}
                {sandboxNote && results && <p className="mt-2 text-[11px] text-gray-400">Executed on {sandboxNote}.</p>}
              </Card>

              {assessment && (
                <Card className="p-4">
                  <div className="flex items-center gap-2"><p className="text-[13.5px] font-bold">Assessment</p><Pill tone={assessment.status === "passed" ? "green" : assessment.status === "needs_improvement" ? "amber" : "red"}>{assessment.status.replace("_", " ")}</Pill><span className="text-[12px] text-gray-500">{assessment.passed_tests}/{assessment.total_tests} tests, score {assessment.score}</span></div>
                  <p className="mt-2 text-[13px] text-gray-700">{assessment.feedback}</p>
                  {assessment.misconceptions.map((m) => (
                    <div key={m.id} className="mt-2 rounded-lg bg-amber-50 p-3 text-[12.5px] text-amber-900">
                      <p className="font-bold">{MISCONCEPTIONS[m.id]?.label}</p>
                      <p className="mt-0.5">Evidence: {m.evidence}</p>
                      <p className="mt-1">{MISCONCEPTIONS[m.id]?.explain}</p>
                    </div>
                  ))}
                  <p className="mt-3 text-[12.5px] text-gray-700"><b>Next step:</b> {decision}</p>
                  {assessment.status === "passed" && !rev && state.lessons[lesson.id]?.status === "completed" && state.currentLessonId !== lesson.id && null}
                  <NextButton state={state} lessonId={lesson.id} onGo={(id) => { setState_current(id); setTab("Explanation"); }} />
                </Card>
              )}

              <Card className="p-4">
                <div className="flex items-center justify-between"><p className="flex items-center gap-1.5 text-[13.5px] font-bold"><Lightbulb className="h-4 w-4 text-amber-500" /> Hints</p><span className="text-[11.5px] text-gray-400">{Math.min(hintsUsed, hintsAllowed)} / {hintsAllowed} used ({LEVEL_RULES[state.level].label})</span></div>
                {hintShown.map((h, i) => <p key={i} className="mt-2 rounded-lg bg-amber-50 p-2 text-[12.5px] text-amber-900">{h}</p>)}
                <button type="button" onClick={showHint} disabled={hintsUsed >= hintsAllowed} className="mt-2 rounded-lg border border-gray-200 px-3 py-1.5 text-[12px] font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">{hintsUsed >= hintsAllowed ? "No hints left for this lesson" : "Give me a hint"}</button>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );

  function setState_current(id: string) {
    const s = structuredClone(stateRef.current);
    s.currentLessonId = id;
    void commit(s);
  }
}

function NextButton({ state, lessonId, onGo }: { state: MentorState; lessonId: string; onGo: (id: string) => void }) {
  const done = state.lessons[lessonId]?.status === "completed";
  const next = LESSONS.find((l) => l.order > (lessonById(lessonId)?.order ?? 0) && state.lessons[l.id]?.status !== "locked");
  if (!done || !next) return null;
  return <button type="button" onClick={() => onGo(next.id)} className="mt-3 inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[12.5px] font-bold text-white" style={{ backgroundColor: BLUE }}>Next: {next.title} <ChevronRight className="h-4 w-4" /></button>;
}

/* --------------------------- Progress and revision --------------------------- */

const LEVEL_LABEL: Record<string, string> = { not_started: "Not started", beginner: "Beginner", developing: "Developing", proficient: "Proficient", mastered: "Mastered" };

function ProgressPanel({ state, onRevision }: { state: MentorState; onRevision: (id: string) => void }) {
  const o = masteryOverview(state);
  const revs = dueRevisions(state);
  const stats = [["Lessons completed", o.lessonsCompleted], ["Exercises attempted", o.exercisesAttempted], ["Submissions", o.submissions], ["Tests passed", o.testsPassed], ["Skills confirmed mastered", o.mastered], ["Skills needing work", o.needsWork]] as const;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {stats.map(([k, v]) => <Card key={k} className="p-3"><p className="text-[11px] text-gray-400">{k}</p><p className="mt-1 text-[22px] font-extrabold">{v}</p></Card>)}
      </div>
      <Card className="p-5">
        <h2 className="text-[14px] font-bold">Competency evidence</h2>
        <p className="text-[12px] text-gray-400">Mastery is estimated from practical passes. It is only confirmed after you pass a delayed reassessment.</p>
        <ul className="mt-3 space-y-2">
          {Object.values(state.competencies).map((c) => (
            <li key={c.skill} className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-100 p-2.5 text-[12.5px]">
              <span className="min-w-[180px] flex-1 font-semibold">{SKILLS[c.skill]}</span>
              <Pill tone={c.level === "mastered" ? "green" : c.level === "proficient" ? "blue" : c.level === "not_started" ? "gray" : "amber"}>{LEVEL_LABEL[c.level]}{c.level !== "not_started" ? (c.confirmed ? " (confirmed)" : " (estimated)") : ""}</Pill>
              <span className="text-gray-500">{c.practicePasses} passes, {c.independentPasses} without hints, {c.failures} failed, {c.revisionPasses} revision passes</span>
            </li>
          ))}
        </ul>
      </Card>
      <Card className="p-5">
        <h2 className="text-[14px] font-bold">Recurring mistakes</h2>
        {Object.values(state.misconceptions).length === 0 ? <p className="mt-2 text-[12.5px] text-gray-500">None recorded yet. Misconceptions only appear when real test evidence shows one.</p> : (
          <ul className="mt-2 space-y-2">{Object.values(state.misconceptions).map((m) => (
            <li key={m.id} className="rounded-lg border border-gray-100 p-2.5 text-[12.5px]"><b>{MISCONCEPTIONS[m.id]?.label}</b> <Pill tone={m.status === "resolved" ? "green" : m.status === "improving" ? "blue" : "amber"}>{m.status}</Pill> <span className="text-gray-500">seen {m.count}x. {m.evidence}</span></li>
          ))}</ul>
        )}
      </Card>
      <Card className="p-5">
        <h2 className="text-[14px] font-bold">Revision tasks</h2>
        <p className="text-[12px] text-gray-400">Scheduled after assessments: later today, next day, then three days. Each one is a fresh exercise, not a re-read.</p>
        {revs.length === 0 ? <p className="mt-2 text-[12.5px] text-gray-500">No revision tasks yet. They are scheduled after your first assessment.</p> : (
          <ul className="mt-2 space-y-2">{revs.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-100 p-2.5 text-[12.5px]">
              <span className="min-w-[200px] flex-1"><b>{r.concept}</b><span className="block text-gray-500">{r.reason}. {r.due ? "Due now" : `Due ${new Date(r.dueAt).toLocaleString()}`}</span></span>
              <button type="button" onClick={() => onRevision(r.id)} className="rounded-lg border border-gray-200 px-3 py-1.5 font-semibold text-blue-600 hover:bg-gray-50">{r.due ? "Start revision" : "Start early"}</button>
            </li>
          ))}</ul>
        )}
      </Card>
      <Card className="p-5">
        <h2 className="text-[14px] font-bold">Learning history</h2>
        <ul className="mt-2 max-h-56 space-y-1 overflow-auto text-[12px] text-gray-600">{[...state.events].reverse().slice(0, 30).map((e, i) => <li key={i}><span className="text-gray-400">{new Date(e.ts).toLocaleTimeString()}</span> {e.detail}</li>)}</ul>
      </Card>
    </div>
  );
}

export { useMemo };
