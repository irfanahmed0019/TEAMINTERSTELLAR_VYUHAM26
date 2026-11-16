import {
  newInteractionClock,
  sampleInteractionClock,
  interactClock,
  startInteractionClock,
  pauseInteractionClock,
} from "@/lib/interaction-clock";
import { performanceSummary } from "@/lib/performance-evidence";
import { useEffect, useRef, useState } from "react";
import type { Profile } from "@/lib/loop-types";
import type { AssessmentEvidence } from "@/lib/assessment-evidence";
import type { TestResult } from "@/lib/mentor/engine";
import { mentorApi } from "@/lib/mentor/persistence";
import { getAuthSession, useAuth } from "@/lib/auth";
import {
  acceptInitialCodingResult,
  scaffoldInitialCoding,
  estimatedCodingStart,
  codingSupportSummary,
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
  const clock = useRef(newInteractionClock());
  const timingEnabled = useRef(false);
  const [clockView, setClockView] = useState({
    activeMs: 0,
    running: false,
    enabled: false,
  });
  const scaffoldCheck = useRef<() => boolean>(() => false);
  const draftWriter = useRef(() => {});
  draftWriter.current = () => saveDraft(code, hint);
  function refreshClock() {
    setClockView({
      activeMs: clock.current.activeMs,
      running: clock.current.running,
      enabled: timingEnabled.current,
    });
  }
  function eligible() {
    return document.visibilityState === "visible" && document.hasFocus();
  }
  useEffect(() => {
    let ticks = 0;
    const timer = window.setInterval(() => {
      clock.current = sampleInteractionClock(
        clock.current,
        performance.now(),
        eligible(),
      );
      refreshClock();
      const changed = scaffoldCheck.current();
      if (!changed && clock.current.running && ++ticks % 10 === 0)
        draftWriter.current();
    }, 1000);
    const suspend = () => {
      clock.current = {
        ...sampleInteractionClock(clock.current, performance.now(), false),
        activityAt: null,
      };
      refreshClock();
      if (timingEnabled.current) draftWriter.current();
    };
    window.addEventListener("blur", suspend);
    document.addEventListener("visibilitychange", suspend);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("blur", suspend);
      document.removeEventListener("visibilitychange", suspend);
    };
  }, []);
  function toggleClock() {
    timingEnabled.current = true;
    clock.current = clock.current.running
      ? pauseInteractionClock(clock.current, performance.now(), eligible())
      : startInteractionClock(clock.current, performance.now());
    refreshClock();
    draftWriter.current();
  }
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
    const savedMs =
      saved?.taskId === taskId && saved.language === taskLanguage
        ? saved.observedMs
        : undefined;
    clock.current = startInteractionClock(
      newInteractionClock(savedMs ?? 0),
      performance.now(),
    );
    timingEnabled.current = true;
    refreshClock();
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
        observedMs: timingEnabled.current
          ? Math.round(clock.current.activeMs)
          : undefined,
      },
    });
  }
  scaffoldCheck.current = () => {
    if (
      !d ||
      !task ||
      busy ||
      !auth ||
      getAuthSession()?.uid !== auth.uid ||
      !timingEnabled.current
    )
      return false;
    const next = scaffoldInitialCoding(
      d,
      task.id,
      code,
      hint,
      clock.current.activeMs,
      Date.now(),
    );
    if (next !== d) {
      clock.current = pauseInteractionClock(
        clock.current,
        performance.now(),
        eligible(),
      );
      onChange(next);
      return true;
    }
    return false;
  };
  function showHint() {
    setHint(true);
    saveDraft(code, true);
  }
  function updateCode(next: string) {
    clock.current = interactClock(clock.current, performance.now(), eligible());
    refreshClock();
    setCode(next);
    saveDraft(next, hint);
  }
  async function submit() {
    if (!d || !task || busy || !auth || getAuthSession()?.uid !== auth.uid)
      return;
    clock.current = pauseInteractionClock(
      clock.current,
      performance.now(),
      eligible(),
    );
    refreshClock();
    draftWriter.current();
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
          ...(timingEnabled.current
            ? { observedMs: Math.round(clock.current.activeMs) }
            : {}),
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
        Two authored coding checks, starting at an estimated level from your
        short calibration and reported background. This is a starting
        hypothesis, not verified skill. C and Python only. The suggested concept
        uses your reported goals, not proven skills. Frameworks and other
        languages remain unassessed.
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
            disabled={profile.initialDiagnostic?.status !== "completed"}
            onClick={() =>
              onChange({
                version: 1,
                startingLevel: estimatedCodingStart(profile),
                language,
                topicId: topic,
                submissions: [],
              })
            }
            className="btn-base btn-outline"
          >
            Start optional coding check
          </button>
          {profile.initialDiagnostic?.status !== "completed" && (
            <p className="text-xs text-muted-foreground">
              Complete the two short calibration questions first. You can still
              continue onboarding unassessed without inventing results.
            </p>
          )}
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
      {codingSupportSummary(d) && (
        <p role="status" className="mt-3 rounded-xl bg-muted p-3 text-sm">
          {codingSupportSummary(d)}
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
          <p>
            {
              performanceSummary({
                passed: result.evidence.passed,
                total: result.evidence.total,
                performance: result.evidence.performance,
              }).text
            }
          </p>
          {result.evidence.performance?.timingQuality ===
            "browser-interaction-observed" && (
            <p>
              Authored benchmark:{" "}
              {(result.evidence.performance.expectedMs ?? 0) / 60000} min.
              Browser-reported observed interaction:{" "}
              {Math.round((result.evidence.performance.activeMs ?? 0) / 1000)}{" "}
              sec. Difference:{" "}
              {(
                ((result.evidence.performance.activeMs ?? 0) -
                  (result.evidence.performance.expectedMs ?? 0)) /
                60000
              ).toFixed(1)}{" "}
              min.
            </p>
          )}
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
          <p className="text-xs text-muted-foreground">
            Authored benchmark: {task.expectedMinutes} minutes, not a measured
            population average. The clock estimates visible, focused interaction
            windows, not active thinking time. Hidden, blurred, paused,
            runner-wait and idle time beyond 30 seconds since editing are
            excluded. The clock starts with this task and can be paused.
            {task.level === "transfer"
              ? " Exceeding the benchmark offers a simpler question immediately."
              : " This is already the simplest authored level; pause or use a hint when needed."}
            Timing never creates a failed grade.
          </p>
          <div className="rounded-xl bg-muted p-3 text-xs leading-5">
            <p>
              {clockView.enabled
                ? `${Math.round(clockView.activeMs / 1000)} sec browser-reported interaction (${clockView.running ? "running with 30-second idle limit" : "paused"})`
                : "Interaction timing is off. Starting it is optional."}
            </p>
            <button
              type="button"
              className="btn-base btn-outline mt-2"
              disabled={busy}
              onClick={toggleClock}
            >
              {clockView.running
                ? "Pause interaction clock"
                : "Start / resume interaction clock"}
            </button>
          </div>
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
