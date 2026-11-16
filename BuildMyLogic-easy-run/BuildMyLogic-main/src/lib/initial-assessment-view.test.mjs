import test from "node:test";
import assert from "node:assert/strict";
import { initialAssessmentView } from "./initial-assessment-view.ts";
const e = {
  id: "initial-coding:one",
  ownerId: "owner",
  source: "server-graded initial coding tests",
  taskId: "coding-v1:loops:transfer",
  topicId: "loops",
  language: "python",
  skill: "Loops",
  at: 100,
  passed: 0,
  total: 4,
  hintsUsed: 1,
  performance: {
    expectedMs: 480000,
    activeMs: 1000,
    timingQuality: "browser-interaction-observed",
  },
};
test("restored display requires same hydrated owner and valid finite source/task/counts/time; history not mutated", () => {
  assert.deepEqual(initialAssessmentView([e], "owner", true), [e]);
  assert.deepEqual(initialAssessmentView([e], "other", true), []);
  assert.deepEqual(initialAssessmentView([e], undefined, true), []);
  assert.deepEqual(initialAssessmentView([e], "owner", false), []);
  const original = JSON.stringify(e);
  for (const bad of [
    { at: NaN },
    { at: 0 },
    { passed: 8 },
    { passed: 0.5 },
    { total: 0 },
    { total: 3 },
    { hintsUsed: -1 },
    { hintsUsed: 2 },
    { source: "client" },
    { language: "c", skill: "Other" },
    { taskId: "bad" },
    { performance: { ...e.performance, activeMs: Infinity } },
    { performance: { ...e.performance, expectedMs: 100 } },
    { performance: { ...e.performance, timingQuality: "server-observed" } },
  ])
    assert.deepEqual(
      initialAssessmentView([{ ...e, ...bad }], "owner", true),
      [],
    );
  assert.equal(JSON.stringify(e), original);
});
