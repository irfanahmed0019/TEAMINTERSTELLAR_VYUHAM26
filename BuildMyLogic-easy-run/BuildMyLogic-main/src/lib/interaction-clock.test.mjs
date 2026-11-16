import test from "node:test";
import assert from "node:assert/strict";
import {
  newInteractionClock,
  startInteractionClock,
  sampleInteractionClock,
  interactClock,
  pauseInteractionClock,
} from "./interaction-clock.ts";
import { performanceSummary } from "./performance-evidence.ts";
test("opt-in only; 30-second idle cap; new edit resumes without adding idle gap", () => {
  let c = newInteractionClock();
  c = interactClock(c, 100, true);
  c = sampleInteractionClock(c, 10000, true);
  assert.equal(c.activeMs, 0);
  c = startInteractionClock(c, 10000);
  c = sampleInteractionClock(c, 80000, true);
  assert.equal(c.activeMs, 30000);
  c = interactClock(c, 90000, true);
  c = sampleInteractionClock(c, 95000, true);
  assert.equal(c.activeMs, 35000);
});
test("blur/hidden, explicit pause and runner wait receive no credit; reload resumes paused", () => {
  let c = startInteractionClock(newInteractionClock(), 0);
  c = sampleInteractionClock(c, 5000, true);
  assert.equal(c.activeMs, 5000);
  c = { ...sampleInteractionClock(c, 6000, false), activityAt: null };
  c = sampleInteractionClock(c, 80000, false);
  assert.equal(c.activeMs, 5000);
  c = interactClock(c, 90000, true);
  c = sampleInteractionClock(c, 92000, true);
  assert.equal(c.activeMs, 7000);
  c = pauseInteractionClock(c, 93000, true);
  c = sampleInteractionClock(c, 200000, true);
  assert.equal(c.activeMs, 8000);
  c = newInteractionClock(c.activeMs);
  assert.equal(c.running, false);
  c = sampleInteractionClock(c, 300000, true);
  assert.equal(c.activeMs, 8000);
});
test("clock samples do not double count and reject nonfinite time", () => {
  let c = startInteractionClock(newInteractionClock(), 0);
  c = sampleInteractionClock(c, 1000, true);
  c = sampleInteractionClock(c, 1000, true);
  assert.equal(c.activeMs, 1000);
  assert.equal(sampleInteractionClock(c, NaN, true), c);
  assert.equal(newInteractionClock(Infinity).activeMs, 0);
});
test("browser timing distinguishes correct/slow/hints/wrong but is visibly client-reported not mastery", () => {
  const make = (passed, activeMs, hintsUsed = 0) =>
    performanceSummary({
      passed,
      total: 1,
      performance: {
        expectedMs: 300000,
        activeMs,
        hintsUsed,
        timingQuality: "browser-interaction-observed",
      },
    });
  assert.equal(make(1, 180000).ratio, 0.6);
  assert.equal(make(1, 480000).ratio, 1.6);
  assert.match(make(1, 480000).text, /not automatically weak/);
  assert.match(make(1, 480000).text, /Browser-reported interaction windows/);
  assert.match(make(1, 480000, 1).text, /recorded hints/);
  assert.match(make(0, 50000).text, /failing tests/);
});
