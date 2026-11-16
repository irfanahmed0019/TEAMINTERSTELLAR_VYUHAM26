import test from "node:test";
import assert from "node:assert/strict";
import { performanceSummary } from "./performance-evidence.ts";
const attempt = (passed, active, hints = 0) => ({
  passed,
  total: 1,
  performance: {
    expectedMs: 300000,
    activeMs: active,
    timingQuality: "extension-observed",
    hintsUsed: hints,
  },
});
test("fast correct, slow correct, hinted correct and fast incorrect remain distinct", () => {
  const fast = performanceSummary(attempt(1, 180000));
  const slow = performanceSummary(attempt(1, 480000));
  const hinted = performanceSummary(attempt(1, 480000, 3));
  const wrong = performanceSummary(attempt(0, 120000));
  assert.equal(fast.ratio, 0.6);
  assert.equal(slow.ratio, 1.6);
  assert.equal(slow.correct, true);
  assert.match(slow.text, /not automatically weak/);
  assert.equal(hinted.hinted, true);
  assert.match(hinted.text, /recorded hints/);
  assert.equal(wrong.correct, false);
  assert.match(wrong.text, /failing tests/);
});
test("missing/invalid timing is not precise active time", () => {
  assert.equal(performanceSummary({ passed: 1, total: 1 }).ratio, null);
  assert.equal(
    performanceSummary({
      ...attempt(1, 100),
      performance: {
        ...attempt(1, 100).performance,
        timingQuality: "unavailable",
      },
    }).ratio,
    null,
  );
  assert.equal(performanceSummary(attempt(1, -3)).ratio, null);
});
