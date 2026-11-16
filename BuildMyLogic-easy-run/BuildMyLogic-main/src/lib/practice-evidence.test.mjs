import test from "node:test";
import assert from "node:assert/strict";
import { ingestPracticeEvidence } from "./practice-evidence.ts";
import { PRACTICE_TASKS, practiceTaskBody } from "./practice-task.ts";
import { competencyView, competencyContext } from "./competency.ts";
import { priorityLearningTopics } from "./adaptive-learning.ts";
const owner = "123e4567-e89b-42d3-a456-426614174000";
const base = () => ({
  profile: {},
  plan: {
    skills: [
      { name: "Loops & Iteration", level: 90 },
      { name: "React", level: 90 },
    ],
    missions: [{ id: "m1" }],
  },
  missionProgress: { m1: { status: "active" } },
  activity: [],
});
const snapshot = (id = PRACTICE_TASKS[0].id, passes = [0, 0, 1], gen = 0) => ({
  ...practiceTaskBody(id),
  session_id: "BML-TEST1",
  verified_owner_id: owner,
  task_generation: gen,
  evidence_provenance: "extension-reported",
  status: passes.at(-1) ? "completed" : "connected",
  attempts: passes.length,
  hints_used: 0,
  test_score: { passed: passes.at(-1), total: 1 },
  attempt_history: passes.map((p, i) => ({
    attempt: i + 1,
    at: 1000 + i,
    passed: p,
    total: 1,
    checkpoints: [
      {
        title: "practice",
        status: p ? "passed" : "failed",
        lastOutput: p ? "BML_PRACTICE_PASS:" + id : "Expected something else",
      },
    ],
  })),
});
test("all four finite checks enter shared competency/Mentor and exact Learn topic, never mission or unrelated skill", () => {
  for (const task of PRACTICE_TASKS) {
    const prev = base(),
      next = ingestPracticeEvidence(prev, snapshot(task.id, [0, 0]), owner);
    assert.equal(next.struggle.attempts.length, 2);
    assert.ok(priorityLearningTopics(next).has(task.concept));
    assert.ok(competencyContext(next).includes("extension-reported"));
    assert.equal(next.plan, prev.plan);
    assert.equal(next.missionProgress, prev.missionProgress);
    assert.equal(
      competencyView(next).find((s) => s.skill === "React").estimate,
      null,
    );
    assert.equal(
      next.struggle.misconceptions[0].topicId,
      task.concept + ":owner:" + owner,
    );
  }
});
test("one pass is one finite observation, not mastery; failure history survives pass and unchanged polls", () => {
  const prev = base(),
    remote = snapshot(),
    next = ingestPracticeEvidence(prev, remote, owner);
  assert.equal(next.struggle.attempts.length, 3);
  assert.equal(
    competencyView(next).find((s) => s.skill === "Loops & Iteration")
      .observations,
    3,
  );
  assert.ok(
    competencyView(next).find((s) => s.skill === "Loops & Iteration").estimate <
      80,
  );
  assert.equal(ingestPracticeEvidence(next, remote, owner), next);
  assert.equal(
    next.struggle.misconceptions.find((m) => m.status === "locked")?.status,
    "locked",
  );
});
test("archive own attempts import across question switches and same-task generations; restore replay is idempotent", () => {
  const a = snapshot(PRACTICE_TASKS[0].id, [0, 1]);
  delete a.verified_owner_id;
  const b = snapshot(PRACTICE_TASKS[1].id, [0], 1),
    c = snapshot(PRACTICE_TASKS[0].id, [1], 2);
  delete b.verified_owner_id;
  c.practice_history = [
    { challenge_id: a.challenge_id, state: a },
    { challenge_id: b.challenge_id, state: b },
  ];
  const next = ingestPracticeEvidence(base(), c, owner);
  assert.equal(next.struggle.attempts.length, 4);
  assert.equal(Object.keys(next.practiceEvidenceReceipts).length, 3);
  const restored = JSON.parse(JSON.stringify(next));
  assert.equal(ingestPracticeEvidence(restored, c, owner), restored);
  assert.equal(c.attempts, 1);
  assert.equal(a.attempts, 2);
});
test("durable watermark prevents replay after both bounded histories are evicted", () => {
  const remote = snapshot(),
    next = ingestPracticeEvidence(base(), remote, owner);
  next.struggle.attempts = [];
  next.struggle.ingestedSessions = [];
  assert.equal(ingestPracticeEvidence(next, remote, owner), next);
  const later = snapshot(undefined, [0, 0, 1, 0]);
  assert.equal(
    ingestPracticeEvidence(next, later, owner).struggle.attempts.length,
    1,
  );
});
test("unowned, other owner, fabricated aggregate, mismatched evaluator/marker/language/concept, sample are ignored", () => {
  for (const mutate of [
    (r) => delete r.verified_owner_id,
    (r) => (r.verified_owner_id = "223e4567-e89b-42d3-a456-426614174000"),
    (r) => (r.evidence_provenance = "legacy-client-reported"),
    (r) => (r.attempt_history = []),
    (r) => (r.checkpoints[0].evaluator.id = "other"),
    (r) => (r.checkpoints[0].evaluator.command = "npm test"),
    (r) =>
      (r.attempt_history[0].checkpoints[0].lastOutput =
        "prefix BML_PRACTICE_PASS:" + r.challenge_id),
    (r) => (r.language = "C"),
    (r) => (r.concept = "React"),
    (r) => (r.attempt_history[0].total = 7),
    (r) => (r.attempt_history[0].attempt = 9),
  ]) {
    const p = base(),
      r = snapshot(undefined, [1]);
    mutate(r);
    assert.equal(ingestPracticeEvidence(p, r, owner), p);
  }
  const p = base();
  assert.equal(ingestPracticeEvidence(p, snapshot(), undefined), p);
  p.sampleProvenance = {};
  assert.equal(ingestPracticeEvidence(p, snapshot(), owner), p);
});
test("archived foreign session, catalog mismatch and future generation cannot import", () => {
  for (const mutate of [
    (r) => (r.session_id = "foreign"),
    (r) => (r.task_generation = 8),
    (r) => (r.challenge_id = PRACTICE_TASKS[2].id),
  ]) {
    const archived = snapshot(undefined, [1]);
    mutate(archived);
    const current = snapshot(PRACTICE_TASKS[1].id, [], 1);
    current.practice_history = [
      { challenge_id: PRACTICE_TASKS[0].id, state: archived },
    ];
    const p = base();
    assert.equal(ingestPracticeEvidence(p, current, owner), p);
  }
});

test("malformed archived data and sparse attempt arrays fail closed without crashing sync", () => {
  for (const mutate of [
    (r) => (r.practice_history = [null, { state: null }]),
    (r) => (r.attempt_history = [null, null]),
    (r) => (r.checkpoints[0].evaluator.expectedOutputIncludes = null),
    (r) => (r.attempt_history[0].checkpoints = [null]),
    (r) => (r.practice_history = {}),
  ]) {
    const r = snapshot(undefined, [1]),
      p = base();
    mutate(r);
    assert.doesNotThrow(() => ingestPracticeEvidence(p, r, owner));
  }
});
