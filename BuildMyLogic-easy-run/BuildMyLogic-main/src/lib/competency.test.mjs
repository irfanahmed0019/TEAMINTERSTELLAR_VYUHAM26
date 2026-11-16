import test from "node:test";
import assert from "node:assert/strict";
import { competencyView, competencyPlan } from "./competency.ts";
import {
  answerDiagnostic,
  nextDiagnostic,
  diagnosticQuestions,
} from "./initial-diagnostic.ts";
const base = {
  plan: {
    skills: [
      { name: "Loops", level: 99, note: "claimed" },
      { name: "Strings", level: 90 },
    ],
  },
  profile: {},
  struggle: { attempts: [] },
};
const attempt = (n, passed) => ({
  id: String(n),
  at: n,
  topicTitle: "Loops",
  passed,
  total: 1,
  source: "practice",
});
test("claims, legacy levels and activity do not manufacture competency", () => {
  assert.equal(competencyView(base)[0].estimate, null);
  assert.equal(competencyPlan(base).skills[0].level, 0);
  assert.equal(base.plan.skills[0].level, 99);
});
test("smoothing prevents one failure destroying past evidence; unrelated skill untouched", () => {
  const history = Array.from({ length: 6 }, (_, i) => attempt(i, 1));
  const before = competencyView({
    ...base,
    struggle: { attempts: history },
  })[0];
  const after = competencyView({
    ...base,
    struggle: { attempts: [...history, attempt(8, 0)] },
  });
  assert.ok(before.estimate - after[0].estimate <= 20);
  assert.equal(after[1].estimate, null);
  assert.equal(after[0].observations, 7);
});
test("sample and repeated ids do not create genuine observations", () => {
  assert.equal(
    competencyView({
      ...base,
      sampleProvenance: { version: 1 },
      struggle: { attempts: [attempt(1, 1)] },
    })[0].observations,
    0,
  );
  assert.equal(
    competencyView({
      ...base,
      struggle: { attempts: [attempt(1, 1), attempt(1, 1)] },
    })[0].observations,
    1,
  );
});
test("repeated failures scaffold only that skill, repeated passes suggest harder not mastery", () => {
  const a = competencyView({
    ...base,
    struggle: { attempts: [attempt(1, 0), attempt(2, 0)] },
  })[0];
  assert.equal(a.recommendedDifficulty, "beginner");
  const b = competencyView({
    ...base,
    struggle: { attempts: [attempt(1, 1), attempt(2, 1), attempt(3, 1)] },
  })[0];
  assert.equal(b.recommendedDifficulty, "advanced");
  assert.match(b.reason, /independence.*not established/);
});
const qs = Array.from({ length: 9 }, (_, i) => ({
  id: String(i),
  skill: "Loops",
  difficulty: (i % 3) + 1,
  kind: "prediction",
  prompt: "Output?",
  options: ["a", "b", "c", "d"],
  answer: 1,
  explanation: "Because",
}));
const diagnostic = {
  version: 1,
  status: "in_progress",
  source: "ai",
  questions: qs,
  answers: [],
  evidence: "client_graded_prediction_not_code_execution",
};
test("diagnostic starts medium, correct increases and incorrect reduces difficulty", () => {
  assert.equal(nextDiagnostic(diagnostic).difficulty, 2);
  const right = answerDiagnostic(diagnostic, 1, 1);
  assert.equal(nextDiagnostic(right).difficulty, 3);
  const wrong = answerDiagnostic(diagnostic, 0, 1);
  assert.equal(nextDiagnostic(wrong).difficulty, 1);
});
test("invalid AI questions fail closed, completion does not become code execution", () => {
  assert.throws(() => diagnosticQuestions({ questions: [{}] }));
  let d = diagnostic;
  for (let i = 0; i < 6; i++) d = answerDiagnostic(d, 1, i + 1);
  assert.equal(d.status, "completed");
  assert.equal(d.answers.length, 6);
  assert.equal(d.evidence, "client_graded_prediction_not_code_execution");
  assert.equal(answerDiagnostic(d, 1, 9), d);
});
test('unambiguous alias: attempt on "Loops" attaches to plan skill "Loops & Iteration"', () => {
  const s = {
    plan: { skills: [{ name: "Loops & Iteration", level: 0, note: "" }] },
    profile: {},
    struggle: {
      attempts: [
        {
          id: "1",
          at: 1,
          topicTitle: "Loops",
          passed: 1,
          total: 1,
          source: "practice",
        },
      ],
    },
  };
  const v = competencyView(s);
  assert.equal(v.length, 1);
  assert.equal(v[0].skill, "Loops & Iteration");
  assert.ok(v[0].estimate !== null);
  assert.equal(competencyPlan(s).skills[0].level, v[0].estimate);
});
test("weak or ambiguous aliases never merge unrelated skills", () => {
  const s = {
    plan: {
      skills: [
        { name: "C Fundamentals", level: 0, note: "" },
        { name: "Data Structures", level: 0, note: "" },
        { name: "Data Types", level: 0, note: "" },
      ],
    },
    profile: {},
    struggle: {
      attempts: [
        {
          id: "1",
          at: 1,
          topicTitle: "C",
          passed: 1,
          total: 1,
          source: "practice",
        },
        {
          id: "2",
          at: 2,
          topicTitle: "Data",
          passed: 1,
          total: 1,
          source: "practice",
        },
      ],
    },
  };
  const v = competencyView(s);
  assert.equal(v.length, 5);
  assert.equal(
    competencyView(s).find((c) => c.skill === "C Fundamentals").estimate,
    null,
  );
});
test("singular/plural aliases merge, C++ style names only match exactly", () => {
  const s = {
    plan: {
      skills: [
        { name: "Functions", level: 0, note: "" },
        { name: "C++", level: 0, note: "" },
      ],
    },
    profile: {},
    struggle: {
      attempts: [
        {
          id: "1",
          at: 1,
          topicTitle: "Function basics",
          passed: 1,
          total: 1,
          source: "practice",
        },
        {
          id: "2",
          at: 2,
          topicTitle: "C",
          passed: 1,
          total: 1,
          source: "practice",
        },
      ],
    },
  };
  const v = competencyView(s);
  assert.equal(v.find((c) => c.skill === "Functions").observations, 1);
  assert.equal(v.find((c) => c.skill === "C++").estimate, null);
});
