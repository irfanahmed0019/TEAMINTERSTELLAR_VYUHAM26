import test from "node:test";
import assert from "node:assert/strict";
import { priorityLearningTopics } from "./adaptive-learning.ts";
const state = {
  struggle: {
    attempts: [
      { topicId: "loops", passed: 0, total: 2 },
      { topicId: "loops", passed: 1, total: 2 },
    ],
    misconceptions: [],
  },
};
test("actual repeated exact concept failure prioritizes learning, one event and unrelated skill do not", () => {
  const p = priorityLearningTopics(state);
  assert.ok(p.has("loops"));
  assert.equal(p.has("strings"), false);
  assert.equal(
    priorityLearningTopics({
      struggle: {
        attempts: state.struggle.attempts.slice(0, 1),
        misconceptions: [],
      },
    }).size,
    0,
  );
});
test("samples/time do not manufacture learning difficulty", () => {
  assert.equal(
    priorityLearningTopics({ ...state, sampleProvenance: { version: 1 } }).size,
    0,
  );
  assert.equal(
    priorityLearningTopics({
      struggle: {
        attempts: [{ topicId: "loops", passed: 1, total: 1, activeMs: 900000 }],
        misconceptions: [],
      },
    }).size,
    0,
  );
});
