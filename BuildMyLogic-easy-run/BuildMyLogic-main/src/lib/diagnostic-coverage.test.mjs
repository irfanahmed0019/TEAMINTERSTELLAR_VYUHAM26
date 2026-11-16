import test from "node:test";
import assert from "node:assert/strict";
import {
  diagnosticQuestions,
  nextDiagnostic,
  answerDiagnostic,
} from "./initial-diagnostic.ts";
const kinds = ["concept", "prediction", "debugging", "reasoning"];
const bank = Array.from({ length: 12 }, (_, i) => ({
  skill: "Loops",
  kind: kinds[i % 4],
  difficulty: Math.floor(i / 4) + 1,
  prompt: "Check " + i,
  options: ["A", "B", "C", "D"],
  answer: 0,
  explanation: "Reviewed explanation",
}));
test("new banks require all requested formats and medium opportunity, distinct options", () => {
  assert.equal(diagnosticQuestions({ questions: bank }).length, 12);
  assert.throws(
    () =>
      diagnosticQuestions({
        questions: bank.map((q) => ({ ...q, kind: "prediction" })),
      }),
    /missing/,
  );
  assert.throws(
    () =>
      diagnosticQuestions({
        questions: bank.map((q) => ({ ...q, difficulty: 1 })),
      }),
    /missing/,
  );
  assert.throws(() =>
    diagnosticQuestions({
      questions: bank.map((q) => ({ ...q, options: ["a", " A ", "b", "c"] })),
    }),
  );
});
test("six-answer diagnostic actually covers conceptual prediction debug reasoning while adapting", () => {
  let d = {
    version: 1,
    source: "ai",
    status: "in_progress",
    questions: diagnosticQuestions({ questions: bank }),
    answers: [],
    evidence: "client_graded_prediction_not_code_execution",
  };
  assert.equal(nextDiagnostic(d).difficulty, 2);
  d = answerDiagnostic(d, 0, 1);
  assert.equal(nextDiagnostic(d).difficulty, 3);
  for (let i = 1; i < 6; i++) d = answerDiagnostic(d, i % 2, 100 + i);
  assert.equal(d.status, "completed");
  assert.equal(new Set(d.answers.map((a) => a.question.kind)).size, 4);
  assert.equal(d.answers.length, 6);
});
test("legacy single-format saved bank stays readable without invented formats or answers", () => {
  const legacy = {
    questions: bank.map((q, i) => ({
      ...q,
      id: String(i),
      kind: "prediction",
    })),
    answers: [],
  };
  assert.ok(nextDiagnostic(legacy));
  assert.equal(legacy.answers.length, 0);
});

test("known live Python stem contradiction is excluded without destroying raw saved history", async () => {
  const { diagnosticQuestionIssue } = await import("./initial-diagnostic.ts");
  const { competencyView, competencyContext } = await import("./competency.ts");
  const q = {
    ...bank[0],
    id: "live-q6",
    skill: "Debugging string vs number comparison",
    kind: "debugging",
    prompt:
      "This check always says 'too expensive' even for small amounts. Why?\n\nprice = input('Price: ')\nif price > 100:\n    print('too expensive')",
    explanation:
      "input returns a string; comparing it with 100 raises TypeError in Python 3.",
  };
  assert.match(diagnosticQuestionIssue(q), /raises TypeError/);
  const raw = { question: q, choice: 0, correct: true, at: 1 };
  const state = {
    profile: { initialDiagnostic: { answers: [raw] } },
    plan: { skills: [] },
    struggle: { attempts: [] },
  };
  assert.equal(competencyView(state).length, 0);
  assert.equal(state.profile.initialDiagnostic.answers[0], raw);
  const allowed = {
    ...q,
    id: "ok",
    prompt: q.prompt.replace(
      "This check always says 'too expensive' even for small amounts. Why?",
      "What happens when this runs?",
    ),
  };
  assert.equal(diagnosticQuestionIssue(allowed), null);
  assert.equal(
    diagnosticQuestionIssue({
      ...q,
      prompt:
        q.prompt +
        '\ntry:\n    pass\nexcept TypeError:\n    print("too expensive")',
    }),
    null,
  );
  assert.equal(
    diagnosticQuestionIssue({
      ...q,
      prompt: q.prompt.replace(
        "price = input('Price: ')",
        "price = int(input('Price: '))",
      ),
    }),
    null,
  );
  const parsed = diagnosticQuestions({ questions: [...bank, q] });
  assert.equal(parsed.length, 12);
  assert.equal(state.profile.initialDiagnostic.answers.length, 1);
  const ctx = competencyContext({
    ...state,
    profile: {
      initialDiagnostic: { answers: [{ ...raw, question: allowed }] },
    },
  });
  assert.match(ctx, /AI-keyed client diagnostic/);
  assert.match(ctx, /provisional multiple-choice/);
});
