import { useState } from "react";
import { Check, Crosshair, Lightbulb, Loader2, Play, RotateCcw, Send } from "lucide-react";
import { CodeEditor } from "@/components/mentor/CodeEditor";
import { gradeRun, type RunItem, type TestResult } from "@/lib/mentor/engine";
import { recordPracticeOutcome, useLoop } from "@/lib/loop-store";
import type { TopicExercise, TopicLanguage } from "@/lib/topic-library";

const errMsg = (e: unknown) =>
  e instanceof Error ? e.message : "Something went wrong.";

/**
 * Basic practice workshop for one study topic: the mentor's task on the left,
 * a real code editor with Run / Reset / Submit on the right. Code executes on
 * the Judge0 sandbox through /api/mentor/run and Submit compares the real
 * output with the expected result - nothing is faked. The code draft is kept
 * in this browser (localStorage) so a reload doesn't lose it; results are not
 * stored as verified progress.
 */
export function TopicPractice({
  topicId,
  topicTitle,
  language,
  exercise,
}: {
  topicId: string;
  topicTitle: string;
  language: TopicLanguage;
  exercise: TopicExercise;
}) {
  const struggle = useLoop().struggle;
  const activeMisconception = (struggle?.misconceptions ?? []).find(
    (m) => m.status === "locked" && m.topicId === topicId && m.language === language
  );
  const draftKey = `bml.practice.${topicTitle}.${language}`;
  const [code, setCode] = useState(() => {
    try {
      const saved = window.localStorage.getItem(draftKey);
      return saved !== null && saved !== "" ? saved : exercise.starterCode;
    } catch {
      return exercise.starterCode;
    }
  });
  const [results, setResults] = useState<TestResult[] | null>(null);
  const [passed, setPassed] = useState(false);
  const [output, setOutput] = useState("");
  const [hintShown, setHintShown] = useState(false);
  const [sandboxNote, setSandboxNote] = useState("");
  const [busy, setBusy] = useState<"run" | "submit" | null>(null);
  const [error, setError] = useState("");

  function updateCode(next: string) {
    setCode(next);
    try {
      window.localStorage.setItem(draftKey, next);
    } catch {
      // Storage full or blocked - the draft just won't survive a reload.
    }
  }

  async function execute(stdins: string[]): Promise<RunItem[]> {
    const res = await fetch("/api/mentor/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ language, code, stdins }),
    });
    const data = (await res.json().catch(() => null)) as
      | ({ ok: boolean; error?: string } & {
          items: RunItem[];
          sandbox: string;
        })
      | null;
    if (!res.ok || !data || data.ok === false)
      throw new Error(data?.error || `Request failed (${res.status}).`);
    setSandboxNote(data.sandbox);
    return data.items;
  }

  async function run() {
    setBusy("run");
    setError("");
    setOutput("");
    try {
      const visible = exercise.tests.filter((t) => !t.hidden);
      const items = await execute(visible.map((t) => t.stdin));
      const first = items[0]!;
      setOutput(
        first.statusId === 3
          ? first.stdout || "(no output)"
          : `${first.status}\n${first.compileOutput || first.stderr}`.trim(),
      );
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  }

  async function submit() {
    setBusy("submit");
    setError("");
    try {
      const items = await execute(exercise.tests.map((t) => t.stdin));
      const graded = gradeRun(exercise.tests, items);
      setResults(graded);
      setPassed(graded.every((g) => g.passed));
      setOutput("");
      // Struggle Engine: every real Submit outcome is evidence. Repeated
      // failures lock a misconception + targeted fix; a full pass after a
      // locked pattern conquers it (celebrated app-wide).
      recordPracticeOutcome({
        topicId,
        topicTitle,
        language,
        exerciseTitle: exercise.title,
        exerciseHint: exercise.hint,
        graded,
      });
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Task panel */}
      <div className="rounded-2xl border border-border bg-card p-5">
        {activeMisconception && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3.5">
            <p className="flex items-center gap-1.5 text-[12px] font-black uppercase tracking-widest text-amber-700">
              <Crosshair className="h-3.5 w-3.5" /> Targeted fix for your pattern
            </p>
            <p className="mt-1.5 text-[13px] font-bold text-amber-900">
              {activeMisconception.summary}
            </p>
            <p className="mt-1.5 text-[12.5px] font-medium leading-5 text-amber-900">
              {activeMisconception.targetedChallenge?.task}
            </p>
            <p className="mt-2 text-[11.5px] font-semibold text-amber-700">
              Beat this and the pattern counts as conquered on your Progress page.
            </p>
          </div>
        )}
        <span className="pill bg-primary-soft font-bold text-accent-foreground">
          Mentor's basic task
        </span>
        <h3 className="display mt-3 text-[18px] font-extrabold tracking-[-0.02em]">
          {exercise.title}
        </h3>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {exercise.task}
        </p>
        <p className="mt-4 text-[12px] font-black uppercase tracking-widest text-muted-foreground">
          Instructions
        </p>
        <ol className="mt-2 space-y-1.5">
          {exercise.instructions.map((step, i) => (
            <li
              key={i}
              className="flex items-start gap-2 text-[13px] font-medium"
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[11px] font-black text-primary">
                {i + 1}
              </span>
              <span className="pt-0.5">{step}</span>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-[12px] font-black uppercase tracking-widest text-muted-foreground">
          Expected output
        </p>
        <pre className="mt-2 overflow-x-auto rounded-xl border border-border bg-muted p-3 text-[12.5px] font-semibold text-foreground">
          <code>{exercise.expectedOutput}</code>
        </pre>
        {hintShown ? (
          <p className="mt-3 rounded-xl bg-amber-50 p-3 text-[12.5px] font-semibold text-amber-800">
            💡 {exercise.hint}
          </p>
        ) : (
          <button
            type="button"
            onClick={() => setHintShown(true)}
            className="btn-base btn-outline mt-3 text-xs"
          >
            <Lightbulb className="h-3.5 w-3.5" /> Show a hint
          </button>
        )}
        {passed && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5">
            <p className="flex items-center gap-1.5 text-[13px] font-black text-emerald-700">
              <Check className="h-4 w-4" /> Correct output - all checks passed.
            </p>
            <p className="mt-1.5 text-[12.5px] font-medium leading-5 text-emerald-900">
              {exercise.explain}
            </p>
          </div>
        )}
        {results && !passed && (
          <div className="mt-4 space-y-2">
            <p className="text-[13px] font-black text-amber-700">
              Not quite yet. Check the failing test, fix the code and submit
              again.
            </p>
            {results.map((r) => (
              <div
                key={r.name}
                className={`rounded-xl border p-3 text-[12.5px] ${r.passed ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}
              >
                <p className="font-bold">
                  {r.passed ? "✓" : "✗"} {r.name}
                </p>
                {!r.passed && (
                  <>
                    <p className="mt-1 font-semibold">
                      Expected:{" "}
                      <code className="rounded bg-black/5 px-1">
                        {r.expected || "(nothing)"}
                      </code>
                    </p>
                    <p className="font-semibold">
                      Your output:{" "}
                      <code className="rounded bg-black/5 px-1">
                        {r.actual || "(nothing)"}
                      </code>
                    </p>
                    {r.stderr && (
                      <p className="mt-1 whitespace-pre-wrap text-red-700">
                        {r.stderr}
                      </p>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Editor panel */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[13px] font-black">
            {language === "c" ? "main.c" : "main.py"}
          </p>
          <span className="pill bg-muted font-bold text-muted-foreground">
            {language === "c" ? "C" : "Python"}
          </span>
        </div>
        <div className="mt-3">
          <CodeEditor
            value={code}
            onChange={updateCode}
            language={language}
            label={`Code editor for ${exercise.title}`}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void run()}
            className="btn-base btn-primary-solid text-xs font-bold"
          >
            {busy === "run" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}{" "}
            Run
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => {
              updateCode(exercise.starterCode);
              setResults(null);
              setOutput("");
              setPassed(false);
            }}
            className="btn-base btn-outline text-xs"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void submit()}
            className="btn-base btn-ink text-xs font-bold"
          >
            {busy === "submit" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}{" "}
            Submit Task
          </button>
        </div>
        {error && (
          <p
            role="alert"
            className="mt-3 rounded-xl bg-red-50 p-3 text-[12.5px] font-semibold text-red-700"
          >
            {error}
          </p>
        )}
        {output && (
          <>
            <p className="mt-3 text-[12px] font-black uppercase tracking-widest text-muted-foreground">
              Output
            </p>
            <pre className="mt-2 overflow-x-auto rounded-xl border border-border bg-muted p-3 text-[12.5px] font-semibold text-foreground">
              <code>{output}</code>
            </pre>
          </>
        )}
        <p className="mt-3 text-[11px] font-semibold text-muted-foreground">
          Runs for real{sandboxNote ? ` on the ${sandboxNote}` : ""}; Submit
          compares your actual output with the expected result. Your code draft
          stays in this browser; every Submit counts as real struggle evidence
          on your Progress page.
        </p>
      </div>
    </div>
  );
}
