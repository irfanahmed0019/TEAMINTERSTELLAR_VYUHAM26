import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
// engine/curriculum imports use TS extensionless paths in the app; load isolated pure adapter fixture.
const source = fs
  .readFileSync(new URL("./assessment-evidence.ts", import.meta.url), "utf8")
  .replace(
    /import \{ LESSONS \} from ["']\.\/mentor\/curriculum["'];/,
    "const LESSONS=[{id:'l1',skill:'output'}];",
  );
const url = new URL("./.qa-assessment-adapter.ts", import.meta.url);
fs.writeFileSync(url, source);
const { mentorAssessmentEvidence } = await import(url.href);
fs.unlinkSync(url);
const state = {
  id: "server-session",
  verified: true,
  attempts: [
    {
      id: "one",
      mode: "submit",
      ts: "2026-11-16T10:00:00Z",
      lessonId: "l1",
      hintsUsed: 2,
      results: [{ passed: true }, { passed: false }],
    },
  ],
};
test("Mentor adapter imports only graded account submissions, preserving finite results and hints", () => {
  const a = mentorAssessmentEvidence(state, "owner");
  assert.equal(a.length, 1);
  assert.equal(a[0].passed, 1);
  assert.equal(a[0].total, 2);
  assert.equal(a[0].hintsUsed, 2);
  assert.equal(a[0].topicId, "first-program");
  assert.equal(a[0].ownerId, "owner");
});
test("Mentor device runs and missing identities never become server-graded evidence", () => {
  assert.deepEqual(
    mentorAssessmentEvidence({ ...state, verified: false }, "owner"),
    [],
  );
  assert.deepEqual(mentorAssessmentEvidence(state, ""), []);
  assert.deepEqual(
    mentorAssessmentEvidence(
      { ...state, attempts: [{ ...state.attempts[0], mode: "run" }] },
      "owner",
    ),
    [],
  );
});
