import test from "node:test";
import assert from "node:assert/strict";
import {
  diagnosticQuestions,
  answerDiagnostic,
  diagnosticCount,
} from "./initial-diagnostic.ts";
import {
  estimatedCodingStart,
  nextInitialCodingTask,
  scaffoldInitialCoding,
  codingSupportSummary,
} from "./initial-coding-diagnostic.ts";
import { competencyView, competencyContext } from "./competency.ts";
import { priorityLearningTopics } from "./adaptive-learning.ts";
const bank = Array.from({ length: 2 }, (_, i) => ({
  id: String(i),
  skill: "Conditions",
  kind: i ? "reasoning" : "concept",
  difficulty: 2,
  prompt: "Short resume check " + i,
  options: ["a", "b", "c", "d"],
  answer: 0,
  explanation: "Provisional key.",
}));
test("new short bank requires exactly two structurally valid questions, legacy coverage guards retained", () => {
  assert.equal(diagnosticQuestions({ questions: bank }, "short-v2").length, 2);
  for (const questions of [
    [],
    bank.slice(0, 1),
    [...bank, bank[0]],
    bank.map((q) => ({ ...q, answer: 4 })),
    bank.map((q) => ({ ...q, options: ["a", "a", "b", "c"] })),
  ])
    assert.throws(() => diagnosticQuestions({ questions }, "short-v2"));
  assert.throws(() => diagnosticQuestions({ questions: bank }));
  let d = {
    mode: "short-v2",
    version: 1,
    status: "in_progress",
    questions: bank,
    answers: [],
  };
  assert.equal(diagnosticCount(d), 2);
  d = answerDiagnostic(d, 0, 1);
  assert.equal(d.status, "in_progress");
  d = answerDiagnostic(d, 0, 2);
  assert.equal(d.status, "completed");
  assert.equal(d.answers.length, 2);
  assert.equal(answerDiagnostic(d, 0, 3), d);
  assert.equal(
    estimatedCodingStart({ initialDiagnostic: d, technologies: [] }),
    "transfer",
  );
  assert.equal(
    estimatedCodingStart({
      initialDiagnostic: {
        ...d,
        answers: d.answers.map((a) => ({ ...a, correct: false })),
      },
      technologies: [],
    }),
    "basic",
  );
});
test("strictly above authored benchmark offers same-concept basic task without grading or destroying draft/history", () => {
  const d = {
    version: 1,
    language: "python",
    topicId: "conditions",
    startingLevel: "transfer",
    submissions: [],
  };
  const task = nextInitialCodingTask(d);
  assert.equal(task.level, "transfer");
  for (const ms of [NaN, -1, 0, 480000])
    assert.equal(scaffoldInitialCoding(d, task.id, "draft", false, ms, 100), d);
  const next = scaffoldInitialCoding(
    d,
    task.id,
    "n = int(input())",
    true,
    480001,
    100,
  );
  assert.equal(next.submissions.length, 0);
  assert.equal(next.scaffolds.length, 1);
  assert.equal(next.scaffolds[0].draft.code, "n = int(input())");
  assert.equal(next.scaffolds[0].draft.hintUsed, true);
  assert.equal(nextInitialCodingTask(next).id, "coding-v1:conditions:basic");
  assert.equal(
    scaffoldInitialCoding(next, task.id, "x", false, 500000, 101),
    next,
  );
  assert.match(codingSupportSummary(next), /not a failed test or weakness/);
  const state = {
    profile: { initialCodingDiagnostic: next },
    plan: { skills: [{ name: "Conditions", level: 88 }] },
    struggle: { attempts: [] },
    assessmentEvidence: [],
  };
  assert.equal(competencyView(state)[0].estimate, null);
  assert.equal(competencyView(state)[0].observations, 0);
  assert.match(competencyContext(state), /Simpler conditions task/);
  assert.match(
    priorityLearningTopics(state).get("conditions"),
    /not a proven weakness/,
  );
  assert.deepEqual(d.submissions, []);
  assert.equal(d.scaffolds, undefined);
});

test("excluded contradictory item cannot promote initial practical difficulty", () => {
  const invalid = {
    ...bank[0],
    prompt:
      "This always prints too expensive.\nprice = input('Price: ')\nif price > 100:\n print('too expensive')",
    explanation: "The comparison raises TypeError.",
  };
  const p = {
    technologies: [],
    initialDiagnostic: {
      mode: "short-v2",
      answers: [
        { question: bank[0], correct: true },
        { question: invalid, correct: true },
      ],
    },
  };
  assert.equal(estimatedCodingStart(p), "basic");
});
