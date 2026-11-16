// Engine-produced retained receipts for isolated browser acceptance. No network/AI.
import {
  recordBuildSessionOutcome,
  recordReassessmentAttempt,
  attachReassessment,
  emptyStruggleState,
} from "../src/lib/struggle-engine.ts";
import { newPracticeReassessment } from "../src/lib/practice-reassessment.ts";
import { ingestPracticeEvidence } from "../src/lib/practice-evidence.ts";
import { practiceTaskBody } from "../src/lib/practice-task.ts";
const owner = "123e4567-e89b-42d3-a456-426614174000";
let s = emptyStruggleState;
for (const at of [1000, 2000])
  s = recordBuildSessionOutcome(s, {
    sessionKey: "fail" + at,
    sessionId: "BML-RECHECK",
    verifiedOwnerId: owner,
    sourceChallengeId: "python-conditions-sign-v1",
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
s = attachReassessment(
  s,
  s.misconceptions[0].id,
  newPracticeReassessment("python-conditions-sign-v1", 1, 3000),
);
const pass = (state, at) => {
  const m = state.misconceptions[0],
    r = m.reassessment;
  return recordReassessmentAttempt(state, {
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
};
const first = pass(s, 4000),
  second = pass(first, 5000);
const original = ingestPracticeEvidence(
  { activity: [] },
  {
    ...practiceTaskBody("python-conditions-sign-v1"),
    session_id: "BML-ORIGINAL",
    verified_owner_id: owner,
    task_generation: 0,
    evidence_provenance: "extension-reported",
    attempts: 1,
    attempt_history: [
      {
        attempt: 1,
        at: 6000,
        passed: 1,
        total: 1,
        checkpoints: [
          {
            status: "passed",
            lastOutput: "BML_PRACTICE_PASS:python-conditions-sign-v1",
          },
        ],
      },
    ],
  },
  owner,
);
console.log(
  JSON.stringify(
    [s, first, second].map((struggle) => ({
      ...original,
      struggle: {
        ...struggle,
        attempts: [...struggle.attempts, ...original.struggle.attempts],
      },
    })),
  ),
);
