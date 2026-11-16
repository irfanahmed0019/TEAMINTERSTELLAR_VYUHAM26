import test from "node:test";
import assert from "node:assert/strict";
import {
  PRACTICE_TASKS,
  practiceTaskBody,
  suggestedPracticeId,
  nextPracticeTaskId,
} from "./practice-task.ts";
test("four finite tasks keep short simple questions, owner-independent catalog and exact evaluator constants", () => {
  assert.equal(PRACTICE_TASKS.length, 12);
  for (const t of PRACTICE_TASKS) {
    const body = practiceTaskBody(t.id);
    assert.equal(body.language, "Python");
    assert.equal(body.instructions.split("\n").length, 2);
    assert.ok(body.instructions.length < 180);
    assert.equal(body.checkpoints[0].evaluator.command, "buildmylogic:" + t.id);
    assert.deepEqual(body.checkpoints[0].evaluator.expectedOutputIncludes, [
      "BML_PRACTICE_PASS:" + t.id,
    ]);
    assert.ok(!("user_id" in body));
  }
});
test("unsupported practice IDs fail closed, no invented language or task", () => {
  for (const bad of [
    null,
    undefined,
    "python-arbitrary",
    "rust-loops-v1",
    {},
    "__proto__",
    "buildmylogic:python-loops-fibonacci-v1",
  ])
    assert.equal(practiceTaskBody(bad), null);
});
test("stated weakness guides a suggestion only within authored topics", () => {
  for (const [text, id] of [
    ["I am weak in loops", "python-loops-fibonacci-v1"],
    ["conditions confuse me", "python-conditions-sign-v1"],
    ["need help with function return", "python-functions-double-v1"],
    ["strings and vowels", "python-strings-vowels-v1"],
  ])
    assert.equal(suggestedPracticeId(text), id);
  assert.equal(suggestedPracticeId("I use Rust and need a database"), null);
});

test("same-topic next question avoids repeats until all variants tried, then least recent returns", () => {
  for (const concept of ["loops", "conditions", "functions", "strings"]) {
    const seen = [];
    for (let n = 0; n < 3; n++) {
      const id = nextPracticeTaskId(concept, seen);
      assert.ok(id);
      assert.ok(!seen.includes(id));
      seen.push(id);
    }
    assert.equal(nextPracticeTaskId(concept, seen), seen[0]);
  }
  assert.equal(nextPracticeTaskId("unknown", []), null);
});
