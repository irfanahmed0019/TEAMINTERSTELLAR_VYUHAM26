/**
 * Deterministic coverage for the Struggle Engine:
 * real graded attempts → signatures → locks → targeted challenges → conquer.
 * No recorded attempt, no evidence: passes on a fresh state change nothing.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyFailure,
  emptyStruggleState,
  failureReplay,
  failureSignature,
  markCelebrated,
  pendingCelebration,
  recordPracticeAttempt,
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

test("a full pass conquers the locked misconception and queues one celebration", () => {
  let state = emptyStruggleState;
  state = recordPracticeAttempt(state, { ...baseInput, graded: graded(["edge case: n = 1"]), at: 1000 }).state;
  state = recordPracticeAttempt(state, { ...baseInput, graded: graded(["edge case: n = 1"]), at: 2000 }).state;
  const { state: next, outcome } = recordPracticeAttempt(state, { ...baseInput, graded: graded([]), at: 60000 });
  assert.ok(outcome.conquered, "full pass conquers");
  assert.equal(outcome.conquered.failuresToConquer, 2);
  assert.equal(outcome.conquered.timeToConquerMs, 59000);
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
  state = recordPracticeAttempt(state, { ...baseInput, graded: graded([]), at: 3600000 }).state;
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

test("failure replay quotes only recorded data", () => {
  let state = emptyStruggleState;
  state = recordPracticeAttempt(state, { ...baseInput, graded: graded(["edge case: n = 1"]), at: 1000 }).state;
  state = recordPracticeAttempt(state, { ...baseInput, graded: graded(["edge case: n = 1"]), at: 2000 }).state;
  const { outcome } = recordPracticeAttempt(state, { ...baseInput, graded: graded([]), at: 62000 });
  const replay = failureReplay(outcome.conquered);
  assert.ok(replay.before.includes("edge case: n = 1"));
  assert.ok(replay.cause.includes("2 times"));
  assert.ok(replay.after.includes("every check"));
});
