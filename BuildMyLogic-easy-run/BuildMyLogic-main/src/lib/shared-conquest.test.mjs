import test from "node:test";
import assert from "node:assert/strict";
import { savedConquestReceipt } from "./shared-conquest.ts";
import {
  emptyStruggleState,
  recordPracticeAttempt,
  recordDiagnosticPrediction,
  newReassessment,
  attachReassessment,
  recordReassessmentAttempt,
} from "./struggle-engine.ts";
const session = {
  sessionId: "BML-QATEST",
  userId: "12345678-1234-4234-8234-123456789abc",
  challengeId: "qa-project",
};
function fixture() {
  let s = emptyStruggleState;
  for (const at of [1000, 2000])
    s = recordPracticeAttempt(s, {
      topicId: "loops",
      topicTitle: "Loops",
      language: "python",
      exerciseTitle: "Count",
      at,
      graded: [
        {
          name: "loop endpoint",
          hidden: false,
          passed: false,
          expected: "5",
          actual: "4",
          status: "Wrong Answer",
          stderr: "",
        },
      ],
    }).state;
  const id = s.misconceptions[0].id;
  s = {
    ...s,
    misconceptions: s.misconceptions.map((m) => ({
      ...m,
      sourceSessionId: session.sessionId,
      recoveryOwnerId: session.userId,
      sourceMissionId: session.challengeId,
      transferTopicId: "loops",
    })),
  };
  s = recordDiagnosticPrediction(s, id, 0, true, 3000);
  s = attachReassessment(s, id, newReassessment("loops", "python", 4000, true));
  const tests = s.misconceptions[0].reassessment.tests;
  return recordReassessmentAttempt(s, {
    misconceptionId: id,
    ownerId: session.userId,
    at: 5000,
    constructOk: true,
    graded: tests.map((t) => ({
      name: t.name,
      expected: t.expected,
      actual: t.expected,
      passed: true,
      hidden: false,
      status: "Accepted",
      stderr: "",
    })),
  }).state;
}
test("same owner/session/mission saved diagnosed conquest yields stable minimal receipt", () => {
  const s = fixture(),
    m = s.misconceptions[0];
  assert.equal(m.status, "conquered");
  const r = savedConquestReceipt(s, m.id, session);
  assert.ok(r);
  assert.deepEqual(Object.keys(r).sort(), [
    "conqueredAt",
    "id",
    "patternId",
    "summary",
  ]);
  assert.deepEqual(savedConquestReceipt(structuredClone(s), m.id, session), r);
});
for (const [name, mutate] of Object.entries({
  owner: (s) => (s.misconceptions[0].recoveryOwnerId = "other"),
  session: (s) => (s.misconceptions[0].sourceSessionId = "BML-OTHER"),
  mission: (s) => (s.misconceptions[0].sourceMissionId = "other"),
  locked: (s) => (s.misconceptions[0].status = "locked"),
  notReassessed: (s) => (s.misconceptions[0].reassessed = false),
  noDiagnosis: (s) => delete s.misconceptions[0].diagnosis,
  unconfirmed: (s) => (s.misconceptions[0].diagnosis.confirmed = false),
  changedCheck: (s) =>
    (s.misconceptions[0].reassessment.tests[0].expected = "tampered"),
  noAttempt: (s) => (s.attempts = []),
  oldTask: (s) => (s.misconceptions[0].reassessment.version = "legacy"),
  failedAttempt: (s) => (s.attempts[0].fullPass = false),
})) {
  test("reject " + name, () => {
    const s = fixture();
    mutate(s);
    assert.equal(
      savedConquestReceipt(s, s.misconceptions[0].id, session),
      null,
    );
  });
}
