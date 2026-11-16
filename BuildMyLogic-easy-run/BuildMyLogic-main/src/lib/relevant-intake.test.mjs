import test from "node:test";
import assert from "node:assert/strict";
import {
  relevantIntakePrompt,
  saveIntakeAnswers,
  restoreIntake,
} from "./intake-state.ts";
test("new-user questions use explicit goal/role/topic, not guessed identity", () => {
  assert.match(relevantIntakePrompt(0, []), /background and goal/);
  assert.match(
    relevantIntakePrompt(1, ["Python for a job"], { intakeTopic: "Python" }),
    /Which role.*Python/,
  );
  assert.match(
    relevantIntakePrompt(1, ["learn React"], { intakeTopic: "React" }),
    /What have you tried with React/,
  );
  assert.match(
    relevantIntakePrompt(2, ["learn Java"], { intakeTopic: "Java" }),
    /Java task/,
  );
  assert.ok(!relevantIntakePrompt(1, ["exploring"]).includes("Python"));
});
test("canonical saved answer keys remain compatible for existing incomplete intake", () => {
  const p = { followUps: [], technologies: [], goalDetail: "" };
  const saved = saveIntakeAnswers(p, ["Python job", "new", "3h"]);
  assert.deepEqual(restoreIntake(saved).answers, ["Python job", "new", "3h"]);
  assert.equal(restoreIntake(saved).stage, "plan");
});

test("arbitrary learner-stated topics are preserved without a language allowlist", () => {
  for (const topic of [
    "C++",
    "Rust",
    "Kotlin",
    "Go",
    "Elixir",
    "Unlisted tool",
  ]) {
    assert.ok(
      relevantIntakePrompt(1, ["learn"], { intakeTopic: topic }).includes(
        topic,
      ),
    );
    assert.ok(
      relevantIntakePrompt(2, ["learn"], { intakeTopic: topic }).includes(
        topic,
      ),
    );
  }
  assert.ok(relevantIntakePrompt(1, ["learn Zig"]).includes("learn Zig"));
});
