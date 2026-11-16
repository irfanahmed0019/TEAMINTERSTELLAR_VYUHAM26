import test from "node:test";
import assert from "node:assert/strict";
import { learningStreak } from "./learning-streak.ts";
const at = (s) => Date.parse(s);
const now = at("2026-11-17T02:00:00+05:30");
const b = () => ({
  sessions: [],
  activity: [],
  struggle: { attempts: [], misconceptions: [] },
});
const a = (time, extra = {}) => ({
  id: "a",
  at: at(time),
  total: 4,
  passed: 0,
  ...extra,
});
test("checked attempts count failed and passed, once per local day, without sessions or writes", () => {
  const s = b();
  s.struggle.attempts = [
    a("2026-11-17T01:40:00+05:30"),
    a("2026-11-17T01:50:00+05:30", { passed: 4 }),
  ];
  const before = JSON.stringify(s),
    r = learningStreak(s, now, "Asia/Kolkata");
  assert.equal(r.count, 1);
  assert.equal(r.activeToday, true);
  assert.equal(r.week.filter((x) => x.active).length, 1);
  assert.equal(JSON.stringify(s), before);
  assert.deepEqual(learningStreak(JSON.parse(before), now, "Asia/Kolkata"), r);
});
test("midnight local time, yesterday grace, gaps and year boundary do not invent days", () => {
  const s = b();
  s.struggle.attempts = [
    a("2026-11-16T23:59:00+05:30"),
    a("2026-11-15T23:59:00+05:30"),
  ];
  assert.equal(learningStreak(s, now, "Asia/Kolkata").count, 2);
  assert.equal(learningStreak(s, now, "Asia/Kolkata").activeToday, false);
  s.struggle.attempts.push(a("2026-11-17T00:01:00+05:30"));
  assert.equal(learningStreak(s, now, "Asia/Kolkata").count, 3);
  assert.equal(
    learningStreak(s, at("2026-11-19T00:01:00+05:30"), "Asia/Kolkata").count,
    0,
  );
  const y = b();
  y.sessions = [
    { at: at("2025-12-31T20:00:00Z"), minutes: 1 },
    { at: at("2026-01-01T20:00:00Z"), minutes: 1 },
  ];
  assert.equal(learningStreak(y, at("2026-01-01T23:00:00Z"), "UTC").count, 2);
});
test("DST changes use calendar dates rather than 24 hour durations", () => {
  const s = b();
  s.struggle.attempts = [
    a("2026-03-07T12:00:00-05:00"),
    a("2026-03-08T12:00:00-04:00"),
    a("2026-03-09T12:00:00-04:00"),
  ];
  assert.equal(
    learningStreak(s, at("2026-03-09T13:00:00-04:00"), "America/New_York")
      .count,
    3,
  );
});
test("only recorded valid learning counts, no future/synthetic/visit/chat/timezero credit", () => {
  const s = b();
  s.sessions = [
    { at: now, minutes: 0 },
    { at: now, minutes: 5, synthetic: true },
  ];
  s.activity = [{ at: now, kind: "ai", text: "hello" }];
  s.struggle.attempts = [
    a("2026-11-17T02:10:00+05:30"),
    { at: now, total: 0, passed: 0 },
    { at: now, total: 1, passed: 2 },
    { at: now, total: 1, passed: 1, synthetic: true },
    { at: NaN, total: 1, passed: 1 },
  ];
  assert.equal(learningStreak(s, now, "Asia/Kolkata").count, 0);
  s.assessmentEvidence = [{ at: now, total: 3, passed: 1 }];
  assert.equal(learningStreak(s, now, "Asia/Kolkata").count, 1);
  s.assessmentEvidence = [];
  s.videoProgress = {
    x: { results: [{ at: now, section: 0, correct: false }] },
  };
  assert.equal(learningStreak(s, now, "Asia/Kolkata").count, 1);
  s.sampleProvenance = {};
  assert.equal(learningStreak(s, now, "Asia/Kolkata").count, 0);
});
