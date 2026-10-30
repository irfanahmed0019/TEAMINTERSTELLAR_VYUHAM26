/**
 * Diagnostic assessment (kernel steps 1-3): goal selection, then a mixed
 * diagnostic - conceptual, code interpretation, debugging, short explanation
 * and a real executed practical - producing an evidence-backed competency
 * profile and gap analysis.
 */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Code2,
  Lightbulb,
  Loader2,
  Play,
  Target,
  XCircle,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  GOAL_TRACKS,
  itemsForTrack,
  type DiagnosticItem,
} from "@/lib/af05/diagnostic";
import {
  gradeObjectiveAnswer,
  keywordScoreExplanation,
  recordEvidence,
  recordMisconception,
  scheduleRevision,
  addHistory,
} from "@/lib/af05/engine";
import { runPractical, practicalWeight } from "@/lib/af05/sandbox";
import { getAf05, updateAf05 } from "@/lib/af05/store";
import { af05AssessExplanation } from "@/lib/af05/assessment.functions";
import { useAuth } from "@/lib/auth";
import { useLoop } from "@/lib/loop-store";
import { SKILL_LABELS, COMPETENCY_LABELS } from "@/lib/af05/types";
import { recommendProjects } from "@/lib/af05/projects";

type AnswerPayload = {
  response: string;
  correct?: boolean | undefined;
  score?: number | undefined;
  scoreSource?: "execution" | "deterministic" | "ai_rubric" | undefined;
  testsPassed?: number | undefined;
  testsTotal?: number | undefined;
  misconceptionId?: string | undefined;
  misconceptionLabel?: string | undefined;
};

export const Route = createFileRoute("/assessment")({
  head: () => ({ meta: [{ title: "Skill assessment - BuildMyLogic" }] }),
  component: AssessmentPage,
});

type Phase = "goal" | "running" | "done";

function AssessmentPage() {
  const loop = useLoopKey();
  void loop;
  const af05 = getAf05();
  const initialPhase: Phase = !af05.goalTrack
    ? "goal"
    : af05.diagnostic.status === "completed"
      ? "done"
      : "running";
  return (
    <AssessmentInner
      key={af05.diagnostic.status + (af05.goalTrack ?? "")}
      initialPhase={initialPhase}
    />
  );
}

// Small hook: subscribe to loop state so answers re-render.
function useLoopKey() {
  return useLoop();
}

function AssessmentInner({ initialPhase }: { initialPhase: Phase }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>(initialPhase);
  const af05 = getAf05();
  const items = useMemo(
    () => itemsForTrack(af05.goalTrack ?? "fullstack"),
    [af05.goalTrack],
  );
  const [index, setIndex] = useState(() => {
    const firstUnanswered = items.findIndex(
      (i) => !af05.diagnostic.answers[i.id],
    );
    return firstUnanswered === -1 ? 0 : firstUnanswered;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chooseGoal = (trackId: string) => {
    updateAf05((s) => {
      s.goalTrack = trackId;
      s.diagnostic = {
        status: "in_progress",
        track: trackId,
        startedAt: Date.now(),
        answers: {},
      };
    });
    setIndex(0);
    setPhase("running");
  };

  const finishDiagnostic = () => {
    updateAf05((s) => {
      s.diagnostic.status = "completed";
      s.diagnostic.completedAt = Date.now();
      // Schedule a revision for every skill that came out weak.
      for (const item of items) {
        const answer = s.diagnostic.answers[item.id];
        const weak =
          answer &&
          (answer.correct === false ||
            (typeof answer.score === "number" && answer.score <= 1) ||
            (typeof answer.testsTotal === "number" &&
              (answer.testsPassed ?? 0) < answer.testsTotal));
        if (weak) {
          scheduleRevision(s, item.skill, item.concept, answer.misconceptionId);
        }
      }
      addHistory(s, {
        at: Date.now(),
        kind: "diagnostic",
        skill: items[0]?.skill ?? "javascript",
        result: "pass",
        detail: `Diagnostic completed for ${s.goalTrack}: ${Object.keys(s.diagnostic.answers).length} answers recorded.`,
      });
    });
    setPhase("done");
  };

  const recordAnswer = (item: DiagnosticItem, answer: AnswerPayload) => {
    updateAf05((s) => {
      s.diagnostic.answers[item.id] = {
        itemId: item.id,
        at: Date.now(),
        response: answer.response,
        correct: answer.correct,
        score: answer.score,
        scoreSource: answer.scoreSource,
        testsPassed: answer.testsPassed,
        testsTotal: answer.testsTotal,
        misconceptionId: answer.misconceptionId,
      };

      const weight =
        typeof answer.testsTotal === "number"
          ? practicalWeight(answer.testsPassed ?? 0, answer.testsTotal)
          : typeof answer.score === "number"
            ? answer.score
            : answer.correct
              ? 2
              : 0;

      recordEvidence(s, item.skill, {
        at: Date.now(),
        kind:
          item.type === "practical"
            ? "practical"
            : item.type === "explain"
              ? "explanation"
              : "diagnostic",
        summary:
          item.type === "practical"
            ? `Diagnostic practical "${item.concept.replaceAll("_", " ")}": ${answer.testsPassed}/${answer.testsTotal} tests passed`
            : item.type === "explain"
              ? `Explanation on ${item.concept.replaceAll("_", " ")} scored ${answer.score ?? 0}/3 (${answer.scoreSource === "ai_rubric" ? "AI rubric" : "keyword check"})`
              : `Diagnostic ${item.type.replace("_", " ")} "${item.concept.replaceAll("_", " ")}" ${answer.correct ? "correct" : "incorrect"}`,
        weight,
        source:
          answer.scoreSource ??
          (item.type === "practical" ? "execution" : "deterministic"),
      });

      if (answer.misconceptionId && answer.misconceptionLabel) {
        recordMisconception(s, item.skill, {
          id: answer.misconceptionId,
          label: answer.misconceptionLabel,
        });
      }
    });
  };

  const next = () => {
    if (index + 1 >= items.length) finishDiagnostic();
    else setIndex(index + 1);
  };

  if (phase === "goal") {
    return (
      <AppShell
        crumb="Assessment"
        title="Choose your learning goal."
        subtitle="The diagnostic measures what you can already do, so your path is built on evidence - not guesses. You can skip nothing important; it takes about 8 minutes."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {GOAL_TRACKS.map((track) => (
            <button
              key={track.id}
              type="button"
              onClick={() => chooseGoal(track.id)}
              className="card-surface card-hover p-6 text-left"
            >
              <Target className="h-6 w-6 text-primary" />
              <h3 className="display mt-3 text-xl font-bold">{track.label}</h3>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {track.description}
              </p>
              <p className="mt-3 text-[13px] font-medium text-accent-foreground">
                Assesses: {track.skills.map((s) => SKILL_LABELS[s]).join(", ")}
              </p>
            </button>
          ))}
        </div>
        {!auth && (
          <p className="mt-5 rounded-xl border border-border bg-card px-4 py-3 text-[13px] text-muted-foreground">
            Sign in with Google (top right) for AI-scored explanations. Without
            it, explanations use a simpler keyword check and still count.
          </p>
        )}
      </AppShell>
    );
  }

  if (phase === "done") {
    return (
      <GapReportView onContinue={() => void navigate({ to: "/projects" })} />
    );
  }

  const item = items[index];
  if (!item) return null;
  return (
    <AppShell
      crumb="Diagnostic assessment"
      title={`${SKILL_LABELS[item.skill]}.`}
      subtitle={`Question ${index + 1} of ${items.length} - ${item.type === "explain" ? "explain in your own words" : item.type === "practical" ? "write real code, run real tests" : item.type === "debug" ? "find the fix" : item.type === "code_read" ? "read the code" : "concept check"}`}
    >
      <div className="mb-5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${Math.round((index / items.length) * 100)}%` }}
        />
      </div>
      {error && (
        <p className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-[13px] text-destructive">
          {error}
        </p>
      )}
      <QuestionCard
        key={item.id}
        item={item}
        busy={busy}
        signedIn={Boolean(auth)}
        onSubmit={async (answer) => {
          setBusy(true);
          setError(null);
          try {
            await recordAnswer(item, answer);
            next();
          } catch (e) {
            setError(
              e instanceof Error
                ? e.message
                : "Could not score that answer. Please try again.",
            );
          } finally {
            setBusy(false);
          }
        }}
      />
    </AppShell>
  );
}

function QuestionCard({
  item,
  busy,
  signedIn,
  onSubmit,
}: {
  item: DiagnosticItem;
  busy: boolean;
  signedIn: boolean;
  onSubmit: (answer: AnswerPayload) => Promise<void>;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [code, setCode] = useState(item.practical?.starterCode ?? "");
  const [runResult, setRunResult] = useState<string | null>(null);
  const [hintsShown, setHintsShown] = useState(0);

  if (item.type === "explain") {
    return (
      <div className="card-surface p-6">
        <p className="text-[16px] font-semibold leading-7">{item.prompt}</p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          placeholder="Explain it like you would to a friend..."
          className="mt-4 w-full rounded-xl border border-border bg-background p-3.5 text-[14px] leading-6 outline-none focus:border-primary"
        />
        <button
          type="button"
          disabled={busy || text.trim().length < 10}
          onClick={async () => {
            if (signedIn) {
              try {
                const result = await af05AssessExplanation({
                  data: {
                    skill: item.skill,
                    concept: item.concept,
                    question: item.prompt,
                    answer: text,
                  },
                });
                await onSubmit({
                  response: text,
                  score: result.score,
                  scoreSource: "ai_rubric",
                  misconceptionId: result.misconception?.id,
                  misconceptionLabel: result.misconception?.label,
                });
                return;
              } catch {
                // Fall through to the deterministic keyword check.
              }
            }
            await onSubmit({
              response: text,
              score: keywordScoreExplanation(item.id, text),
              scoreSource: "deterministic",
            });
          }}
          className="btn-base btn-primary-solid mt-4 inline-flex items-center gap-2 disabled:opacity-50"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          <span>{busy ? "Scoring..." : "Submit explanation"}</span>
        </button>
        <p className="mt-3 text-[12px] text-muted-foreground">
          {signedIn
            ? "The Assessment Agent scores this against a rubric."
            : "Scored with a keyword check (sign in for AI rubric scoring)."}
        </p>
      </div>
    );
  }

  if (item.type === "practical" && item.practical) {
    return (
      <div className="card-surface p-6">
        <p className="text-[16px] font-semibold leading-7">{item.prompt}</p>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {item.practical.instructions}
        </p>
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          rows={8}
          spellCheck={false}
          className="mt-4 w-full rounded-xl border border-border bg-ink p-3.5 font-mono text-[13px] leading-6 text-ink-foreground outline-none focus:border-primary"
        />
        {item.practical.hints.length > 0 &&
          hintsShown < item.practical.hints.length && (
            <button
              type="button"
              onClick={() => setHintsShown(hintsShown + 1)}
              className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-accent-foreground"
            >
              <Lightbulb className="h-4 w-4" /> Show hint {hintsShown + 1}/
              {item.practical.hints.length}
            </button>
          )}
        {item.practical.hints.slice(0, hintsShown).map((hint, i) => (
          <p
            key={i}
            className="mt-2 rounded-lg bg-primary-soft px-3 py-2 text-[13px] text-accent-foreground"
          >
            {hint}
          </p>
        ))}
        {runResult && (
          <p className="mt-3 rounded-lg border border-border bg-muted px-3 py-2 font-mono text-[12px]">
            {runResult}
          </p>
        )}
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setRunResult(null);
              const result = await runPractical(code, item.practical!);
              if (result.error) {
                setRunResult(`Error: ${result.error}`);
                return;
              }
              setRunResult(
                `${result.passed}/${result.total} tests passed` +
                  (result.failures.length > 0
                    ? ` - e.g. expected ${JSON.stringify(result.failures[0]?.expected)}, got ${JSON.stringify(result.failures[0]?.received)}`
                    : " - all green"),
              );
              await onSubmit({
                response: code,
                testsPassed: result.passed,
                testsTotal: result.total,
                correct: result.passed === result.total,
                misconceptionId:
                  result.passed === result.total
                    ? undefined
                    : `${item.concept}_practical_gap`,
                misconceptionLabel:
                  result.passed === result.total
                    ? undefined
                    : `Struggles to implement ${item.concept.replaceAll("_", " ")} in code`,
              });
            }}
            className="btn-base btn-primary-solid inline-flex items-center gap-2 disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            <span>{busy ? "Running tests..." : "Run tests & submit"}</span>
          </button>
        </div>
        <p className="mt-3 text-[12px] text-muted-foreground">
          Your code runs in an isolated in-browser runner against real tests -
          the result is genuine execution evidence.
        </p>
      </div>
    );
  }

  return (
    <div className="card-surface p-6">
      <p className="text-[16px] font-semibold leading-7">{item.prompt}</p>
      {item.code && (
        <pre className="mt-4 overflow-x-auto rounded-xl bg-ink p-4 font-mono text-[13px] leading-6 text-ink-foreground">
          {item.code}
        </pre>
      )}
      <div className="mt-5 space-y-2.5">
        {item.choices?.map((choice) => (
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
      <button
        type="button"
        disabled={busy || !selected}
        onClick={async () => {
          const graded = gradeObjectiveAnswer(item.id, selected!);
          await onSubmit({ response: selected!, ...graded });
        }}
        className="btn-base btn-primary-solid mt-5 inline-flex items-center gap-2 disabled:opacity-50"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        <span>Submit answer</span>
      </button>
    </div>
  );
}

function GapReportView({ onContinue }: { onContinue: () => void }) {
  useLoopKey();
  const af05 = getAf05();
  const track = GOAL_TRACKS.find((t) => t.id === af05.goalTrack);
  const skills = track?.skills ?? [];
  const recommendations = recommendProjects(af05, 3);

  return (
    <AppShell
      crumb="Your competency profile"
      title="Here is what the evidence shows."
      subtitle="Every level below comes from your actual answers and executed code. Unassessed means we have no evidence yet - it is not a judgement."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {skills.map((skill) => {
          const comp = af05.competencies[skill];
          const state = comp?.state ?? "not_assessed";
          return (
            <div key={skill} className="card-surface p-5">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{SKILL_LABELS[skill]}</h3>
                {state === "proficient" || state === "mastered" ? (
                  <CheckCircle2 className="h-5 w-5 text-success" />
                ) : state === "not_assessed" ? (
                  <Code2 className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <XCircle className="h-5 w-5 text-amber-600" />
                )}
              </div>
              <p className="mt-2 text-2xl font-extrabold tracking-tight">
                {COMPETENCY_LABELS[state]}
              </p>
              <p className="mt-1 text-[12px] text-muted-foreground">
                {comp && comp.evidence.length > 0
                  ? `${comp.evidence.length} piece${comp.evidence.length > 1 ? "s" : ""} of evidence - latest: ${comp.evidence.at(-1)?.summary}`
                  : "No evidence recorded yet."}
              </p>
            </div>
          );
        })}
      </div>

      <div className="card-surface mt-6 p-6">
        <h3 className="display text-xl font-bold">
          Recommended first projects
        </h3>
        <div className="mt-4 space-y-3">
          {recommendations.map(({ project, reasons }) => (
            <div
              key={project.id}
              className="rounded-xl border border-border p-4"
            >
              <div className="flex items-center justify-between">
                <p className="font-semibold">{project.name}</p>
                <span className="rounded-full bg-primary-soft px-2.5 py-1 text-[12px] font-medium text-accent-foreground">
                  {project.difficulty}
                </span>
              </div>
              <p className="mt-1 text-[13px] text-muted-foreground">
                {reasons[0]}
              </p>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={onContinue}
          className="btn-base btn-primary-solid mt-5 inline-flex items-center gap-2"
        >
          <span>Browse projects</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </AppShell>
  );
}
