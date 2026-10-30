/**
 * Targeted practice (kernel step 6, Learning Agent): when the evidence shows
 * a misconception, the Learning Agent explains the underlying concept at the
 * student's level and generates a fresh exercise - hints before answers.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, CheckCircle2, Lightbulb, Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { GoogleSignIn } from "@/components/GoogleSignIn";
import { useLoop } from "@/lib/loop-store";
import { emptyAf05, SKILL_LABELS } from "@/lib/af05/types";
import {
  recordEvidence,
  recordMisconception,
  addHistory,
} from "@/lib/af05/engine";
import { updateAf05 } from "@/lib/af05/store";
import {
  af05LearningAgent,
  type LearningAgentResult,
} from "@/lib/af05/assessment.functions";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/practice")({
  head: () => ({ meta: [{ title: "Targeted practice - BuildMyLogic" }] }),
  component: PracticePage,
});

function PracticePage() {
  useLoop();
  const auth = useAuth();
  const af05 = useLoop().af05 ?? emptyAf05;
  const active = Object.values(af05.misconceptions)
    .filter((m) => m.status === "active")
    .sort((a, b) => b.count - a.count || b.lastSeenAt - a.lastSeenAt);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [material, setMaterial] = useState<LearningAgentResult | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [answered, setAnswered] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hintVisible, setHintVisible] = useState(false);

  const misconception = active.find((m) => m.id === selectedId) ?? active[0];

  const generate = async () => {
    if (!misconception) return;
    setBusy(true);
    setError(null);
    setMaterial(null);
    setChosen(null);
    setAnswered(null);
    setHintVisible(false);
    try {
      const result = await af05LearningAgent({
        data: {
          skill: misconception.skill,
          concept: misconception.id,
          misconception: misconception.label,
          level: af05.competencies[misconception.skill]?.state ?? "beginner",
          recentError: `Seen ${misconception.count} times`,
        },
      });
      setMaterial(result);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "The Learning Agent could not respond. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  const answer = () => {
    if (!material || !chosen || !misconception) return;
    const option = material.exercise.options.find((o) => o.id === chosen);
    const correct = option?.correct === true;
    setAnswered(correct);
    updateAf05((s) => {
      recordEvidence(s, misconception.skill, {
        at: Date.now(),
        kind: "diagnostic",
        summary: `Targeted practice on "${misconception.label}": ${correct ? "correct" : "still missed"}`,
        weight: correct ? 2 : 0,
        source: "deterministic",
      });
      if (!correct) {
        recordMisconception(s, misconception.skill, {
          id: misconception.id,
          label: misconception.label,
        });
      }
      addHistory(s, {
        at: Date.now(),
        kind: "diagnostic",
        skill: misconception.skill,
        result: correct ? "pass" : "fail",
        detail: `Targeted practice (${misconception.label}): ${correct ? "correct" : "incorrect"}.`,
      });
    });
  };

  if (!auth) {
    return (
      <AppShell
        crumb="Targeted practice"
        title="Sign in for targeted practice."
        subtitle="The Learning Agent writes explanations and fresh exercises for your exact misconception - that needs your signed-in session."
      >
        <div className="card-surface p-8">
          <GoogleSignIn />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      crumb="Targeted practice"
      title="Fix the exact gap."
      subtitle="No generic lessons. The Learning Agent explains the concept behind your specific mistake, then checks you with a fresh exercise."
    >
      {active.length === 0 ? (
        <section className="card-surface p-10 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-success" />
          <h2 className="display mt-3 text-xl font-bold">
            No active misconceptions.
          </h2>
          <p className="mx-auto mt-2 max-w-md text-[14px] text-muted-foreground">
            When assessments or project tasks reveal a repeated mistake,
            targeted practice for it appears here.
          </p>
          <Link
            to="/projects"
            className="btn-base btn-primary-solid mt-5 inline-flex items-center gap-2"
          >
            Build a project <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <aside className="space-y-2.5">
            {active.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setSelectedId(m.id);
                  setMaterial(null);
                  setAnswered(null);
                }}
                className={`w-full rounded-xl border p-4 text-left transition-colors ${
                  misconception?.id === m.id
                    ? "border-primary bg-primary-soft/60"
                    : "border-border bg-card hover:bg-muted"
                }`}
              >
                <p className="text-[13px] font-semibold">{m.label}</p>
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  {SKILL_LABELS[m.skill]} - seen {m.count}x
                </p>
              </button>
            ))}
          </aside>

          <section className="card-surface p-6">
            {!material && (
              <div className="text-center">
                <p className="text-[14px] text-muted-foreground">
                  {misconception
                    ? `Ready to work on "${misconception.label}".`
                    : "Pick a misconception to start."}
                </p>
                <button
                  type="button"
                  disabled={busy || !misconception}
                  onClick={() => void generate()}
                  className="btn-base btn-primary-solid mt-4 inline-flex items-center gap-2 disabled:opacity-50"
                >
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  {busy ? "Preparing..." : "Generate my practice"}
                </button>
                {error && (
                  <p className="mt-3 text-[13px] text-destructive">{error}</p>
                )}
              </div>
            )}

            {material && (
              <div>
                <p className="eyebrow mb-2">Learning Agent</p>
                <p className="text-[14px] leading-7">{material.explanation}</p>

                <div className="mt-5 rounded-xl border border-border p-4">
                  <p className="text-[14px] font-semibold leading-6">
                    {material.exercise.prompt}
                  </p>
                  <div className="mt-3 space-y-2">
                    {material.exercise.options.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        disabled={answered !== null}
                        onClick={() => setChosen(option.id)}
                        className={`w-full rounded-xl border px-4 py-2.5 text-left text-[13px] leading-6 transition-colors ${
                          chosen === option.id
                            ? "border-primary bg-primary-soft font-medium"
                            : "border-border bg-card hover:bg-muted"
                        }`}
                      >
                        {option.text}
                      </button>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center gap-4">
                    <button
                      type="button"
                      disabled={!chosen || answered !== null}
                      onClick={answer}
                      className="btn-base btn-primary-solid inline-flex items-center gap-2 disabled:opacity-50"
                    >
                      Check my answer
                    </button>
                    <button
                      type="button"
                      onClick={() => setHintVisible(true)}
                      className="inline-flex items-center gap-1.5 text-[13px] font-medium text-accent-foreground"
                    >
                      <Lightbulb className="h-4 w-4" /> Hint
                    </button>
                  </div>
                  {hintVisible && (
                    <p className="mt-3 rounded-lg bg-primary-soft px-3 py-2 text-[13px] text-accent-foreground">
                      {material.hint}
                    </p>
                  )}
                  {answered !== null && (
                    <p
                      className={`mt-3 rounded-lg px-3 py-2 text-[13px] font-medium ${answered ? "bg-success/10 text-success" : "bg-amber-50 text-amber-800"}`}
                    >
                      {answered
                        ? "Correct. That is the concept that was tripping you up - the spaced revision will check it again later."
                        : "Not yet. Re-read the explanation above and try the next exercise."}
                    </p>
                  )}
                  {answered !== null && (
                    <button
                      type="button"
                      onClick={() => void generate()}
                      className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-accent-foreground"
                    >
                      Another exercise <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </AppShell>
  );
}
