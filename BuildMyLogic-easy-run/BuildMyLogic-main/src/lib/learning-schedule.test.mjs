import test from "node:test";
import assert from "node:assert/strict";
import { learningSchedule } from "./learning-schedule.ts";
import { curatedPlan } from "./curated-fallback.ts";
const profile = {
  name: "QA",
  startTime: "",
  endTime: "",
  repeatDaily: false,
  scheduleUnspecified: true,
  availabilityText: "Four hours weekly, focus on Python conditions",
  technologies: [{ name: "Python", level: "beginner" }],
  goal: "Python",
  goalDetail: "Budget tracker",
  experience: "First time building",
  experienceDetail: "",
  resumeSummary: "",
  resumeText: "",
  followUps: [],
  projectIdea: "Budget tracker",
  challenge: "Guide me",
};
test("weekly reported availability is not promoted into daily fixed times or recurrence", () => {
  const s = learningSchedule(profile);
  assert.equal(s.exact, false);
  assert.match(s.brief, /Four hours weekly/);
  assert.match(s.brief, /No exact daily/);
  assert.match(s.banner, /No daily window is set/);
  assert.equal(s.next, "Time not scheduled");
  assert.doesNotMatch(s.brief + s.banner, /19:00|21:00|every day/);
  const plan = curatedPlan(profile);
  assert.equal(plan.session.totalMinutes, 30);
  assert.doesNotMatch(plan.progress.weeklyGoal, /every day/i);
});
test("existing valid exact windows stay preferences, never imply calendar booking", () => {
  const s = learningSchedule({
    ...profile,
    scheduleUnspecified: false,
    startTime: "18:30",
    endTime: "19:30",
    repeatDaily: true,
  });
  assert.equal(s.exact, true);
  assert.match(s.brief, /18:30-19:30/);
  assert.match(s.brief, /No calendar booking/);
  assert.match(s.next, /date not scheduled/);
  assert.equal(
    learningSchedule({
      ...profile,
      scheduleUnspecified: false,
      startTime: "99:99",
      endTime: "19:30",
    }).exact,
    false,
  );
});
