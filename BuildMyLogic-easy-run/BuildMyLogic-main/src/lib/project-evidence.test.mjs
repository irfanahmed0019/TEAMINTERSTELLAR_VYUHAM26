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

test("repeated source-task failures map to exact Learn topic and owner-scoped recovery, not broad Python", async () => {
  const { priorityLearningTopics } = await import("./adaptive-learning.ts");
  const { diagnosticProbe, newReassessment } =
    await import("./struggle-engine.ts");
  let state = prev;
  for (let attempt = 1; attempt <= 3; attempt++)
    state = ingestProjectEvidence(state, {
      ...remote,
      attempts: attempt,
      test_score: { passed: 0, total: 1 },
      checkpoints: [
        {
          ...remote.checkpoints[0],
          title: "Validate parse input contract",
          status: "failed",
        },
      ],
    });
  const m = state.struggle.misconceptions[0];
  assert.equal(m.status, "locked");
  assert.equal(m.transferTopicId, "input-validation");
  assert.equal(m.language, "python");
  assert.equal(m.recoveryOwnerId, remote.verified_owner_id);
  assert.equal(priorityLearningTopics(state).has("input-validation"), true);
  assert.equal(priorityLearningTopics(state).has("Python"), false);
  assert.ok(diagnosticProbe(m.transferTopicId, m.language));
  const a = newReassessment(m.transferTopicId, m.language, 10000);
  const b = newReassessment(m.transferTopicId, m.language, 10000, true);
  assert.notEqual(a.task, b.task);
  assert.notDeepEqual(a.tests, b.tests);
});

test("executed fresh diagnostic transfer can create only matching owner/source challenge receipt", async () => {
  const {
    recordDiagnosticPrediction,
    newReassessment,
    attachReassessment,
    recordReassessmentAttempt,
  } = await import("./struggle-engine.ts");
  const { savedConquestReceipt } = await import("./shared-conquest.ts");
  const { spawnSync } = await import("node:child_process");
  const { readFileSync } = await import("node:fs");
  let state = prev;
  for (let attempt = 1; attempt <= 3; attempt++)
    state = ingestProjectEvidence(state, {
      ...remote,
      attempts: attempt,
      test_score: { passed: 0, total: 1 },
      checkpoints: [
        {
          ...remote.checkpoints[0],
          title: "Validate parse input contract",
          status: "failed",
        },
      ],
    });
  let s = state.struggle;
  const m = s.misconceptions[0],
    at = m.lockedAt + 100;
  assert.equal(m.sourceMissionId, remote.challenge_id);
  s = recordDiagnosticPrediction(s, m.id, 0, true, at);
  const task = newReassessment("input-validation", "python", at + 100, true);
  s = attachReassessment(s, m.id, task);
  const ref = JSON.parse(
    readFileSync(
      new URL("./diagnostic-reference.json", import.meta.url),
      "utf8",
    ),
  )["input-validation"].python;
  const graded = task.tests.map((t) => {
    const r = spawnSync("python3", ["-c", ref], {
      input: t.stdin,
      encoding: "utf8",
      timeout: 3000,
    });
    assert.equal(r.status, 0, r.stderr);
    return {
      name: t.name,
      expected: t.expected,
      actual: r.stdout.trim(),
      passed: r.stdout.trim() === t.expected,
      hidden: false,
      status: "Accepted",
      stderr: r.stderr,
    };
  });
  const input = {
    misconceptionId: m.id,
    ownerId: remote.verified_owner_id,
    at: at + 200,
    constructOk: true,
    graded,
  };
  assert.equal(
    recordReassessmentAttempt(s, { ...input, ownerId: "other" }).outcome,
    null,
  );
  s = recordReassessmentAttempt(s, input).state;
  assert.equal(s.misconceptions[0].status, "conquered");
  const session = {
    sessionId: remote.session_id,
    userId: remote.verified_owner_id,
    challengeId: remote.challenge_id,
  };
  assert.ok(savedConquestReceipt(s, m.id, session));
  assert.equal(
    savedConquestReceipt(s, m.id, { ...session, challengeId: "original" }),
    null,
  );
});

test("0.3.8 pinned existing-test decimal results enter narrow evidence; malformed metadata stays blocked", () => {
  const digest = "a".repeat(64);
  const pinned = {
    ...remote,
    project_context: {
      ...remote.project_context,
      test_path: "tests/test_parse.py",
      test_digest: digest,
      test_cases: 3,
      baseline_failures: 1,
    },
    checkpoints: [
      {
        ...remote.checkpoints[0],
        evaluator: {
          ...remote.checkpoints[0].evaluator,
          expectedOutputIncludes: [
            "BML_DECIMAL_CONTRACT_14_PASS",
            "BML_PINNED_TEST_" + digest,
          ],
        },
      },
    ],
  };
  assert.equal(isSupportedProjectEvidence(pinned), true);
  assert.equal(ingestProjectEvidence(prev, pinned).struggle.attempts.length, 1);
  for (const context of [
    { ...pinned.project_context, test_path: "../escape.py" },
    { ...pinned.project_context, test_digest: "b".repeat(64) },
    { ...pinned.project_context, test_cases: 0 },
    { ...pinned.project_context, baseline_failures: 0 },
    { ...pinned.project_context, baseline_failures: 4 },
  ])
    assert.equal(
      isSupportedProjectEvidence({ ...pinned, project_context: context }),
      false,
    );
  assert.equal(
    isSupportedProjectEvidence({ ...pinned, checkpoints: remote.checkpoints }),
    false,
  );
  assert.equal(isSupportedProjectEvidence(remote), true);
});

test("utility-test repair has distinct finite provenance and never maps to decimal mastery or original mission", () => {
  const digest = "a".repeat(64),
    source = "b".repeat(64),
    cases = "c".repeat(64),
    id = "python-literal-repair:" + "d".repeat(24);
  const utility = {
    ...remote,
    challenge_id: id,
    concept: "project test repair",
    expected_skills: ["Python", "project test repair"],
    project_context: {
      ...remote.project_context,
      test_path: "tests/test_price.py",
      test_digest: digest,
      test_cases: 3,
      baseline_failures: 1,
      summary: `Source digest ${source}.`,
      repair_contract: {
        version: 1,
        function_name: "discount",
        arguments: ["price", "percent"],
        cases_digest: cases,
        source_digest: source,
      },
    },
    checkpoints: [
      {
        title: "Declared project cases",
        status: "passed",
        evaluator: {
          id,
          command: "buildmylogic:python-literal-repair-v1",
          expectedOutputIncludes: [
            "BML_LITERAL_REPAIR_V1_PASS",
            "BML_PINNED_TEST_" + digest,
          ],
        },
      },
    ],
  };
  assert.equal(isSupportedProjectEvidence(utility), true);
  const next = ingestProjectEvidence(prev, utility);
  assert.equal(next.plan, prev.plan);
  assert.equal(next.missionProgress, prev.missionProgress);
  assert.equal(
    next.struggle.attempts[0].topicTitle,
    "Python project test repair",
  );
  assert.match(
    next.struggle.attempts[0].topicId,
    /^project-test-repair:owner:/,
  );
  assert.equal(ingestProjectEvidence(next, utility), next);
  for (const patch of [
    { expected_skills: ["Python", "input validation"] },
    { concept: "input validation" },
    { challenge_id: "python-literal-repair:bad" },
    {
      project_context: {
        ...utility.project_context,
        repair_contract: {
          ...utility.project_context.repair_contract,
          source_digest: "e".repeat(64),
        },
      },
    },
    {
      project_context: {
        ...utility.project_context,
        repair_contract: {
          ...utility.project_context.repair_contract,
          arguments: [],
        },
      },
    },
    {
      project_context: {
        ...utility.project_context,
        repair_contract: {
          ...utility.project_context.repair_contract,
          arguments: undefined,
        },
      },
    },
    { project_context: { ...utility.project_context, test_cases: 1 } },
    { project_context: { ...utility.project_context, baseline_failures: 0 } },
    {
      project_context: { ...utility.project_context, test_path: "../other.py" },
    },
    {
      checkpoints: [
        {
          ...utility.checkpoints[0],
          evaluator: {
            ...utility.checkpoints[0].evaluator,
            expectedOutputIncludes: [
              "BML_DECIMAL_CONTRACT_14_PASS",
              "BML_PINNED_TEST_" + digest,
            ],
          },
        },
      ],
    },
  ])
    assert.equal(isSupportedProjectEvidence({ ...utility, ...patch }), false);
  let failures = prev;
  for (let i = 1; i <= 2; i++)
    failures = ingestProjectEvidence(failures, {
      ...utility,
      attempts: i,
      test_score: { passed: 0, total: 1 },
      checkpoints: utility.checkpoints.map((c) => ({
        ...c,
        status: "failed",
        lastOutput: "Declared cases did not all match",
      })),
    });
  assert.ok(failures.struggle.misconceptions.length);
  assert.equal(failures.struggle.misconceptions[0].transferTopicId, undefined);
  assert.notEqual(
    failures.struggle.misconceptions[0].topicId,
    "input-validation",
  );
  assert.notEqual(failures.struggle.misconceptions[0].status, "conquered");
});
