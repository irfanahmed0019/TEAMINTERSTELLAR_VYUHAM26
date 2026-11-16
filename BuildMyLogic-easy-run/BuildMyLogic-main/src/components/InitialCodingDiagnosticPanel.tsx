import { useEffect, useRef, useState } from "react";
import type { Profile } from "@/lib/loop-types";
import type { AssessmentEvidence } from "@/lib/assessment-evidence";
import type { TestResult } from "@/lib/mentor/engine";
import { mentorApi } from "@/lib/mentor/persistence";
import { getAuthSession, useAuth } from "@/lib/auth";
import {
  acceptInitialCodingResult,
  codingTopicOptions,
  nextInitialCodingTask,
  suggestedCodingTopic,
  type CodingLanguage,
  type InitialCodingDiagnostic,
} from "@/lib/initial-coding-diagnostic";

type Response = {
  ok: boolean;
  taskId: string;
  language: CodingLanguage;
  evidence: AssessmentEvidence;
  results: TestResult[];
  sandbox: string;
  scope: string;
};
export function InitialCodingDiagnosticPanel({
  profile,
  onChange,
}: {
  profile: Profile;
  onChange: (
    state: InitialCodingDiagnostic,
    evidence?: AssessmentEvidence,
  ) => void;
}) {
  const auth = useAuth();
  const d = profile.initialCodingDiagnostic;
  const [language, setLanguage] = useState<CodingLanguage>(
    d?.language ?? "python",
  );
  const [topic, setTopic] = useState(
    d?.topicId ?? suggestedCodingTopic(profile),
  );
  const task = d ? nextInitialCodingTask(d) : null;
  const taskId = task?.id;
  const taskLanguage = task?.language;
  const starterCode = task?.starterCode;
  const uid = auth?.uid;
  const [code, setCode] = useState("");
  const [hint, setHint] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Response | null>(null);
  const currentTask = useRef(task?.id);
  currentTask.current = task?.id;
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!taskId || !taskLanguage || starterCode === undefined || !uid) return;
    const saved = d?.draft;
    setCode(
      saved?.taskId === taskId && saved.language === taskLanguage
        ? saved.code
        : starterCode,
    );
    setHint(
      saved?.taskId === taskId && saved.language === taskLanguage
        ? saved.hintUsed
        : false,
    );
    setError("");
    // Restore drafts from the existing account-bound learner profile only.
    // Do not create a second raw-code cache outside its sign-out/recovery lifecycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, taskLanguage, starterCode, uid]);
  useEffect(() => {
    setResult(null);
  }, [uid]);
  function saveDraft(nextCode: string, nextHint: boolean) {
    if (!d || !task || !auth || getAuthSession()?.uid !== auth.uid) return;
    onChange({
      ...d,
      draft: {
        taskId: task.id,
        language: task.language,
        code: nextCode,
        hintUsed: nextHint,
      },
    });
  }
  function showHint() {
    setHint(true);
    saveDraft(code, true);
  }
  function updateCode(next: string) {
    setCode(next);
    saveDraft(next, hint);
  }
  async function submit() {
    if (!d || !task || busy || !auth || getAuthSession()?.uid !== auth.uid)
      return;
    const owner = auth.uid;
    const selected = task;
    setBusy(true);
    setError("");
    try {
      const response = await mentorApi<Response>("/api/mentor/diagnostic", {
        method: "POST",
        body: {
          taskId: selected.id,
          language: selected.language,
          code,
          hintUsed: hint,
        },
      });
      if (
        !mounted.current ||
        getAuthSession()?.uid !== owner ||
        currentTask.current !== selected.id
      )
        return;
      if (
        !response.ok ||
        response.taskId !== selected.id ||
        response.language !== selected.language
      )
        throw new Error(
          "The coding check returned an unexpected task. No result was saved.",
        );
      const next = acceptInitialCodingResult(
        d,
        selected,
        response.evidence,
        owner,
      );
      if (next === d)
        throw new Error(
          "The coding result could not be attributed to this task and account. No result was saved.",
        );
      setResult(response);
      onChange(next, response.evidence);
    } catch (e) {
      if (mounted.current && getAuthSession()?.uid === owner)
        setError(
          e instanceof Error
            ? e.message
            : "Coding check unavailable. No failure result was recorded.",
        );
    } finally {
      if (mounted.current && getAuthSession()?.uid === owner) setBusy(false);
    }
  }
  return (
    <section
      aria-label="Initial practical coding"
      className="my-4 rounded-2xl border border-border bg-background p-4"
    >
      <h3 className="font-bold">Try a practical coding check</h3>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        Optional: two authored coding tasks, starting with an estimated medium
        transfer task. C and Python only. The suggested concept uses your
        reported goals, not proven skills. Frameworks and other languages remain
        unassessed.
      </p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        Submitting sends your code and test inputs to the existing public Judge0
        CE sandbox. No AI analysis is called. Finite output checks do not prove
        code structure, independent work or general mastery. You can continue
        onboarding without submitting.
      </p>
      {!d && (
        <div className="mt-3 grid gap-3">
          <label className="text-sm">
            Language
            <select
              aria-label="Coding language"
              value={language}
              onChange={(e) => setLanguage(e.target.value as CodingLanguage)}
              className="mt-1 w-full rounded-xl border border-border bg-background p-2"
            >
              <option value="python">Python</option>
              <option value="c">C</option>
            </select>
          </label>
          <label className="text-sm">
            Concept (suggestion, editable)
            <select
              aria-label="Coding concept"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-background p-2"
            >
              {codingTopicOptions().map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() =>
              onChange({
                version: 1,
                language,
                topicId: topic,
                submissions: [],
              })
            }
            className="btn-base btn-outline"
          >
            Start optional coding check
          </button>
        </div>
      )}
      {d && (
        <p role="status" className="mt-3 text-sm">
          {d.submissions.length} of 2 coding submissions recorded.{" "}
          {d.submissions.length === 2
            ? "Checks finished, not necessarily passed."
            : "A failed check offers a smaller task on the same concept; a full pass moves to a related challenge."}
        </p>
      )}
      {result && (
        <div className="my-3 rounded-xl bg-muted p-3 text-xs leading-5">
          <p>
            {result.evidence.passed}/{result.evidence.total} output checks
            passed. Hints reported: {result.evidence.hintsUsed}.
          </p>
          <p>{result.sandbox}</p>
          <p>{result.scope}</p>
          <details>
            <summary>Check results</summary>
            {result.results.map((r, i) => (
              <div key={i} className="mt-2">
                <p>
                  {r.name}: {r.passed ? "Passed" : "Not passed"} ({r.status})
                </p>
                <pre className="whitespace-pre-wrap break-words">
                  Expected: {r.expected}
                  {"\n"}Actual: {r.actual}
                  {r.stderr ? `\n${r.stderr}` : ""}
                </pre>
              </div>
            ))}
          </details>
        </div>
      )}
      {task && (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-muted-foreground">
            Task {(d?.submissions.length ?? 0) + 1}/2 ·{" "}
            {task.language.toUpperCase()} · {task.level}
          </p>
          <h4 className="font-semibold">{task.title}</h4>
          <p className="whitespace-pre-wrap text-sm leading-6">{task.task}</p>
          <p className="text-xs text-muted-foreground">{task.difficultyNote}</p>
          <label className="block text-sm">
            Your program
            <textarea
              aria-label="Initial coding program"
              value={code}
              maxLength={12000}
              onChange={(e) => updateCode(e.target.value)}
              rows={10}
              disabled={busy}
              spellCheck={false}
              className="mt-2 w-full rounded-xl border border-border bg-background p-3 font-mono text-sm"
            />
          </label>
          <button
            type="button"
            onClick={showHint}
            disabled={busy}
            className="btn-base btn-outline"
          >
            Show task hint
          </button>
          {hint && <p className="text-sm leading-6">{task.hint}</p>}
          <button
            type="button"
            disabled={busy || !code.trim()}
            onClick={() => void submit()}
            className="btn-base btn-primary-solid w-full"
          >
            {busy ? "Running server-owned checks…" : "Submit this coding check"}
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error} If the runner is unavailable, retry or continue onboarding. No
          unavailable run is recorded as a failed assessment.
        </p>
      )}
    </section>
  );
}
