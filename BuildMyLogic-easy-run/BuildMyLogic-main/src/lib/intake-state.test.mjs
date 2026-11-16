import test from "node:test";
import assert from "node:assert/strict";
import {
  restoreIntake,
  saveIntakeAnswers,
  intakePrompts,
  diagnosticContinueLabel,
} from "./intake-state.ts";
const profile = {
  goalDetail: "",
  followUps: [],
  resumeClaims: { provenance: "resume_claims_unverified" },
};
test("partial intake resumes only exact saved questions", () => {
  const saved = saveIntakeAnswers(profile, ["Build Python", "Beginner"]);
  assert.deepEqual(restoreIntake(saved), {
    answers: ["Build Python", "Beginner"],
    stage: "chat",
  });
  assert.equal(saved.resumeClaims, profile.resumeClaims);
  assert.equal(profile.followUps.length, 0);
});
test("all replies restore diagnostic stage; legacy complete intake also resumes", () => {
  assert.equal(
    restoreIntake(
      saveIntakeAnswers(profile, ["Build Python", "Beginner", "2 hours"]),
    ).stage,
    "plan",
  );
  assert.equal(
    restoreIntake({
      ...profile,
      goalDetail: "Build",
      followUps: intakePrompts
        .slice(1)
        .map((question) => ({ question, answer: "yes" })),
    }).stage,
    "plan",
  );
  assert.equal(
    restoreIntake({ ...profile, resumeSummary: "Python expert" }).stage,
    "chat",
  );
});
test("unrelated followups preserved, updated intake replaces only matching answers", () => {
  const saved = saveIntakeAnswers(
    {
      ...profile,
      followUps: [
        { question: "Unrelated", answer: "kept" },
        { question: intakePrompts[0], answer: "old" },
      ],
    },
    ["new"],
  );
  assert.equal(saved.followUps.length, 2);
  assert.equal(saved.followUps[0].answer, "kept");
  assert.equal(restoreIntake(saved).answers[0], "new");
});
test("partial diagnostic copy does not call observed evidence unassessed", () => {
  assert.match(diagnosticContinueLabel(), /unassessed/);
  assert.match(
    diagnosticContinueLabel({ status: "in_progress", answers: [{}] }),
    /1 provisional/,
  );
  assert.match(
    diagnosticContinueLabel({ status: "completed", answers: [{}] }),
    /these checks/,
  );
});
