export type DiagnosticQuestion = {
  id: string;
  skill: string;
  kind: "concept" | "prediction" | "debugging" | "reasoning";
  difficulty: 1 | 2 | 3;
  prompt: string;
  options: string[];
  answer: number;
  explanation: string;
};
export type DiagnosticAnswer = {
  question: DiagnosticQuestion;
  choice: number;
  correct: boolean;
  at: number;
};
export type InitialDiagnostic = {
  version: 1;
  source: "ai";
  status: "in_progress" | "completed";
  questions: DiagnosticQuestion[];
  answers: DiagnosticAnswer[];
  completedAt?: number;
  evidence: "client_graded_prediction_not_code_execution";
};
/** Narrow contradiction check, not a semantic or execution verifier.
 * Preserve old raw questions, but do not count a known impossible-output stem. */
export function diagnosticQuestionIssue(
  q: Pick<DiagnosticQuestion, "prompt" | "explanation">,
): string | null {
  const assigned = q.prompt.match(
    /(?:^|\n)\s*([a-zA-Z_]\w*)\s*=\s*input\([^\n]*\)/,
  );
  if (!assigned || /\b(?:try|except)\b/.test(q.prompt)) return null;
  const numericComparison = new RegExp(
    `^\\s*if\\s+${assigned[1]}\\s*(?:>|<|>=|<=)\\s*-?\\d+(?:\\.\\d+)?\\s*:`,
  );
  return /\balways\s+(?:says|prints|outputs)\b/i.test(q.prompt) &&
    /\bTypeError\b/i.test(q.explanation) &&
    numericComparison.test(
      q.prompt.slice((assigned.index ?? 0) + assigned[0].length),
    )
    ? "The stem claims printed output, but its direct string-input/numeric comparison raises TypeError before that output. This item is excluded from evidence."
    : null;
}
export function diagnosticQuestions(raw: unknown): DiagnosticQuestion[] {
  const list =
    raw && typeof raw === "object"
      ? (raw as { questions?: unknown }).questions
      : null;
  if (!Array.isArray(list))
    throw new Error(
      "No diagnostic questions returned. Retry or continue with an unassessed profile.",
    );
  const kinds = ["concept", "prediction", "debugging", "reasoning"];
  const questions = list
    .slice(0, 18)
    .flatMap((q, index): DiagnosticQuestion[] => {
      if (
        !q ||
        typeof q !== "object" ||
        typeof q.prompt !== "string" ||
        !q.prompt.trim() ||
        typeof q.skill !== "string" ||
        !q.skill.trim() ||
        !Array.isArray(q.options) ||
        q.options.length !== 4 ||
        q.options.some((o: unknown) => typeof o !== "string" || !o.trim()) ||
        new Set(q.options.map((o: string) => o.trim().toLowerCase())).size !==
          4 ||
        !Number.isInteger(q.answer) ||
        q.answer < 0 ||
        q.answer > 3 ||
        ![1, 2, 3].includes(q.difficulty) ||
        !kinds.includes(q.kind) ||
        typeof q.explanation !== "string" ||
        !q.explanation.trim() ||
        diagnosticQuestionIssue(q)
      )
        return [];
      return [
        {
          id: `diagnostic-${index}`,
          skill: q.skill.slice(0, 100),
          kind: q.kind,
          difficulty: q.difficulty,
          prompt: q.prompt.slice(0, 2000),
          options: q.options.map((o: string) => o.slice(0, 500)),
          answer: q.answer,
          explanation: q.explanation.slice(0, 1000),
        },
      ];
    });
  if (questions.length < 6)
    throw new Error(
      "The diagnostic returned too few valid questions. Retry; no assessment result was saved.",
    );
  if (
    kinds.some((kind) => !questions.some((q) => q.kind === kind)) ||
    !questions.some((q) => q.difficulty === 2)
  )
    throw new Error(
      "The diagnostic bank is missing required concept, prediction, debugging, reasoning or medium checks. Retry or continue unassessed; no answers were invented.",
    );
  return questions;
}
export function nextDiagnostic(
  d: InitialDiagnostic,
): DiagnosticQuestion | undefined {
  const last = d.answers.at(-1);
  const target = last
    ? Math.max(
        1,
        Math.min(3, last.question.difficulty + (last.correct ? 1 : -1)),
      )
    : 2;
  const remaining = d.questions.filter(
    (q) => !d.answers.some((a) => a.question.id === q.id),
  );
  const missingKinds = new Set(
    ["concept", "prediction", "debugging", "reasoning"].filter(
      (kind) => !d.answers.some((a) => a.question.kind === kind),
    ),
  );
  const freshKind = remaining.filter((q) => missingKinds.has(q.kind));
  // Existing incomplete banks remain usable. Never synthesize missing questions.
  return (
    d.answers.length > 0 && freshKind.length ? freshKind : remaining
  ).sort(
    (a, b) => Math.abs(a.difficulty - target) - Math.abs(b.difficulty - target),
  )[0];
}
export function answerDiagnostic(
  d: InitialDiagnostic,
  choice: number,
  at: number,
): InitialDiagnostic {
  const question = nextDiagnostic(d);
  if (
    !question ||
    d.status === "completed" ||
    !Number.isInteger(choice) ||
    choice < 0 ||
    choice > 3
  )
    return d;
  const answers = [
    ...d.answers,
    { question, choice, correct: choice === question.answer, at },
  ];
  const completed = answers.length >= Math.min(6, d.questions.length);
  return {
    ...d,
    answers,
    status: completed ? "completed" : "in_progress",
    ...(completed ? { completedAt: at } : {}),
  };
}
export function diagnosticSummary(d?: InitialDiagnostic): string {
  if (!d)
    return "No diagnostic evidence. Resume and experience are unverified claims.";
  const eligible = d.answers.filter(
    (a) => !diagnosticQuestionIssue(a.question),
  );
  return `Initial diagnostic ${d.status}; ${eligible.length} eligible prediction/concept checks; ${d.answers.length - eligible.length} contradictory items excluded (raw history retained). AI-authored answer keys, client-graded; not code execution or independent-work proof. ${eligible.map((a) => `${a.question.skill}: ${a.correct ? "correct" : "incorrect"} ${a.question.kind} at difficulty ${a.question.difficulty}`).join("; ")}`;
}
