import test from "node:test";
import assert from "node:assert/strict";
import { easierTaskOffer, chooseEasierTask } from "./easier-task.ts";
const base = () => ({
  plan: { missions: [{ id: "old" }] },
  missionProgress: { old: { status: "active", completedSteps: [0] } },
  activity: [],
  struggle: {
    attempts: Array.from({ length: 3 }, (_, i) => ({
      id: "a" + i,
      topicId: "loops",
      exerciseTitle: "Hard loop",
      language: "python",
      at: i,
      passed: 0,
      total: 3,
      fullPass: false,
      source: "practice",
    })),
  },
});
test("three distinct real failures enable explicit non-destructive beginner choice", () => {
  const s = base(),
    n = chooseEasierTask(s);
  assert.ok(easierTaskOffer(s));
  assert.equal(n.plan.missions[0].title, "Add two numbers");
  assert.equal(n.plan.missions.length, 2);
  assert.deepEqual(n.struggle, s.struggle);
  assert.deepEqual(n.missionProgress.old, s.missionProgress.old);
  assert.equal(easierTaskOffer(n), null);
  assert.equal(s.plan.missions.length, 1);
});
test("no early offer, synthetic evidence, duplicate IDs, pass reset or cross-task mixing", () => {
  for (const mutate of [
    (s) => s.struggle.attempts.pop(),
    (s) => (s.sampleProvenance = {}),
    (s) => (s.struggle.attempts[0].synthetic = true),
    (s) => (s.struggle.attempts[0].id = "a1"),
    (s) => (s.struggle.attempts[2].fullPass = true),
    (s) => (s.struggle.attempts[0].exerciseTitle = "Other"),
  ]) {
    const s = base();
    mutate(s);
    assert.equal(easierTaskOffer(s), null);
    assert.equal(chooseEasierTask(s), s);
  }
});
test("VSCode attempt count never crosses task generation or session", () => {
  const s = base();
  s.struggle.attempts.forEach((a, i) => {
    a.source = "vscode";
    a.id = `practice:BML-ABCDE:1:python-loops-triangular-v1:${i + 1}:owner:qa`;
  });
  assert.ok(easierTaskOffer(s));
  s.struggle.attempts[0].id =
    "practice:BML-OTHER:1:python-loops-triangular-v1:1:owner:qa";
  assert.equal(easierTaskOffer(s), null);
  s.struggle.attempts[0].id =
    "practice:BML-ABCDE:0:python-loops-triangular-v1:1:owner:qa";
  assert.equal(easierTaskOffer(s), null);
});
