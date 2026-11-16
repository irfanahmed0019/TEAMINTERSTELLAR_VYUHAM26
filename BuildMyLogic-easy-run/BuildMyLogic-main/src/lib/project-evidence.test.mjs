import test from "node:test";
import assert from "node:assert/strict";
import {
  ingestProjectEvidence,
  isSupportedProjectEvidence,
} from "./project-evidence.ts";
const prev = {
  plan: {
    skills: [{ name: "React", level: 90 }],
    missions: [{ id: "original" }],
  },
  missionProgress: { original: { status: "active" } },
  struggle: {
    attempts: [],
    misconceptions: [],
    ingestedSessions: [],
    celebratedIds: [],
  },
  activity: [],
};
const id = "python-decimal-contract:0123456789abcdef";
const remote = {
  session_id: "s",
  challenge_id: id,
  verified_owner_id: "123e4567-e89b-42d3-a456-426614174000",
  language: "Python",
  title: "parse.py:parse",
  concept: "input validation",
  expected_skills: ["Python", "input validation", "edge cases"],
  evidence_provenance: "extension-reported",
  project_context: {
    inspected_files: ["parse.py"],
    summary:
      "Source digest 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef.",
  },
  attempts: 1,
  hints_used: 0,
  status: "completed",
  test_score: { passed: 1, total: 1 },
  checkpoints: [
    {
      title: "Input validation",
      status: "passed",
      evaluator: {
        id,
        command: "buildmylogic:python-decimal-contract",
        expectedOutputIncludes: ["BML_DECIMAL_CONTRACT_14_PASS"],
      },
    },
  ],
};
test("dedicated project result records only narrow assessed concept, not original mission or broad declared stack", () => {
  const next = ingestProjectEvidence(prev, remote);
  assert.equal(next.plan, prev.plan);
  assert.equal(next.missionProgress, prev.missionProgress);
  assert.equal(next.struggle.attempts.length, 1);
  assert.equal(next.struggle.attempts[0].topicTitle, "Python input validation");
  assert.equal(ingestProjectEvidence(next, remote), next);
});
test("unknown/unowned/undeclared project results cannot be promoted", () => {
  for (const r of [
    { ...remote, challenge_id: "arbitrary" },
    { ...remote, verified_owner_id: undefined },
    { ...remote, checkpoints: [] },
    {
      ...remote,
      project_context: {
        ...remote.project_context,
        summary:
          "Source digest ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff.",
      },
    },
    { ...remote, project_context: { inspected_files: ["../secret.py"] } },
  ]) {
    assert.equal(isSupportedProjectEvidence(r), false);
    assert.equal(ingestProjectEvidence(prev, r), prev);
  }
});

test("invalid finite scores are not ingested", () => {
  assert.equal(
    ingestProjectEvidence(prev, {
      ...remote,
      test_score: { passed: 2, total: 1 },
    }),
    prev,
  );
});
