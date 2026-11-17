import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { ingestSurpriseTests } from "./surprise-tests.ts";
import { ingestPracticeEvidence } from "./practice-evidence.ts";
import { emptyStruggleState } from "./struggle-engine.ts";
import { practiceTaskBody } from "./practice-task.ts";
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.SARVAM_API_KEY;
const temp = new URL("./surprise-server.testable.tmp.ts", import.meta.url);
writeFileSync(
  temp,
  readFileSync(
    new URL("./learning-sessions.server.ts", import.meta.url),
    "utf8",
  ).replace(
    'import { sarvamJson } from "./sarvam.server";',
    'const sarvamJson = async () => { throw new Error("No AI permitted"); };',
  ),
);
writeFileSync(
  temp,
  readFileSync(temp, "utf8").replace(
    'import { claimNextSurprise } from "./surprise-slot.server.ts";',
    'const slots=new Map(); const claimNextSurprise=async(s)=>{const b=[s.sessionId,s.challengeId,s.taskGeneration??0].join(":");if(!slots.has(s.userId))slots.set(s.userId,b);return slots.get(s.userId)===b;};',
  ),
);
process.on("exit", () => rmSync(temp, { force: true }));
const { startLearningSession, assignPracticeTask, recordEvent, stateOf } =
  await import(temp.href);
const owner = "123e4567-e89b-42d3-a456-426614174000";
const base = {
  activity: [],
  sessions: [],
  missionProgress: {},
  skillMemory: { unchanged: { level: 4 } },
  plan: { headline: "unchanged" },
  practiceEvidenceReceipts: {},
  struggle: { attempts: [] },
};
test("next assignment is ordinary-looking; only validated completion becomes private surprise result", async () => {
  const task = practiceTaskBody("python-conditions-sign-v1");
  const session = await startLearningSession({ ...task, user_id: owner });
  assert.equal(
    stateOf(session).surprise_test,
    undefined,
    "not retroactive to first/current practice",
  );
  const next = await assignPracticeTask(
    session,
    "python-conditions-sign-v1",
    { challenge: session.challengeId, generation: 0 },
    "conditions",
  );
  assert.ok(next.surprise_test.enabled);
  assert.ok(!next.instructions.toLowerCase().includes("surprise"));
  const remote = () => ({ ...stateOf(session), verified_owner_id: owner });
  assert.equal(
    ingestSurpriseTests(base, remote(), owner),
    base,
    "no pre-completion result",
  );
  recordEvent(session, "test_result", {
    checkpoint_results: [
      {
        index: 0,
        passed: true,
        evidence_kind: "assertion",
        evaluator_id: "WRONG",
        output: "pretend",
      },
    ],
  });
  assert.notEqual(session.status, "completed");
  assert.equal(ingestSurpriseTests(base, remote(), owner), base);
  const cp = session.checkpoints[0];
  recordEvent(session, "test_result", {
    checkpoint_results: [
      {
        index: 0,
        passed: true,
        evidence_kind: "assertion",
        evaluator_id: cp.evaluator.id,
        output: cp.evaluator.expectedOutputIncludes.join("\n"),
      },
    ],
  });
  assert.equal(session.status, "completed");
  const r = remote();
  const saved = ingestSurpriseTests(base, r, owner);
  assert.equal(Object.keys(saved.surpriseTests).length, 1);
  assert.equal(ingestSurpriseTests(saved, r, owner), saved, "idempotent");
  for (const key of [
    "plan",
    "skillMemory",
    "struggle",
    "missionProgress",
    "activity",
  ])
    assert.equal(saved[key], base[key], key);
  assert.equal(
    ingestPracticeEvidence(saved, r, owner),
    saved,
    "no skill/struggle scoring",
  );
  assert.equal(
    ingestSurpriseTests(base, r, "223e4567-e89b-42d3-a456-426614174000"),
    base,
    "owner isolated",
  );
  const roundtrip = JSON.parse(JSON.stringify(saved));
  assert.deepEqual(
    roundtrip.surpriseTests,
    saved.surpriseTests,
    "cloud JSON roundtrip",
  );
  await assignPracticeTask(
    session,
    session.challengeId,
    { challenge: session.challengeId, generation: 1 },
    "conditions",
  );
  const archived = remote();
  assert.equal(
    archived.surprise_test,
    undefined,
    "later question is ordinary, not another test",
  );
  assert.equal(
    ingestSurpriseTests(base, archived, owner).surpriseTests[
      Object.keys(saved.surpriseTests)[0]
    ].attempts,
    2,
    "history retains result",
  );
  const ordinary = session.checkpoints[0];
  recordEvent(session, "test_result", {
    checkpoint_results: [
      {
        index: 0,
        passed: true,
        evidence_kind: "assertion",
        evaluator_id: ordinary.evaluator.id,
        output: ordinary.evaluator.expectedOutputIncludes.join("\n"),
      },
    ],
  });
  const ordinaryBase = { ...base, struggle: emptyStruggleState };
  const credited = ingestPracticeEvidence(ordinaryBase, remote(), owner);
  assert.notEqual(
    credited.struggle,
    ordinaryBase.struggle,
    "ordinary learning credit resumes after one surprise",
  );
});

test("failed attempts stay ordinary until explicit end, then retain failure without cherry-picking", async () => {
  const s = await startLearningSession({
    ...practiceTaskBody("python-conditions-sign-v1"),
    user_id: "223e4567-e89b-42d3-a456-426614174000",
  });
  await assignPracticeTask(
    s,
    s.challengeId,
    { challenge: s.challengeId, generation: 0 },
    "conditions",
  );
  const cp = s.checkpoints[0];
  recordEvent(s, "test_result", {
    checkpoint_results: [
      {
        index: 0,
        passed: false,
        evidence_kind: "assertion",
        evaluator_id: cp.evaluator.id,
        output: "Expected eligible for age18, received underage",
      },
    ],
  });
  const remote = () => ({
    ...stateOf(s),
    verified_owner_id: "223e4567-e89b-42d3-a456-426614174000",
  });
  assert.equal(
    ingestSurpriseTests(base, remote(), "223e4567-e89b-42d3-a456-426614174000"),
    base,
    "failure alone is not the end",
  );
  // Explicit end is the same terminal state used by failSession; do not call its AI recovery.
  s.status = "failed";
  const saved = ingestSurpriseTests(
    base,
    remote(),
    "223e4567-e89b-42d3-a456-426614174000",
  );
  const result = Object.values(saved.surpriseTests)[0];
  assert.equal(result.outcome, "ended");
  assert.equal(result.passed, 0);
  assert.equal(result.total, 1);
  assert.equal(result.attempts, 1);
  assert.equal(saved.skillMemory, base.skillMemory);
  assert.equal(saved.struggle, base.struggle);
  const forged = remote();
  forged.test_score = { passed: 1, total: 1 };
  assert.equal(
    ingestSurpriseTests(base, forged, "223e4567-e89b-42d3-a456-426614174000"),
    base,
    "aggregate cannot invent a pass",
  );
});
