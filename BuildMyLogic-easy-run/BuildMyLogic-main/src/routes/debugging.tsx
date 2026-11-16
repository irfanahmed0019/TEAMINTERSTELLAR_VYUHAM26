import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { CodeEditor } from "@/components/mentor/CodeEditor";
import {
  DEBUGGING_TASKS,
  gradeDebugging,
  ingestDebuggingResult,
} from "@/lib/debugging-practice";
import { getAuthEpoch, getAuthSession, useAuth } from "@/lib/auth";
import { isReadyCloudOwner } from "@/lib/cloud-readiness";
import { setLoopState } from "@/lib/loop-store";
export const Route = createFileRoute("/debugging")({
  head: () => ({ meta: [{ title: "Debugging practice - BuildMyLogic" }] }),
  component: Debugging,
});
function Debugging() {
  const auth = useAuth(),
    [index, setIndex] = useState(0),
    task = DEBUGGING_TASKS[index]!;
  const [code, setCode] = useState<string>(task.starter),
    [busy, setBusy] = useState(false),
    [hint, setHint] = useState(false),
    [error, setError] = useState(""),
    [results, setResults] = useState<ReturnType<typeof gradeDebugging> | null>(
      null,
    ),
    [note, setNote] = useState("");
  const gate = useRef(false);
  useEffect(() => {
    setResults(null);
    setNote("");
    setError("");
    setCode(DEBUGGING_TASKS[0].starter);
    setIndex(0);
    setHint(false);
  }, [auth?.uid]);
  async function check() {
    if (gate.current) return;
    const owner = getAuthSession()?.uid,
      epoch = getAuthEpoch();
    if (!owner || !isReadyCloudOwner(owner)) {
      setError(
        "Sign in and wait for your saved progress to load before checking.",
      );
      return;
    }
    gate.current = true;
    setBusy(true);
    setError("");
    setResults(null);
    setNote("");
    try {
      const submitted = code;
      const res = await fetch("/api/mentor/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          language: "python",
          code: submitted,
          stdins: task.tests.map((t) => t.stdin),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok)
        throw Error(data.error || "Execution failed. No evidence recorded.");
      const graded = gradeDebugging(task, data.items);
      const raw = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(submitted),
      );
      const digest = Array.from(new Uint8Array(raw), (b) =>
        b.toString(16).padStart(2, "0"),
      ).join("");
      if (
        getAuthEpoch() !== epoch ||
        getAuthSession()?.uid !== owner ||
        !isReadyCloudOwner(owner)
      )
        throw Error("Account changed. This result was not saved.");
      let added = false;
      setLoopState((prev) => {
        const next = ingestDebuggingResult(
          prev,
          owner,
          task,
          digest,
          graded,
          Date.now(),
          hint,
        );
        added = next !== prev;
        return next;
      });
      setResults(graded);
      setNote(
        added
          ? "Checked result recorded in Progress and Struggle DNA."
          : "This exact code was already recorded. No duplicate progress added.",
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to check. No evidence recorded.",
      );
    } finally {
      gate.current = false;
      setBusy(false);
    }
  }
  return (
    <AppShell
      crumb="DEBUGGING"
      title="Fix the bug"
      subtitle="Read broken Python code, repair it, then check the actual output."
    >
      <div className="mb-5 flex flex-wrap gap-3">
        <Link to="/progress" className="btn-base btn-outline">
          View competency radar
        </Link>
        <Link to="/learn" className="btn-base btn-outline">
          Back to Learn
        </Link>
      </div>
      <p className="mb-5 rounded-xl bg-primary-soft p-4 text-sm">
        Only checked output updates Debugging. Opening a task, showing a hint or
        resetting code adds no score. Four visible finite checks are
        client-graded from sandbox output, not proof of independence or
        whole-skill mastery. Code is sent to the existing remote Python sandbox
        only when you press Check fix. No AI call is made.
      </p>
      <div className="mb-5 flex flex-wrap gap-2">
        {DEBUGGING_TASKS.map((t, i) => (
          <button
            key={t.id}
            disabled={busy}
            onClick={() => {
              setIndex(i);
              setCode(t.starter);
              setResults(null);
              setHint(false);
              setError("");
              setNote("");
            }}
            className={`btn-base ${i === index ? "btn-primary-solid" : "btn-outline"}`}
          >
            {t.title}
          </button>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card-surface p-5">
          <h2 className="text-xl font-bold">{task.title}</h2>
          <p className="my-3">{task.task}</p>
          <h3 className="font-bold">Checks</h3>
          <ul>
            {task.tests.map((t) => (
              <li key={t.stdin} className="mt-2 font-mono text-sm">
                Input {t.stdin} → {t.expected}
              </li>
            ))}
          </ul>
          <button
            className="btn-base btn-outline mt-4"
            onClick={() => setHint(true)}
          >
            Show hint
          </button>
          {hint && <p className="mt-3 text-sm">{task.hint}</p>}
          <p className="mt-4 text-sm text-muted-foreground">
            Fix the given program. Passing these visible examples can be
            hardcoded, so this is bounded practice evidence, not a mastery
            certificate. Failed checks also remain in your history.
          </p>
        </section>
        <section className="card-surface p-5">
          <CodeEditor
            value={code}
            onChange={(next) => {
              if (!busy) {
                setCode(next);
                setResults(null);
                setNote("");
              }
            }}
            language="python"
            label="Debugging Python editor"
          />
          <div className="mt-4 flex gap-3">
            <button
              className="btn-base btn-primary-solid"
              disabled={busy || !auth}
              onClick={() => void check()}
            >
              {busy ? "Checking..." : "Check fix"}
            </button>
            <button
              disabled={busy}
              className="btn-base btn-outline"
              onClick={() => {
                setCode(task.starter);
                setResults(null);
                setNote("");
                setError("");
              }}
            >
              Reset broken code
            </button>
          </div>
          {error && (
            <p role="alert" className="mt-3 text-red-700">
              {error}
            </p>
          )}
          {note && (
            <p role="status" className="mt-3 text-sm">
              {note}
            </p>
          )}
          {results && (
            <div
              className="mt-4 space-y-2"
              aria-label="Debugging check results"
            >
              {results.map((r) => (
                <div
                  key={r.name}
                  className={`rounded-xl p-3 ${r.passed ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-900"}`}
                >
                  <b>
                    {r.passed ? "Passed" : "Not passed"}: {r.name}
                  </b>
                  <p className="whitespace-pre-wrap text-sm">
                    Expected: {r.expected}. Actual: {r.actual || "(no output)"}
                    {r.stderr ? "\n" + r.stderr : ""}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
