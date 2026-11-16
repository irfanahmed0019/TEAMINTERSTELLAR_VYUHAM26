import test from "node:test";
import assert from "node:assert/strict";
import { progressEvidenceSummary } from "./progress-evidence.ts";
import { ingestPracticeEvidence } from "./practice-evidence.ts";
import { practiceTaskBody } from "./practice-task.ts";
const owner = "123e4567-e89b-42d3-a456-426614174000";
const base = () => ({
  plan: {
    skills: [{ name: "Unassessed plan skill", level: 90 }],
    missions: [],
  },
  missionProgress: { untouched: { status: "active" } },
  sessions: [],
  activity: [],
});
const remote = (id, pass) => ({
  ...practiceTaskBody(id),
  session_id: "BML-PROGRESS",
  verified_owner_id: owner,
  task_generation: 0,
  evidence_provenance: "extension-reported",
  status: "connected",
  attempts: 2,
  attempt_history: [1, 2].map((n) => ({
    attempt: n,
    at: 1000 + n,
    passed: pass,
    total: 1,
    checkpoints: [
      {
        status: pass ? "passed" : "failed",
        lastOutput: pass ? "BML_PRACTICE_PASS:" + id : "wrong",
      },
    ],
  })),
});
test("no observed evidence is not assessed, never a fabricated zero estimate", () => {
  assert.equal(progressEvidenceSummary(base()).average, null);
});
test("off-plan conditions affects overview immediately, pass retries count one question and replay adds nothing", () => {
  const b = base(),
    r = remote("python-conditions-sign-v1", 1),
    s = ingestPracticeEvidence(b, r, owner),
    v = progressEvidenceSummary(s);
  assert.equal(v.questionsPassed, 1);
  assert.equal(v.checkedAttempts, 2);
  assert.ok(v.average > 0);
  assert.ok(v.assessed.some((c) => c.skill.toLowerCase() === "conditions"));
  assert.equal(v.topicCheckpoints, 0);
  assert.deepEqual(
    progressEvidenceSummary(ingestPracticeEvidence(s, r, owner)),
    v,
  );
  assert.deepEqual(progressEvidenceSummary(JSON.parse(JSON.stringify(s))), v);
  assert.equal(s.missionProgress, b.missionProgress);
});
test("failed checks count as attempts but not passed questions, forged checkpoint flags do not count", () => {
  const s = ingestPracticeEvidence(
      base(),
      remote("python-conditions-vote-v1", 0),
      owner,
    ),
    v = progressEvidenceSummary(s);
  assert.equal(v.checkedAttempts, 2);
  assert.equal(v.questionsPassed, 0);
  assert.equal(v.topicCheckpoints, 0);
  s.struggle.misconceptions[0].status = "conquered";
  s.struggle.misconceptions[0].practiceCheckpoint = {
    passedStages: [{ stage: 1 }, { stage: 2 }],
    masteredAt: 3000,
  };
  assert.equal(progressEvidenceSummary(s).topicCheckpoints, 0);
});

import {
  recordBuildSessionOutcome,
  recordReassessmentAttempt,
  attachReassessment,
  emptyStruggleState,
} from "./struggle-engine.ts";
import { newPracticeReassessment } from "./practice-reassessment.ts";
function recovery(
  source = "python-conditions-sign-v1",
  session = "BML-RECOVERY",
) {
  let s = emptyStruggleState;
  for (const at of [1000, 2000])
    s = recordBuildSessionOutcome(s, {
      sessionKey: session + at,
      sessionId: session,
      verifiedOwnerId: owner,
      sourceChallengeId: source,
      topicId: "conditions",
      concept: "conditions",
      topicTitle: "Conditions",
      language: "python",
      exerciseTitle: "Original",
      completed: false,
      failed: true,
      passed: 0,
      total: 1,
      checkpoints: [
        { title: "Conditions", status: "failed", lastOutput: "wrong" },
      ],
      at,
    }).state;
  return attachReassessment(
    s,
    s.misconceptions[0].id,
    newPracticeReassessment(source, 1, 3000),
  );
}
function passStage(s, at = 4000) {
  const m = s.misconceptions[0],
    r = m.reassessment;
  return recordReassessmentAttempt(s, {
    misconceptionId: m.id,
    ownerId: owner,
    practiceStage: r.practiceStage,
    reassessmentCreatedAt: r.createdAt,
    constructOk: true,
    at,
    graded: r.tests.map((t) => ({
      ...t,
      actual: t.expected,
      passed: true,
      hidden: false,
      status: "Accepted",
      stderr: "",
    })),
  }).state;
}
test("retained even/odd pass counts immediately, second distinct recheck adds one and only then a checkpoint", () => {
  const one = passStage(recovery()),
    b = base();
  let s = { ...b, struggle: one };
  assert.equal(progressEvidenceSummary(s).questionsPassed, 1);
  assert.equal(progressEvidenceSummary(s).topicCheckpoints, 0);
  const before = JSON.stringify(s);
  assert.equal(progressEvidenceSummary(JSON.parse(before)).questionsPassed, 1);
  assert.equal(JSON.stringify(s), before);
  s = { ...b, struggle: passStage(one, 5000) };
  assert.equal(progressEvidenceSummary(s).questionsPassed, 2);
  assert.equal(progressEvidenceSummary(s).topicCheckpoints, 1);
  assert.equal(s.missionProgress, b.missionProgress);
});
test("same canonical even/odd across source tasks/patterns counts once, distinct contracts count separately", () => {
  const first = passStage(recovery()),
    same = passStage(recovery("python-conditions-vote-v1", "BML-SECOND"));
  const merged = {
    ...base(),
    struggle: {
      ...first,
      attempts: [...first.attempts, ...same.attempts],
      misconceptions: [...first.misconceptions, ...same.misconceptions],
    },
  };
  assert.equal(progressEvidenceSummary(merged).questionsPassed, 1);
  const original = ingestPracticeEvidence(
    merged,
    remote("python-conditions-sign-v1", 1),
    owner,
  );
  assert.equal(progressEvidenceSummary(original).questionsPassed, 2);
});
test("unpassed, missing or forged stage markers do not grant unique questions", () => {
  const zero = recovery();
  assert.equal(
    progressEvidenceSummary({ ...base(), struggle: zero }).questionsPassed,
    0,
  );
  const good = passStage(zero);
  for (const edit of [
    (s) => (s.attempts = []),
    (s) => (s.misconceptions[0].synthetic = true),
    (s) =>
      (s.attempts.find((a) => a.source === "reassessment").fullPass = false),
    (s) =>
      (s.attempts.find((a) => a.source === "reassessment").synthetic = true),
    (s) => (s.attempts.find((a) => a.source === "reassessment").total = 3),
    (s) =>
      (s.attempts.find((a) => a.source === "reassessment").exerciseTitle =
        "Even or odd"),
    (s) => (s.misconceptions[0].practiceCheckpoint.passedStages[0].at = 1000),
    (s) =>
      (s.misconceptions[0].reassessment.practiceSource =
        "python-loops-fibonacci-v1"),
    (s) => (s.misconceptions[0].recoveryOwnerId = undefined),
  ]) {
    const bad = JSON.parse(JSON.stringify(good));
    edit(bad);
    assert.equal(
      progressEvidenceSummary({ ...base(), struggle: bad }).questionsPassed,
      0,
    );
  }
});
