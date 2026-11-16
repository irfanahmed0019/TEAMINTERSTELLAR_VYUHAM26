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

test("Learn weak-topic recommendations preserve strong loops and ignore time-only support", () => {
  const fixture = {
    struggle: {
      attempts: [
        { topicId: "loops", passed: 4, total: 4, at: 1 },
        { topicId: "conditions", passed: 0, total: 4, at: 2 },
        { topicId: "conditions", passed: 1, total: 4, at: 3 },
      ],
      misconceptions: [],
    },
    profile: {
      initialCodingDiagnostic: { scaffolds: [{ topicId: "strings" }] },
    },
  };
  const before = JSON.stringify(fixture);
  const priorities = priorityLearningTopics(fixture, { gradedOnly: true });
  assert.deepEqual([...priorities.keys()], ["conditions"]);
  assert.equal(JSON.stringify(fixture), before);
  assert.equal(
    priorityLearningTopics({ profile: fixture.profile }, { gradedOnly: true })
      .size,
    0,
  );
  assert.equal(
    priorityLearningTopics(
      { struggle: { attempts: [], misconceptions: [] } },
      { gradedOnly: true },
    ).size,
    0,
  );
});
test("recommended conditions lesson/video use the exact existing language-specific catalog", async () => {
  const { STUDY_TOPICS } = await import("./topic-library.ts");
  const priorities = priorityLearningTopics(
    {
      struggle: {
        attempts: [
          { topicId: "conditions", passed: 0, total: 1 },
          { topicId: "conditions", passed: 0, total: 1 },
        ],
        misconceptions: [],
      },
    },
    { gradedOnly: true },
  );
  const topics = STUDY_TOPICS.filter((t) => priorities.has(t.id));
  assert.deepEqual(
    topics.map((t) => t.id),
    ["conditions"],
  );
  for (const language of ["python", "c"]) {
    assert.ok(topics[0].notes[language].points.length);
    assert.ok(topics[0].videos[language][0].id);
    assert.match(topics[0].videos[language][0].title, /if|condition/i);
  }
});
