import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  hasTargetJob,
  projectStack,
  targetJobBrief,
  targetProject,
  EXPLORING_JOB,
} from "./target-job.ts";
import { curatedPlan, curatedProjects } from "./curated-fallback.ts";
const legacy = {
  name: "QA",
  goal: "Learn",
  goalDetail: "",
  experience: "First time building",
  technologies: [{ name: "C", level: "beginner" }],
  followUps: [],
  projectIdea: "C calculator",
  startTime: "",
  endTime: "",
  scheduleUnspecified: true,
  repeatDaily: false,
};
test("C resume is a starting point, not the target job or future project stack", () => {
  const profile = {
    ...legacy,
    targetJob: "Backend developer",
    learningStack: "Python, SQLite",
  };
  const before = JSON.stringify(profile);
  assert.equal(projectStack(profile), "Python, SQLite");
  const options = curatedProjects(profile);
  assert.equal(options[0].title, "Job Application API");
  assert.equal(options[0].stack, "Python, SQLite");
  const plan = curatedPlan(profile);
  assert.equal(plan.projectTitle, "Job Application API");
  assert.ok(plan.missions.every((m) => m.stack === "Python, SQLite"));
  assert.equal(JSON.stringify(profile), before);
  assert.equal(profile.technologies[0].name, "C");
});
test("explicit frontend/data/QA/system roles produce different relevant projects", () => {
  for (const [role, stack, title] of [
    [
      "Frontend developer",
      "HTML, CSS, JavaScript",
      "Accessible Job Application Tracker",
    ],
    ["Data analyst", "Python, SQL", "Job Listings Data Report"],
    ["QA / test engineer", "Python, pytest", "Form Validation Test Suite"],
    ["Embedded / systems developer", "C", "Simulated Sensor Alert Monitor"],
  ]) {
    const p = { ...legacy, targetJob: role, learningStack: stack };
    assert.equal(curatedPlan(p).projectTitle, title);
    assert.equal(curatedProjects(p)[0].stack, stack);
  }
});
test("no target inferred for legacy saved users, existing C curriculum still available", () => {
  assert.equal(hasTargetJob(legacy), false);
  assert.equal(projectStack(legacy), "C");
  assert.match(targetJobBrief(legacy), /not chosen/);
  assert.equal(curatedPlan(legacy).projectTitle, "Mini Calculator in C");
});
test("custom role requires explicit learning tools; exploring is a valid answer", () => {
  assert.equal(
    hasTargetJob({ targetJob: "Other job", learningStack: "Python" }),
    false,
  );
  assert.equal(
    hasTargetJob({ targetJob: "Mobile developer", learningStack: "" }),
    false,
  );
  const p = {
    ...legacy,
    targetJob: "Mobile developer",
    learningStack: "Kotlin",
  };
  assert.equal(hasTargetJob(p), true);
  assert.match(targetProject(p), /Mobile developer/);
  assert.ok(curatedPlan(p).missions.every((m) => m.stack === "Kotlin"));
  assert.equal(hasTargetJob({ targetJob: EXPLORING_JOB }), true);
  assert.equal(
    projectStack({ ...legacy, targetJob: EXPLORING_JOB }),
    "tools to be chosen with the learner",
  );
});
test("role prompt describes future tools and separates unverified claims", () => {
  const p = {
    ...legacy,
    targetJob: "Backend developer",
    learningStack: "Python",
  };
  assert.match(targetJobBrief(p), /NOT existing ability/);
  assert.match(targetJobBrief(p), /beginner bridge steps/);
  const ai = readFileSync(
    new URL("./sarvam.functions.ts", import.meta.url),
    "utf8",
  );
  assert.match(ai, /targetJobBrief\(profile\)/);
  assert.match(ai, /return projectStack\(profile\)/);
  assert.match(ai, /targetProject\(profile\) \|\| profile.projectIdea/);
});
