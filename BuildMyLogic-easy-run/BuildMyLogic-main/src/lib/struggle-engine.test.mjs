/**
 * Deterministic coverage for the Struggle Engine:
 * real graded attempts → signatures → locks → targeted challenges → conquer.
 * No recorded attempt, no evidence: passes on a fresh state change nothing.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  attachReassessment,
  buildReassessmentPlan,
  classifyFailure,
  constructSatisfied,
  emptyStruggleState,
  failureReplay,
  failureSignature,
  markCelebrated,
  pendingCelebration,
  recordBuildSessionOutcome,
  recordPracticeAttempt,
  recordReassessmentAttempt,
  variantStdin,
  struggleByTopic,
  struggleMetrics,
  strugglePatterns,
} from "./struggle-engine.ts";

const baseInput = {
  topicId: "loops",
  topicTitle: "Loops",
  language: "python",
  exerciseTitle: "Sum 1 to n",
  exerciseHint: "range(a, b) stops before b.",
};

function graded(fails) {
  const all = [
    { name: "basic sum", hidden: false, passed: true, expected: "15", actual: "15", status: "Accepted", stderr: "" },
    { name: "edge case: n = 1", hidden: false, passed: true, expected: "1", actual: "1", status: "Accepted", stderr: "" },
  ];
  for (const name of fails) {
    const t = all.find((x) => x.name === name);
    if (t) {
      t.passed = false;
      t.actual = "0";
      t.status = "Wrong Answer";
    }
  }
  return all;
}

test("classification: compilation, runtime, edge-case name, logic", () => {
  assert.equal(classifyFailure({ name: "t", expected: "1", actual: "", status: "Compilation Error", stderr: "x" }), "syntax");
  assert.equal(classifyFailure({ name: "t", expected: "1", actual: "", status: "Runtime Error (NZEC)", stderr: "x" }), "runtime");
  assert.equal(classifyFailure({ name: "edge case: zero", expected: "0", actual: "1", status: "Wrong Answer", stderr: "" }), "edge_case");
  assert.equal(classifyFailure({ name: "prints table", expected: "1\n2\n3", actual: "a\nb\nc", status: "Wrong Answer", stderr: "" }), "logic");
  assert.equal(classifyFailure({ name: "sum", expected: "1\n2\n3", actual: "1\n2\n4", status: "Wrong Answer", stderr: "" }), "edge_case");
});

test("classification: case-only or spacing-only mismatch is formatting, not conceptual", () => {
  assert.equal(
    classifyFailure({ name: "prints positive", expected: "positive", actual: "Positive", status: "Wrong Answer", stderr: "" }),
    "formatting",
  );
  assert.equal(
    classifyFailure({ name: "prints table", expected: "1  2", actual: "1 2", status: "Wrong Answer", stderr: "" }),
    "formatting",
  );
  assert.equal(
    classifyFailure({ name: "prints positive", expected: "positive", actual: "negative", status: "Wrong Answer", stderr: "" }),
    "logic",
  );
});

test("signature is stable across attempts with the same failing tests", () => {
  assert.equal(
    failureSignature("edge_case", ["B test", "a test"]),
    failureSignature("edge_case", ["A TEST", "b test"])
  );
  assert.notEqual(failureSignature("logic", ["a"]), failureSignature("edge_case", ["a"]));
});

test("a full pass on a fresh state creates no misconception and no celebration", () => {
  const { state, outcome } = recordPracticeAttempt(emptyStruggleState, { ...baseInput, graded: graded([]) });
  assert.equal(outcome.attempt.fullPass, true);
  assert.equal(state.misconceptions.length, 0);
  assert.equal(outcome.conquered, null);
  assert.equal(pendingCelebration(state), null);
});

test("same failure twice locks a misconception with a targeted challenge", () => {
  let state = emptyStruggleState;
  let r = recordPracticeAttempt(state, { ...baseInput, graded: graded(["edge case: n = 1"]), at: 1000 });
  assert.equal(r.outcome.locked, null, "first failure only watches");
  state = r.state;
  r = recordPracticeAttempt(state, { ...baseInput, graded: graded(["edge case: n = 1"]), at: 2000 });
  assert.ok(r.outcome.locked, "second identical failure locks");
  assert.equal(r.outcome.locked.depth, "deep");
  assert.ok(r.outcome.locked.targetedChallenge.title.includes("edge case: n = 1"));
  assert.equal(r.state.misconceptions[0].occurrences, 2);
});

test("a regular full pass does NOT conquer a locked pattern; only its reassessment does", () => {
  let state = emptyStruggleState;
  state = recordPracticeAttempt(state, { ...baseInput, graded: graded(["edge case: n = 1"]), at: 1000 }).state;
  state = recordPracticeAttempt(state, { ...baseInput, graded: graded(["edge case: n = 1"]), at: 2000 }).state;
  const locked = state.misconceptions[0];
  assert.equal(locked.status, "locked");

  // Same-exercise full pass: recorded, pattern stays locked, no celebration.
  const afterPass = recordPracticeAttempt(state, { ...baseInput, graded: graded([]), at: 60000 });
  assert.equal(afterPass.outcome.conquered, null, "regular pass no longer conquers");
  assert.equal(afterPass.state.misconceptions[0].status, "locked");
  assert.equal(pendingCelebration(afterPass.state), null);

  // A reassessment pass before the lock time is rejected outright.
  const early = recordReassessmentAttempt(afterPass.state, {
    misconceptionId: locked.id,
    graded: graded([]),
    constructOk: true,
    at: 1500,
  });
  assert.equal(early.outcome, null, "reassessment must follow the lock");

  // Reassessment without the required construct cannot conquer.
  const noConstruct = recordReassessmentAttempt(afterPass.state, {
    misconceptionId: locked.id,
    graded: graded([]),
    constructOk: false,
    at: 70000,
  });
  assert.equal(noConstruct.outcome.conquered, null, "hardcode guard holds");
  assert.equal(noConstruct.state.misconceptions[0].status, "locked");

  // A real reassessment pass after the lock conquers and celebrates once.
  const { state: next, outcome } = recordReassessmentAttempt(afterPass.state, {
    misconceptionId: locked.id,
    graded: graded([]),
    constructOk: true,
    at: 80000,
  });
  assert.ok(outcome.conquered, "reassessment pass conquers");
  assert.equal(outcome.conquered.reassessed, true);
  assert.equal(outcome.conquered.failuresToConquer, 2);
  assert.equal(outcome.conquered.timeToConquerMs, 79000);
  const pending = pendingCelebration(next);
  assert.ok(pending, "celebration queued");
  const celebrated = markCelebrated(next, pending.id);
  assert.equal(pendingCelebration(celebrated), null, "celebration shows once");
});

test("a single slip pass clears without a celebration", () => {
  let state = emptyStruggleState;
  state = recordPracticeAttempt(state, { ...baseInput, graded: graded(["edge case: n = 1"]), at: 1000 }).state;
  const { state: next, outcome } = recordPracticeAttempt(state, { ...baseInput, graded: graded([]), at: 2000 });
  assert.equal(outcome.conquered, null, "watching entries close quietly");
  assert.equal(next.misconceptions[0].status, "conquered");
  assert.equal(pendingCelebration(next), null);
});

test("different failing tests are different struggles", () => {
  let state = emptyStruggleState;
  state = recordPracticeAttempt(state, { ...baseInput, graded: graded(["edge case: n = 1"]), at: 1000 }).state;
  const r = recordPracticeAttempt(state, { ...baseInput, graded: graded(["basic sum"]), at: 2000 });
  assert.equal(r.outcome.locked, null);
  assert.equal(r.state.misconceptions.length, 2);
});

test("struggle DNA and metrics come only from recorded attempts", () => {
  let state = emptyStruggleState;
  state = recordPracticeAttempt(state, { ...baseInput, graded: graded(["edge case: n = 1"]), at: 1000 }).state;
  state = recordPracticeAttempt(state, { ...baseInput, graded: graded(["edge case: n = 1"]), at: 2000 }).state;
  state = recordReassessmentAttempt(state, {
    misconceptionId: state.misconceptions[0].id,
    graded: graded([]),
    constructOk: true,
    at: 3600000,
  }).state;
  const topics = struggleByTopic(state);
  assert.equal(topics.length, 1);
  assert.equal(topics[0].fails, 2);
  assert.equal(topics[0].passes, 1);
  assert.equal(topics[0].conquered, 1);
  assert.equal(topics[0].topKind, "edge_case");
  const m = struggleMetrics(state);
  assert.equal(m.totalAttempts, 3);
  assert.equal(m.conqueredCount, 1);
  assert.equal(m.conquerRate, 1);
  assert.equal(m.avgTimeToConquerMs, 3599000);
  const pats = strugglePatterns(state);
  assert.ok(pats.some((p) => p.includes("edge case")), "patterns name the observed kind");
});

test("failure replay quotes only recorded data and honest elapsed time", () => {
  let state = emptyStruggleState;
  state = recordPracticeAttempt(state, { ...baseInput, graded: graded(["edge case: n = 1"]), at: 1000 }).state;
  state = recordPracticeAttempt(state, { ...baseInput, graded: graded(["edge case: n = 1"]), at: 2000 }).state;
  const { outcome } = recordReassessmentAttempt(state, {
    misconceptionId: state.misconceptions[0].id,
    graded: graded([]),
    constructOk: true,
    at: 62000,
  });
  const replay = failureReplay(outcome.conquered);
  assert.ok(replay.before.includes("edge case: n = 1"));
  assert.ok(replay.cause.includes("Recorded failing in 2 graded submissions"));
  assert.ok(replay.after.includes("targeted reassessment"));
  assert.ok(replay.after.includes("Elapsed time"));
});

test("variant inputs are deterministic and actually change the numbers", () => {
  assert.equal(variantStdin("21\n"), "45\n");
  assert.equal(variantStdin("-3\n"), "-7\n");
  assert.equal(variantStdin("21\n"), variantStdin("21\n"), "deterministic");
  assert.equal(variantStdin(""), "", "no numbers, no change");
});

test("construct check blocks hardcoded output and accepts the real construct", () => {
  const loop = { regex: "\\b(for|while)\\b" };
  assert.equal(constructSatisfied(loop, "for i in range(1, 6):\n    print(i)"), true);
  assert.equal(constructSatisfied(loop, 'print("1\\n2\\n3\\n4\\n5")'), false);
  assert.equal(constructSatisfied(null, "anything"), true);
  const rec = { selfCall: true };
  assert.equal(
    constructSatisfied(rec, "def factorial(n):\n    if n <= 1:\n        return 1\n    return n * factorial(n - 1)\nprint(factorial(5))"),
    true,
  );
  assert.equal(constructSatisfied(rec, "print(120)"), false);
});

test("reassessment plan keeps original checks, adds unseen and fresh variants", () => {
  let state = emptyStruggleState;
  state = recordPracticeAttempt(state, { ...baseInput, graded: graded(["edge case: n = 1"]), at: 1000 }).state;
  state = recordPracticeAttempt(state, { ...baseInput, graded: graded(["edge case: n = 1"]), at: 2000 }).state;
  const m = state.misconceptions[0];
  const plan = buildReassessmentPlan(m, [
    { name: "basic sum", stdin: "5\n", expected: "15" },
    { name: "edge case: n = 1", stdin: "1\n", expected: "1" },
    { name: "hidden twist", stdin: "9\n", expected: "45", hidden: true },
  ], true);
  assert.equal(plan.ready.length, 2, "original failing check + unseen hidden check");
  assert.ok(plan.ready.some((t) => t.unseen));
  assert.equal(plan.pending.length, 1, "one fresh variant for the failing stdin check");
  assert.equal(plan.pending[0].stdin, variantStdin("1\n"));
  const saved = attachReassessment(state, m.id, {
    tests: [...plan.ready, ...plan.pending.map((v) => ({ ...v, expected: "x" }))],
    createdAt: 3000,
    attempts: 0,
  });
  assert.equal(saved.misconceptions[0].reassessment.tests.length, 3);
});

test("VS Code build sessions feed the engine once per session signature", () => {
  const session = (key, status, passed, total, at) => ({
    sessionKey: key,
    topicId: "m1",
    topicTitle: "Python Setup",
    language: "python",
    exerciseTitle: "Build a CLI",
    completed: status === "completed",
    failed: status === "failed",
    passed,
    total,
    at,
  });
  let state = emptyStruggleState;
  // A failing session records a real attempt; the same signature is deduped.
  let r = recordBuildSessionOutcome(state, session("s1:failed:1:0:0", "failed", 1, 5, 1000));
  assert.ok(r.outcome, "first ingestion records");
  assert.equal(r.state.attempts.length, 1);
  state = r.state;
  r = recordBuildSessionOutcome(state, session("s1:failed:1:0:0", "failed", 1, 5, 2000));
  assert.equal(r.outcome, null, "same signature deduped");
  assert.equal(r.state.attempts.length, 1, "no double counting");
  // A second distinct failing session locks the pattern.
  r = recordBuildSessionOutcome(state, session("s1:failed:2:0:0", "failed", 1, 5, 3000));
  state = r.state;
  const locked = state.misconceptions.find((m) => m.status === "locked");
  assert.ok(locked, "repeated VS Code failure locks");
  assert.equal(locked.topicId, "m1");
  // A completed follow-up session after the lock conquers it.
  r = recordBuildSessionOutcome(state, {
    ...session("s2:completed:1:5:0", "completed", 5, 5, 90000),
    topicId: "m1-recovery",
    baseTopicId: "m1",
  });
  state = r.state;
  const done = state.misconceptions.find((m) => m.id === locked.id);
  assert.equal(done.status, "conquered", "later completed challenge conquers");
  assert.equal(done.reassessed, true);
  assert.ok(pendingCelebration(state) === null || pendingCelebration(state).id === done.id);
});
