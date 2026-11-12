import test from "node:test";
import assert from "node:assert/strict";
import { REVEAL_STAGES, REVEAL_TOTAL_MS, revealGreeting, visibleStages } from "./reveal-schedule.ts";

test("reveal stages are strictly ordered and start at zero", () => {
  assert.equal(REVEAL_STAGES[0].at, 0);
  for (let i = 1; i < REVEAL_STAGES.length; i += 1) {
    assert.ok(REVEAL_STAGES[i].at > REVEAL_STAGES[i - 1].at, `stage ${i} must come after stage ${i - 1}`);
  }
  for (const stage of REVEAL_STAGES) assert.ok(stage.caption.trim().length > 0, "every stage needs a caption");
});

test("reveal lasts about 12 seconds and outlasts the final stage", () => {
  const last = REVEAL_STAGES[REVEAL_STAGES.length - 1].at;
  assert.ok(REVEAL_TOTAL_MS > last, "the last section must be visible before the dashboard opens");
  assert.ok(REVEAL_TOTAL_MS >= 10000 && REVEAL_TOTAL_MS <= 13000, "total reveal should be about 12 seconds");
});

test("visibleStages advances monotonically with elapsed time", () => {
  assert.equal(visibleStages(0), 1);
  assert.equal(visibleStages(REVEAL_TOTAL_MS), REVEAL_STAGES.length);
  let previous = 0;
  for (let elapsed = 0; elapsed <= REVEAL_TOTAL_MS; elapsed += 100) {
    const count = visibleStages(elapsed);
    assert.ok(count >= previous, "stages never disappear once shown");
    previous = count;
  }
});

test("revealGreeting matches the dashboard greeting rule", () => {
  assert.equal(revealGreeting(new Date(2026, 0, 1, 8)), "Good morning");
  assert.equal(revealGreeting(new Date(2026, 0, 1, 13)), "Good afternoon");
  assert.equal(revealGreeting(new Date(2026, 0, 1, 20)), "Good evening");
});
