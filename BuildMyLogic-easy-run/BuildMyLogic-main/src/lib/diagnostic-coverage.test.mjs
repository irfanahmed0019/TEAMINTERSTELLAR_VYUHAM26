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
