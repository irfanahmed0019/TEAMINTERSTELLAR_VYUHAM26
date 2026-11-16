import test from "node:test";
import assert from "node:assert/strict";
import { newPracticeReassessment } from "./practice-reassessment.ts";
import {
  recordBuildSessionOutcome,
  recordReassessmentAttempt,
  attachReassessment,
  emptyStruggleState,
} from "./struggle-engine.ts";
import { PRACTICE_TASKS } from "./practice-task.ts";
const owner = "123e4567-e89b-42d3-a456-426614174000";
function locked(task) {
  let state = emptyStruggleState;
  for (let n = 1; n <= 2; n++)
    state = recordBuildSessionOutcome(state, {
      sessionKey: task.id + n,
      sessionId: "BML-FRESH",
      verifiedOwnerId: owner,
      sourceChallengeId: task.id,
      topicId: task.concept,
      concept: task.concept,
      topicTitle: task.concept,
      language: "python",
      exerciseTitle: "Original task",
      completed: false,
      failed: true,
      passed: 0,
      total: 1,
      checkpoints: [
        { title: task.concept, status: "failed", lastOutput: "wrong" },
      ],
      at: n * 1000,
    }).state;
  return state;
}
const args = (state, at = 4000) => {
  const m = state.misconceptions[0],
    r = m.reassessment;
  return {
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
      hidden: true,
      status: "Accepted",
      stderr: "",
    })),
  };
};
test("all4 require two DISTINCT full fresh contracts; first pass stays locked, second completes bounded checkpoint", () => {
  for (const task of PRACTICE_TASKS) {
    let s = locked(task);
    const id = s.misconceptions[0].id;
    const r = newPracticeReassessment(task.id, 1, 3000);
    s = attachReassessment(s, id, r);
    const one = recordReassessmentAttempt(s, args(s));
    assert.equal(one.outcome.conquered, null);
    assert.equal(one.state.misconceptions[0].status, "locked");
    assert.equal(
      one.state.misconceptions[0].practiceCheckpoint.passedStages.length,
      1,
    );
    const twoSpec = one.state.misconceptions[0].reassessment;
    assert.notEqual(twoSpec.task, r.task);
    assert.notDeepEqual(twoSpec.tests, r.tests);
    const restored = JSON.parse(JSON.stringify(one.state));
    const two = recordReassessmentAttempt(restored, args(restored, 5000));
    assert.equal(two.outcome.conquered.status, "conquered");
    assert.equal(
      two.outcome.conquered.practiceCheckpoint.passedStages.length,
      2,
    );
    assert.equal(two.state.attempts.length, 4);
    assert.equal(
      recordReassessmentAttempt(two.state, args(restored, 6000)).outcome,
      null,
    );
  }
});
test("wrong owner, stale stage, changed cases/construct and original transfer-v1 cannot bypass progression", () => {
  for (const task of PRACTICE_TASKS) {
    let s = locked(task);
    s = attachReassessment(
      s,
      s.misconceptions[0].id,
      newPracticeReassessment(task.id, 1, 3000),
    );
    for (const change of [
      (a) => (a.ownerId = "other"),
      (a) => (a.practiceStage = 2),
      (a) => (a.reassessmentCreatedAt = 2999),
    ]) {
      const a = args(s);
      change(a);
      assert.equal(recordReassessmentAttempt(s, a).outcome, null);
    }
    const a = args(s);
    a.graded[0].actual = "original known output";
    a.graded[0].passed = false;
    assert.equal(recordReassessmentAttempt(s, a).outcome.conquered, null);
    assert.equal(
      recordReassessmentAttempt(s, { ...args(s), constructOk: false }).outcome
        .conquered,
      null,
    );
    const tampered = structuredClone(s);
    tampered.misconceptions[0].reassessment.constructRegex = ".*";
    assert.equal(
      recordReassessmentAttempt(tampered, args(tampered)).outcome,
      null,
    );
    const legacy = structuredClone(s);
    legacy.misconceptions[0].reassessment.version = "transfer-v1";
    assert.equal(recordReassessmentAttempt(legacy, args(legacy)).outcome, null);
    const one = recordReassessmentAttempt(s, args(s));
    assert.equal(
      recordReassessmentAttempt(one.state, args(s, 5000)).outcome,
      null,
    );
  }
});
test("unsupported or third stage yields no fabricated task", () => {
  assert.equal(newPracticeReassessment("unknown", 1, 1), null);
  assert.equal(newPracticeReassessment(PRACTICE_TASKS[0].id, 3, 1), null);
});

import { spawnSync } from "node:child_process";
const programs = {
  loops: [
    "n=int(input());s=0\nfor x in range(n+1):\n if x%2==0:s+=x\nprint(s)",
    "n=int(input());c=0\nfor x in range(1,n+1):\n if x%2:c+=1\nprint(c)",
    'print("0 1 1 2 3 5 8 13 21 34")',
  ],
  conditions: [
    'n=int(input())\nif n%2==0:print("even")\nelse:print("odd")',
    'n=int(input())\nif n<0:print("cold")\nelif n<=30:print("warm")\nelse:print("hot")',
    'n=int(input())\nprint("negative" if n<0 else "positive" if n>0 else "zero")',
  ],
  functions: [
    "def cube(n):return n*n*n\nprint(cube(int(input())))",
    "def distance(n):return -n if n<0 else n\nprint(distance(int(input())))",
    "def double(n):return 2*n\nprint(double(int(input())))",
  ],
  strings: [
    's=input();c=0\nfor x in s:\n if x==" ":c+=1\nprint(c)',
    's=input();c=0\nfor x in s:\n if "0"<=x<="9":c+=1\nprint(c)',
    's=input();c=0\nfor x in s:\n if x in "aeiou":c+=1\nprint(c)',
  ],
};
function runs(code, spec) {
  return spec.tests.every((t) => {
    const p = spawnSync("python3", ["-I", "-c", code], {
      input: t.stdin,
      encoding: "utf8",
      timeout: 3000,
    });
    return p.status === 0 && p.stdout.trim() === t.expected.trim();
  });
}
test("actual Python: all8 fresh programs pass finite cases; original known answer and stage1 replay fail stage2", () => {
  for (const task of PRACTICE_TASKS) {
    const [a, b, old] = programs[task.concept],
      one = newPracticeReassessment(task.id, 1, 3000),
      two = newPracticeReassessment(task.id, 2, 5000);
    assert.ok(runs(a, one), task.id + " stage1");
    assert.ok(runs(b, two), task.id + " stage2");
    assert.equal(runs(old, one), false);
    assert.equal(runs(old, two), false);
    assert.equal(runs(a, two), false);
  }
});

import { savedConquestReceipt } from "./shared-conquest.ts";
test("owner cloud-saved two-task checkpoint produces receipt; missing first-pass proof or owner/source mismatch rejects", () => {
  const task = PRACTICE_TASKS[1];
  let s = locked(task);
  s = attachReassessment(
    s,
    s.misconceptions[0].id,
    newPracticeReassessment(task.id, 1, 3000),
  );
  s = recordReassessmentAttempt(s, args(s)).state;
  s = recordReassessmentAttempt(s, args(s, 5000)).state;
  const m = s.misconceptions[0],
    session = { sessionId: "BML-FRESH", userId: owner, challengeId: task.id };
  assert.ok(savedConquestReceipt(s, m.id, session));
  assert.equal(
    savedConquestReceipt(
      { ...s, attempts: s.attempts.filter((a) => a.at !== 4000) },
      m.id,
      session,
    ),
    null,
  );
  assert.equal(
    savedConquestReceipt(s, m.id, { ...session, userId: "other" }),
    null,
  );
  assert.equal(
    savedConquestReceipt(s, m.id, { ...session, challengeId: "other" }),
    null,
  );
});

test("fabricated1/2counter or missing prior actual pass cannot unlock stage2", () => {
  const task = PRACTICE_TASKS[1];
  let s = locked(task);
  const m = s.misconceptions[0];
  m.practiceCheckpoint = { passedStages: [{ stage: 1, at: 3500 }] };
  s = attachReassessment(s, m.id, newPracticeReassessment(task.id, 2, 4000));
  assert.equal(recordReassessmentAttempt(s, args(s, 5000)).outcome, null);
});
