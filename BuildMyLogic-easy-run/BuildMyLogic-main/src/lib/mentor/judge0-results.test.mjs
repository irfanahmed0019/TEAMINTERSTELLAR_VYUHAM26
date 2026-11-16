import test from "node:test";
import assert from "node:assert/strict";
import { validateJudge0Results } from "./judge0-results.ts";
const row = (token, id) => ({
  token,
  status: { id, description: "transport fixture" },
});
test("actual execution statuses accepted and learner compile/runtime/time-limit results preserved", () => {
  for (let id = 3; id <= 12; id++)
    assert.doesNotThrow(() => validateJudge0Results(["a"], [row("a", id)]));
});
test("Judge0 infrastructure/exec-format/unknown states cannot become learner grades", () => {
  for (const id of [0, 1, 2, 13, 14, 15, -1, NaN, 3.5])
    assert.throws(
      () => validateJudge0Results(["a"], [row("a", id)]),
      /not graded/,
    );
  assert.throws(
    () => validateJudge0Results(["a"], [{ token: "a" }]),
    /not graded/,
  );
});
test("all returned results must bind exactly once to requested job tokens regardless of order", () => {
  assert.doesNotThrow(() =>
    validateJudge0Results(["a", "b"], [row("b", 3), row("a", 6)]),
  );
  for (const rows of [
    [row("a", 3)],
    [row("a", 3), row("a", 3)],
    [row("a", 3), row("foreign", 3)],
  ])
    assert.throws(() => validateJudge0Results(["a", "b"], rows), /not graded/);
});
