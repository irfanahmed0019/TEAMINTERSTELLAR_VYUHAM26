/**
 * Delayed reassessment (kernel step 9): due revisions are re-tested with
 * different-but-equivalent exercises. Passing advances the spaced schedule
 * (24h -> 3d -> 7d); failing restarts it and re-opens the misconception.
 * This is where retention is actually measured - separate from same-day scores.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useLoop } from "@/lib/loop-store";
import { emptyAf05, SKILL_LABELS, type Revision } from "@/lib/af05/types";
import {
  addHistory,
  completeRevision,
  dueRevisions,
  gradeObjectiveAnswer,
  recordEvidence,
  recordMisconception,
} from "@/lib/af05/engine";
import {
  originalsForSkill,
  variantsForSkill,
  type DiagnosticItem,
} from "@/lib/af05/diagnostic";
import { getAf05, updateAf05 } from "@/lib/af05/store";
import {
  af05LearningAgent,
  type LearningAgentResult,
} from "@/lib/af05/assessment.functions";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/reassess")({
  head: () => ({ meta: [{ title: "Reassessment - BuildMyLogic" }] }),
  component: ReassessPage,
});

type Exercise =
  | { kind: "bank"; item: DiagnosticItem; equivalent: boolean }
  | { kind: "agent"; exercise: LearningAgentResult["exercise"] };

function ReassessPage() {
  useLoop();
  const auth = useAuth();
  const af05 = getAf05();
  const due = dueRevisions(af05);
  const [current, setCurrent] = useState<Revision | null>(null);
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<{
    passed: boolean;
    message: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const begin = async (revision: Revision) => {
    setBusy(true);
    setError(null);
    setOutcome(null);
    setSelected(null);
    setCurrent(revision);

    // 1) A banked equivalent variant is the strongest option.
    const byConcept = variantsForSkill(revision.skill, revision.concept);
    const bySkill = variantsForSkill(revision.skill);
    const variant = byConcept[0] ?? bySkill[0];
    if (variant) {
      setExercise({ kind: "bank", item: variant, equivalent: true });
      setBusy(false);
      return;
    }

    // 2) The Learning Agent writes a fresh equivalent exercise.
    if (auth) {
      try {
        const misconception = revision.misconceptionId
          ? af05.misconceptions[revision.misconceptionId]?.label
          : revision.concept.replaceAll("_", " ");
        const result = await af05LearningAgent({
          data: {
            skill: revision.skill,
            concept: revision.concept,
            misconception: misconception ?? revision.concept,
            level: af05.competencies[revision.skill]?.state ?? "beginner",
          },
        });
        setExercise({
          kind: "agent",
          exercise: result.exercise,
        });
        setBusy(false);
        return;
      } catch {
        // fall through to the original item
      }
    }

    // 3) Honest fallback: the original exercise, clearly labelled as such.
    const original =
      originalsForSkill(revision.skill, revision.concept)[0] ??
      originalsForSkill(revision.skill)[0];
    if (original) {
      setExercise({ kind: "bank", item: original, equivalent: false });
    } else {
      setError(
        "No reassessment exercise exists for this topic yet. Finishing the related project task will count instead.",
      );
    }
    setBusy(false);
  };

  const submit = () => {
    if (!current || !exercise || !selected) return;
    let correct = false;
    let misconception: { id: string; label: string } | undefined;

    if (exercise.kind === "bank") {
      const graded = gradeObjectiveAnswer(exercise.item.id, selected);
      correct = Boolean(graded.correct);
      misconception = graded.misconceptionId
        ? {
            id: graded.misconceptionId,
            label: graded.misconceptionLabel ?? "Recurring misconception",
          }
        : undefined;
    } else {
      const option = exercise.exercise.options.find((o) => o.id === selected);
      correct = option?.correct === true;
    }

    updateAf05((s) => {
      recordEvidence(s, current.skill, {
        at: Date.now(),
        kind: "reassessment",
        summary: `Delayed reassessment on ${current.concept.replaceAll("_", " ")}: ${correct ? "retained" : "not retained"}`,
        weight: correct ? 2 : 0,
        source: "deterministic",
      });
      if (!correct) {
        recordMisconception(
          s,
          current.skill,
          misconception ?? {
            id: `${current.concept}_retention`,
            label: `Has not retained ${current.concept.replaceAll("_", " ")}`,
          },
        );
      }
      completeRevision(s, current.id, correct);
      addHistory(s, {
        at: Date.now(),
        kind: "reassessment",
        skill: current.skill,
        result: correct ? "pass" : "fail",
        detail: `Reassessment (${current.concept.replaceAll("_", " ")}) ${correct ? "passed - retention confirmed" : "failed - schedule restarted"}.`,
      });
    });

    setOutcome({
      passed: correct,
      message: correct
        ? "Retained. The next check is scheduled further out - this is how mastery is earned."
        : "Not retained yet. The concept is back in your revision schedule with a fresh interval.",
    });
    setExercise(null);
    setCurrent(null);
  };

  return (
    <AppShell
      crumb="Reassessment"
      title="Prove it stuck."
      subtitle="Delayed recall is the difference between recognising an answer and actually knowing it. These exercises are equivalent to the originals, not identical."
    >
      {outcome && (
        <div
          className={`mb-5 flex items-start gap-3 rounded-xl border px-4 py-3 ${outcome.passed ? "border-success/30 bg-success/10" : "border-amber-300 bg-amber-50"}`}
        >
          {outcome.passed ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-success" />
          ) : (
            <XCircle className="mt-0.5 h-5 w-5 text-amber-700" />
          )}
          <p className="text-[14px] leading-6">{outcome.message}</p>
        </div>
      )}
      {error && (
        <p className="mb-5 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-[13px] text-destructive">
          {error}
        </p>
      )}

      {!exercise && (
        <div className="space-y-3">
          {due.length === 0 && !outcome && (
            <section className="card-surface p-10 text-center">
              <RotateCcw className="mx-auto h-8 w-8 text-primary" />
              <h2 className="display mt-3 text-xl font-bold">Nothing due.</h2>
              <p className="mx-auto mt-2 max-w-md text-[14px] text-muted-foreground">
                Reassessments appear 24 hours, 3 days and 7 days after a weak
                spot is found. Check the Learning Path for what is coming.
              </p>
              <Link
                to="/learning-path"
                className="btn-base btn-primary-solid mt-5 inline-flex items-center gap-2"
              >
                View Learning Path <ArrowRight className="h-4 w-4" />
              </Link>
            </section>
          )}
          {due.map((revision) => (
            <div
              key={revision.id}
              className="card-surface flex items-center gap-4 p-5"
            >
              <RotateCcw className="h-5 w-5 shrink-0 text-amber-700" />
              <div className="flex-1">
                <p className="font-semibold">
                  {SKILL_LABELS[revision.skill]} -{" "}
                  {revision.concept.replaceAll("_", " ")}
                </p>
                <p className="text-[12px] text-muted-foreground">
                  Stage {revision.stage + 1} of 3 - scheduled{" "}
                  {new Date(revision.createdAt).toLocaleDateString()}
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void begin(revision)}
                className="btn-base btn-primary-solid inline-flex items-center gap-2 disabled:opacity-50"
              >
                {busy && current?.id === revision.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                Start
              </button>
            </div>
          ))}
        </div>
      )}

      {exercise && (
        <div className="card-surface p-6">
          {exercise.kind === "bank" ? (
            <>
              {!exercise.equivalent && (
                <p className="mb-3 rounded-lg bg-muted px-3 py-2 text-[12px] text-muted-foreground">
                  No equivalent variant exists for this topic yet, so this is
                  the same exercise as before. Signed-in students get fresh
                  AI-written variants.
                </p>
              )}
              <p className="text-[16px] font-semibold leading-7">
                {exercise.item.prompt}
              </p>
              {exercise.item.code && (
                <pre className="mt-4 overflow-x-auto rounded-xl bg-ink p-4 font-mono text-[13px] leading-6 text-ink-foreground">
                  {exercise.item.code}
                </pre>
              )}
              <div className="mt-5 space-y-2.5">
                {exercise.item.choices?.map((choice) => (
                  <button
                    key={choice.id}
                    type="button"
                    onClick={() => setSelected(choice.id)}
                    className={`w-full rounded-xl border px-4 py-3 text-left text-[14px] leading-6 transition-colors ${
                      selected === choice.id
                        ? "border-primary bg-primary-soft font-medium"
                        : "border-border bg-card hover:bg-muted"
                    }`}
                  >
                    {choice.text}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <p className="text-[16px] font-semibold leading-7">
                {exercise.exercise.prompt}
              </p>
              <div className="mt-5 space-y-2.5">
                {exercise.exercise.options.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setSelected(option.id)}
                    className={`w-full rounded-xl border px-4 py-3 text-left text-[14px] leading-6 transition-colors ${
                      selected === option.id
                        ? "border-primary bg-primary-soft font-medium"
                        : "border-border bg-card hover:bg-muted"
                    }`}
                  >
                    {option.text}
                  </button>
                ))}
              </div>
            </>
          )}
          <button
            type="button"
            disabled={!selected}
            onClick={submit}
            className="btn-base btn-primary-solid mt-5 inline-flex items-center gap-2 disabled:opacity-50"
          >
            Submit reassessment
          </button>
        </div>
      )}
    </AppShell>
  );
}
