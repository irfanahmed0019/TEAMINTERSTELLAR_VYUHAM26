import { diagnosticContinueLabel } from "@/lib/intake-state";
import { useState } from "react";
import { aiInitialDiagnostic } from "@/lib/sarvam.functions";
import {
  answerDiagnostic,
  nextDiagnostic,
  type InitialDiagnostic,
} from "@/lib/initial-diagnostic";
import type { Profile } from "@/lib/loop-types";
export function InitialDiagnosticPanel({
  profile,
  onChange,
  onContinue,
}: {
  profile: Profile;
  onChange: (d: InitialDiagnostic) => void;
  onContinue: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const d = profile.initialDiagnostic;
  const q = d?.status === "in_progress" ? nextDiagnostic(d) : null;
  const last = d?.answers.at(-1);
  async function generate() {
    setBusy(true);
    setError("");
    try {
      const result = await aiInitialDiagnostic({ data: { profile } });
      onChange({
        version: 1,
        source: "ai",
        status: "in_progress",
        questions: result.questions,
        answers: [],
        evidence: "client_graded_prediction_not_code_execution",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Diagnostic unavailable.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mt-4 rounded-2xl border border-border bg-background p-5">
      <h3 className="font-bold">Check your starting point</h3>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        Six adaptive concept, prediction, debugging and reasoning questions
        based on your goal and resume claims. AI-authored answer keys are
        provisional and client-graded. This is not code execution, verified
        mastery, or proof of unaided work. Practical coding is assessed
        separately in Learn and Sessions.
      </p>
      {!d && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void generate()}
          className="btn-base btn-outline mt-3"
        >
          {busy ? "Preparing questions…" : "Prepare personalized diagnostic"}
        </button>
      )}
      {last && (
        <p role="status" className="mt-4 rounded-xl bg-muted p-3 text-sm">
          {last.correct
            ? "Answer matches the key."
            : "Answer does not match the key."}{" "}
          {last.question.explanation}
        </p>
      )}
      {q && (
        <div className="mt-4">
          <p className="text-xs text-muted-foreground">
            Question {(d?.answers.length ?? 0) + 1} of 6 · {q.kind} · difficulty{" "}
            {q.difficulty}/3
          </p>
          <pre className="my-3 whitespace-pre-wrap font-sans text-sm leading-6">
            {q.prompt}
          </pre>
          <div className="grid gap-2">
            {q.options.map((o, i) => (
              <button
                type="button"
                key={i}
                onClick={() => {
                  if (d) onChange(answerDiagnostic(d, i, Date.now()));
                }}
                className="rounded-xl border border-border p-3 text-left text-sm hover:border-primary"
              >
                {o}
              </button>
            ))}
          </div>
        </div>
      )}
      {d?.status === "completed" && (
        <p className="mt-4 text-sm">
          Initial checks: {d.answers.filter((a) => a.correct).length}/
          {d.answers.length} match the answer keys. Your roadmap will use this
          provisional evidence, not treat resume claims as verified strengths.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error} No result was invented. Retry or continue unassessed.
        </p>
      )}
      {error && (
        <button
          type="button"
          onClick={() => void generate()}
          disabled={busy}
          className="btn-base btn-outline mt-2"
        >
          Retry diagnostic
        </button>
      )}
      <button
        type="button"
        onClick={onContinue}
        disabled={busy}
        className="btn-base btn-primary-solid mt-4 w-full"
      >
        {diagnosticContinueLabel(d)}
      </button>
    </section>
  );
}
