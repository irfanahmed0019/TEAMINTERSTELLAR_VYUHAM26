import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FlaskConical,
  Lightbulb,
  ShieldCheck,
} from "lucide-react";
import { REVIEW_CHALLENGES, reviewTest } from "@/lib/challenge-ai";

export const Route = createFileRoute("/challenge-ai")({
  head: () => ({ meta: [{ title: "Challenge the AI - BuildMyLogic" }] }),
  component: ChallengeAI,
});

type Evidence = ReturnType<typeof reviewTest>;
function ChallengeAI() {
  const [round, setRound] = useState(0);
  const [raw, setRaw] = useState("");
  const [prediction, setPrediction] = useState("");
  const [result, setResult] = useState<Evidence | null>(null);
  const [error, setError] = useState("");
  const [hint, setHint] = useState(false);
  const [reason, setReason] = useState<number | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [wins, setWins] = useState<string[]>([]);
  const challenge = REVIEW_CHALLENGES[round]!;
  const verified = Boolean(result?.breaks && result.predictedCorrectly);
  const explained = verified && reviewed && reason === challenge.correctReason;
  function choose(next: number) {
    setRound(next);
    setRaw("");
    setPrediction("");
    setResult(null);
    setError("");
    setHint(false);
    setReason(null);
    setReviewed(false);
  }
  function run() {
    setError("");
    setResult(null);
    setReason(null);
    setReviewed(false);
    try {
      setResult(reviewTest(challenge, raw, prediction));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check your input.");
    }
  }
  return (
    <div className="min-h-screen bg-background pb-12 text-foreground">
      <header className="border-b border-border bg-card px-5 py-4 sm:px-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <a
            className="display text-xl font-black tracking-tight"
            href="/learn"
          >
            BuildMyLogic<span className="text-primary">.</span>
          </a>
          <a
            href="/learn"
            className="flex items-center gap-2 text-sm font-semibold text-muted-foreground"
          >
            <ArrowLeft size={15} /> Back to learning
          </a>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 pt-7 sm:px-10 sm:pt-10">
        <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">
          <FlaskConical size={16} /> AI code-review lab
        </p>
        <h1 className="display text-4xl font-black tracking-[-0.05em] sm:text-5xl">
          Challenge the AI.
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
          The code looks right. The example passes. Can you write the test that
          proves it wrong?
        </p>
        <div
          role="note"
          className="mt-5 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-xs leading-5 text-violet-950"
        >
          Curated, deliberately flawed JavaScript examples, not live AI output.
          Fixed functions run locally in your browser. No AI calls or
          learner-progress changes. This page does not check whether you used
          outside help.
        </div>
        <nav
          aria-label="Challenge rounds"
          className="my-6 flex flex-wrap gap-2"
        >
          {REVIEW_CHALLENGES.map((item, i) => (
            <button
              type="button"
              key={item.id}
              onClick={() => choose(i)}
              aria-current={round === i ? "step" : undefined}
              className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold ${round === i ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}
            >
              {wins.includes(item.id) ? (
                <Check size={15} />
              ) : (
                <span>{i + 1}.</span>
              )}
              {item.concept}
            </button>
          ))}
        </nav>
        <div className="grid items-start gap-5 lg:grid-cols-2">
          <section className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="p-5 sm:p-6">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                01 / Review the claim
              </p>
              <h2 className="mt-2 text-2xl font-extrabold tracking-tight">
                {challenge.title}
              </h2>
              <p className="mt-3 text-sm leading-6">{challenge.brief}</p>
              <div className="mt-4 rounded-xl bg-muted px-4 py-3 text-sm">
                <span className="font-bold">Confident claim: </span>
                {challenge.claim}
              </div>
            </div>
            <pre
              className="overflow-x-auto bg-[#17142b] p-5 text-[13px] leading-7 text-violet-100 sm:p-6"
              aria-label="Code under review"
            >
              <code>{challenge.code}</code>
            </pre>
            <div className="p-5 text-xs leading-5 text-muted-foreground">
              Example input:{" "}
              <code className="font-bold">{challenge.example}</code> returns{" "}
              <strong>
                {challenge.candidate(challenge.parse(challenge.example))}
              </strong>
              , matching the specification. One passing example is not proof.
            </div>
          </section>
          <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              02 / Design a counterexample
            </p>
            <h2 className="mt-2 text-xl font-extrabold">
              Make your prediction first.
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Choose an input where the code violates the specification. Predict
              what a correct program should return.
            </p>
            <form
              className="mt-5 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                run();
              }}
            >
              <label className="block text-sm font-bold">
                {challenge.inputLabel}
                <input
                  value={raw}
                  onChange={(e) => {
                    setRaw(e.target.value);
                    setResult(null);
                  }}
                  placeholder={challenge.placeholder}
                  maxLength={100}
                  autoComplete="off"
                  spellCheck={false}
                  className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 font-mono text-sm"
                />
              </label>
              <label className="block text-sm font-bold">
                Correct output you predict
                <input
                  value={prediction}
                  onChange={(e) => {
                    setPrediction(e.target.value);
                    setResult(null);
                  }}
                  placeholder="One whole number"
                  maxLength={5}
                  inputMode="numeric"
                  autoComplete="off"
                  className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 font-mono text-sm"
                />
              </label>
              <button
                type="submit"
                className="btn-base btn-primary-solid w-full py-3 text-sm"
              >
                Run my counterexample <ArrowRight size={16} />
              </button>
            </form>
            <button
              type="button"
              onClick={() => setHint(true)}
              className="mt-4 flex items-center gap-2 text-xs font-bold text-muted-foreground"
            >
              <Lightbulb size={14} /> Give me a thinking hint
            </button>
            {hint && (
              <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm leading-6 text-amber-950">
                {challenge.hint}
              </p>
            )}
            {error && (
              <p
                role="alert"
                className="mt-4 text-sm font-semibold text-red-700"
              >
                {error}
              </p>
            )}
            {result && (
              <div
                role="status"
                className={`mt-5 rounded-xl border p-4 ${verified ? "border-emerald-300 bg-emerald-50 text-emerald-950" : "border-amber-300 bg-amber-50 text-amber-950"}`}
              >
                <p className="font-extrabold">
                  {verified
                    ? "Counterexample verified."
                    : !result.predictedCorrectly
                      ? "Check your prediction."
                      : "That input does not break the code."}
                </p>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <dt>Your prediction</dt>
                    <dd className="mt-1 font-mono text-xl font-black">
                      {result.predicted}
                    </dd>
                  </div>
                  <div>
                    <dt>Code returned</dt>
                    <dd className="mt-1 font-mono text-xl font-black">
                      {result.actual}
                    </dd>
                  </div>
                  <div>
                    <dt>Spec requires</dt>
                    <dd className="mt-1 font-mono text-xl font-black">
                      {result.expected}
                    </dd>
                  </div>
                </dl>
                <p className="mt-3 text-xs leading-5">
                  {verified
                    ? "Your predicted output matches the reference rule, and the candidate returns something different."
                    : "Try another input and state the output required by the specification. A failed prediction is not evidence of a verified counterexample."}
                </p>
              </div>
            )}
          </section>
        </div>
        {verified && (
          <section className="mt-5 rounded-2xl border border-border bg-card p-5 sm:p-6">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              03 / Defend your test
            </p>
            <h2 className="mt-2 text-xl font-extrabold">
              What assumption did your test expose?
            </h2>
            <fieldset className="mt-4 space-y-2">
              <legend className="sr-only">
                Choose the reason the code fails
              </legend>
              {challenge.reasons.map((text, i) => (
                <label
                  key={text}
                  className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 text-sm"
                >
                  <input
                    type="radio"
                    name="reason"
                    checked={reason === i}
                    onChange={() => {
                      setReason(i);
                      setReviewed(false);
                    }}
                    className="mt-1"
                  />
                  {text}
                </label>
              ))}
            </fieldset>
            <button
              type="button"
              disabled={reason === null}
              onClick={() => {
                setReviewed(true);
                if (reason === challenge.correctReason)
                  setWins((old) =>
                    old.includes(challenge.id) ? old : [...old, challenge.id],
                  );
              }}
              className="btn-base btn-outline mt-4 text-sm"
            >
              Check my reasoning
            </button>
            {reviewed && (
              <p
                role="status"
                className={`mt-4 rounded-xl p-4 text-sm leading-6 ${explained ? "bg-emerald-50 text-emerald-950" : "bg-amber-50 text-amber-950"}`}
              >
                {explained
                  ? challenge.explanation
                  : "Your test exposed a real mismatch, but this explanation does not match the failure. Read the specification and compare the outputs again."}
              </p>
            )}
            {explained && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
                <p className="flex items-center gap-2 text-sm font-bold text-emerald-700">
                  <ShieldCheck size={18} /> Test + prediction + reason checked
                </p>
                <button
                  type="button"
                  className="btn-base btn-primary-solid text-sm"
                  onClick={() => choose((round + 1) % REVIEW_CHALLENGES.length)}
                >
                  Try {round === 2 ? "another round" : "the next round"}{" "}
                  <ArrowRight size={16} />
                </button>
              </div>
            )}
          </section>
        )}
        <p className="mt-6 text-xs leading-6 text-muted-foreground">
          {wins.length}/3 rounds completed in this page session. Results reset
          on reload. These finite, practice-only checks are not proof of unaided
          work, long-term learning, or job readiness. No score is added to
          Struggle DNA.
        </p>
      </main>
    </div>
  );
}
