import test from "node:test";
import assert from "node:assert/strict";
import {
  ingestProjectEvidence,
  isLiteralRepairEvidence,
} from "./project-evidence.ts";
import {
  projectBinding,
  reviewProjectRecovery,
  validProjectReview,
  ingestProjectRechecks,
  projectRecoveryPattern,
} from "./project-recovery.ts";
const owner = "123e4567-e89b-42d3-a456-426614174000",
  h = "a".repeat(64),
  p = "b".repeat(64),
  id = "python-literal-repair:" + "c".repeat(24);
function fixture() {
  const remote = {
    session_id: "SESSION",
    challenge_id: id,
    verified_owner_id: owner,
    language: "Python",
    concept: "project test repair",
    title: "Repair f",
    expected_skills: ["Python", "project test repair"],
    evidence_provenance: "extension-reported",
    project_context: {
      inspected_files: ["price.py"],
      test_path: "test_price.py",
      test_digest: h,
      test_cases: 4,
      baseline_failures: 2,
      summary: `Source digest ${h}.`,
      repair_contract: {
        version: 1,
        function_name: "f",
        arguments: ["x"],
        cases_digest: h,
        source_digest: h,
        partition: {
          version: 1,
          initial_indices: [0, 1],
          recheck_indices: [2, 3],
          partition_digest: p,
          source_session_id: "SESSION",
        },
      },
    },
    status: "active",
    attempts: 1,
    test_score: { passed: 0, total: 1 },
    checkpoints: [
      {
        title: "Pass approved project cases for f",
        status: "failed",
        evaluator: {
          id,
          command: "buildmylogic:python-literal-repair-v1",
          expectedOutputIncludes: [
            "BML_LITERAL_REPAIR_V1_PASS",
            "BML_PINNED_TEST_" + h,
            "BML_PARTITION_" + p,
          ],
        },
      },
    ],
  };
  let state = {
    activity: [],
    plan: { skills: [{ name: "React", level: 80 }], missions: [] },
    missionProgress: { original: { status: "active" } },
    struggle: {
      attempts: [],
      misconceptions: [],
      ingestedSessions: [],
      celebratedIds: [],
    },
  };
  state = ingestProjectEvidence(state, remote);
  remote.attempts = 2;
  state = ingestProjectEvidence(state, remote);
  remote.attempts = 3;
  remote.status = "completed";
  remote.test_score = { passed: 1, total: 1 };
  remote.checkpoints[0].status = "passed";
  state = ingestProjectEvidence(state, remote);
  const binding = projectBinding(remote),
    pattern = projectRecoveryPattern(state, remote, owner),
    at = Date.now() + 100;
  state = {
    ...state,
    projectRecoveryReviews: {
      SESSION: {
        binding,
        pattern_id: pattern.id,
        prediction: 1,
        reviewed_at: at,
        lesson_version: "project-test-repair-v1",
      },
    },
  };
  remote.project_recheck_ready = { binding, at: at + 10 };
  remote.project_recheck_receipts = [
    {
      id: "receipt",
      binding,
      at: at + 20,
      passed: 2,
      total: 2,
      output: `BML_LITERAL_RECHECK_V1_PASS\nBML_PINNED_TEST_${h}\nBML_PARTITION_${p}`,
      provenance: "extension-reported",
      test_source: "reviewed-existing-tests",
    },
  ];
  return { state, remote, binding };
}
test("partitioned project repeated failure -> reviewed learning/prediction -> separately bound changed-input receipt -> finite recovery and no unrelated credit", () => {
  const { state, remote } = fixture();
  assert.ok(validProjectReview(state, remote, owner));
  const next = ingestProjectRechecks(state, remote);
  assert.equal(next.struggle.misconceptions[0].status, "conquered");
  assert.equal(
    next.struggle.misconceptions[0].projectRecheckReceiptId,
    "receipt",
  );
  assert.equal(next.struggle.attempts.length, 4);
  assert.equal(next.plan, state.plan);
  assert.equal(next.missionProgress, state.missionProgress);
  assert.equal(ingestProjectRechecks(next, remote), next);
  const restored = JSON.parse(JSON.stringify(next));
  assert.equal(restored.struggle.misconceptions[0].reassessed, true);
});
test("missing lesson/prediction/initial pass/ready, old contract or changed binding never conquers", () => {
  for (const mutate of [
    (s, r) => delete s.projectRecoveryReviews,
    (s, r) => (s.projectRecoveryReviews.SESSION.prediction = 0),
    (s, r) =>
      (s.projectRecoveryReviews.SESSION.binding = {
        ...s.projectRecoveryReviews.SESSION.binding,
        owner_id: "foreign",
      }),
    (s, r) => (r.status = "active"),
    (s, r) => delete r.project_recheck_ready,
    (s, r) => (r.project_recheck_ready.at = 1),
    (s, r) =>
      (r.project_recheck_receipts[0].binding = {
        ...r.project_recheck_receipts[0].binding,
        cases_digest: "f".repeat(64),
      }),
    (s, r) =>
      (r.project_recheck_receipts[0].binding = {
        ...r.project_recheck_receipts[0].binding,
        source_session_id: "OTHER",
      }),
    (s, r) =>
      (r.project_recheck_receipts[0].output = "BML_LITERAL_REPAIR_V1_PASS"),
    (s, r) => (r.project_recheck_receipts[0].total = 1),
    (s, r) =>
      (r.project_context.repair_contract.partition.initial_indices = [0, 2]),
    (s, r) => delete r.project_context.repair_contract.partition,
    (s, r) => (r.verified_owner_id = "foreign"),
    (s, r) => (s.sampleProvenance = { version: 1 }),
  ]) {
    const { state, remote } = fixture();
    mutate(state, remote);
    assert.equal(ingestProjectRechecks(state, remote), state);
  }
});
test("partition requires third exact marker and full disjoint integer index cover, nonpartitioned legacy stays two markers", () => {
  const { remote } = fixture();
  assert.equal(isLiteralRepairEvidence(remote), true);
  const legacy = structuredClone(remote);
  delete legacy.project_context.repair_contract.partition;
  legacy.checkpoints[0].evaluator.expectedOutputIncludes.pop();
  assert.equal(isLiteralRepairEvidence(legacy), true);
  assert.equal(projectBinding(legacy), null);
  for (const mutate of [
    (r) => r.checkpoints[0].evaluator.expectedOutputIncludes.pop(),
    (r) =>
      (r.project_context.repair_contract.partition.recheck_indices = [2, 2]),
    (r) =>
      (r.project_context.repair_contract.partition.source_session_id = "OTHER"),
    (r) =>
      (r.project_context.repair_contract.partition.initial_indices = [0, 4]),
    (r) => (r.project_context.repair_contract.partition.initial_indices = [0]),
  ]) {
    const r = structuredClone(remote);
    mutate(r);
    assert.equal(isLiteralRepairEvidence(r), false);
  }
});

test("malformed persisted partition arrays reject without throwing", () => {
  for (const value of [42, null, {}, "0,1"]) {
    const { remote } = fixture();
    remote.project_context.repair_contract.partition.initial_indices = value;
    assert.equal(isLiteralRepairEvidence(remote), false);
    assert.equal(projectBinding(remote), null);
  }
});
test("failed changed-input receipt is newest-first and blocked or invalid failed output is not evidence", () => {
  const { state, remote } = fixture();
  const r = remote.project_recheck_receipts[0];
  r.passed = 1;
  r.output = "Reviewed changed-input cases failed: 3";
  const next = ingestProjectRechecks(state, remote);
  assert.equal(next.struggle.attempts[0].id, "project-recheck:receipt");
  assert.equal(next.struggle.attempts[0].passed, 1);
  assert.equal(next.struggle.misconceptions[0].status, "locked");
  for (const output of [
    "BLOCKED",
    "Reviewed changed-input cases failed: 1",
    "Reviewed changed-input cases failed: 3,3",
    "Reviewed changed-input cases failed: 3,4",
  ]) {
    const t = fixture();
    t.remote.project_recheck_receipts[0].passed = 1;
    t.remote.project_recheck_receipts[0].output = output;
    assert.equal(ingestProjectRechecks(t.state, t.remote), t.state);
  }
});

test("malformed restored receipt collection or rows do not crash or create evidence", () => {
  for (const value of [42, null, {}, [null, 42, "bad"]]) {
    const { state, remote } = fixture();
    remote.project_recheck_receipts = value;
    assert.equal(ingestProjectRechecks(state, remote), state);
  }
});

test("repeat review after readiness preserves original review timestamp and allows later receipt", () => {
  const { state, remote } = fixture();
  const original = state.projectRecoveryReviews.SESSION.reviewed_at;
  const repeated = reviewProjectRecovery(
    state,
    remote,
    owner,
    1,
    original + 2000,
  );
  assert.equal(repeated, state);
  assert.equal(repeated.projectRecoveryReviews.SESSION.reviewed_at, original);
  assert.equal(
    ingestProjectRechecks(repeated, remote).struggle.misconceptions[0].status,
    "conquered",
  );
});
