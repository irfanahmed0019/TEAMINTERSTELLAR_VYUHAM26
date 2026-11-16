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
