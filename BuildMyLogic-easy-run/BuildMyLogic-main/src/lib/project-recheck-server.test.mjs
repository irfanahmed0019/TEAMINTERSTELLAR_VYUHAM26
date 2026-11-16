import test from "node:test";
import assert from "node:assert/strict";
import {
  readFileSync,
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import ts from "typescript";
import {
  PRACTICE_TASKS,
  practiceTaskBody,
  nextPracticeTaskId,
} from "./practice-task.ts";
// Transpile the actual server module, replacing only unrelated sample/paid-AI imports.
// Any network call is disallowed in these tests. No live learner/account data is used.
const source = readFileSync(
  new URL("./learning-sessions.server.ts", import.meta.url),
  "utf8",
)
  .replace(
    'import { isSampleAccount } from "./sample-account.ts";',
    "const isSampleAccount=()=>false;",
  )
  .replace(
    'import { sarvamJson } from "./sarvam.server";',
    'const sarvamJson=()=>{throw Error("Paid AI forbidden in regression");};',
  );
const js = ts.transpileModule(
  source.replace(
    /import\s*\{[^}]*PRACTICE_TASKS[^}]*\}\s*from\s*"\.\/practice-task\.ts";/,
    "const PRACTICE_TASKS=" +
      JSON.stringify(PRACTICE_TASKS) +
      "; const practiceTaskBody=" +
      practiceTaskBody.toString() +
      "; const nextPracticeTaskId=" +
      nextPracticeTaskId.toString() +
      ";",
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;
const server = await import(
  "data:text/javascript;base64," + Buffer.from(js).toString("base64")
);
process.env.SUPABASE_SERVICE_ROLE_KEY = "regression-only-mock";
process.env.VITE_SUPABASE_URL = "https://session-regression.invalid";
const db = new Map();
let rejectWrites = false;
globalThis.fetch = async (url, options = {}) => {
  if (
    !String(url).startsWith(
      "https://session-regression.invalid/rest/v1/learning_sessions",
    )
  )
    throw Error("Real network forbidden");
  if (options.method === "POST") {
    if (rejectWrites) return new Response("unavailable", { status: 503 });
    const row = JSON.parse(options.body);
    db.set(row.session_id, structuredClone(row));
    return new Response(null, { status: 204 });
  }
  const id = new URL(url).searchParams.get("session_id")?.slice(3);
  const row = db.get(id);
  return Response.json(row ? [row] : []);
};
const hash = (v) => createHash("sha256").update(v).digest("hex");
function contract() {
  const cases_json = JSON.stringify([
    { args: [20, 5], expected: 15 },
    { args: [4, 5], expected: 0 },
    { args: [5, 5], expected: 0 },
    { args: [100, 20], expected: 80 },
  ]);
  const partition = {
    version: 1,
    initial_indices: [0, 1],
    recheck_indices: [2, 3],
    partition_digest: hash(
      cases_json +
        "\n" +
        JSON.stringify({ initial_indices: [0, 1], recheck_indices: [2, 3] }),
    ),
  };
  return {
    path: "shop/prices.py",
    source: "def sale_price(price, discount):\n    return price + discount",
    function_name: "sale_price",
    arguments: ["price", "discount"],
    test_path: "test_prices.py",
    test_digest: "a".repeat(64),
    cases_json,
    cases_digest: hash(cases_json),
    baseline_failures: 2,
    approved_partition: true,
    partition,
    constructs: ["arithmetic"],
  };
}
async function session(input = contract()) {
  const s = await server.startLearningSession({
    challenge_id: "fresh-project",
    user_id: "123e4567-e89b-42d3-a456-426614174000",
  });
  await server.assignLiteralProjectChallenge(s, input);
  return s;
}
function result(s, passed) {
  const output = passed
    ? s.checkpoints[0].evaluator.expectedOutputIncludes.join("\n")
    : "Approved finite project cases failed: 1,2";
  server.recordEvent(s, "test_result", {
    status: passed ? "passed" : "failed",
    checkpoint_results: [
      {
        index: 0,
        evaluator_id: s.challengeId,
        passed,
        evidence_kind: passed ? "assertion" : "execution",
        output,
      },
    ],
  });
}
function payload(s, passed = true, output) {
  const b = server.projectRecheckBinding(s);
  return {
    source_session_id: s.sessionId,
    evaluator_id: s.challengeId,
    partition_digest: b.partition_digest,
    passed,
    output:
      output ??
      [
        "BML_LITERAL_RECHECK_V1_PASS",
        "BML_PINNED_TEST_" + b.test_digest,
        "BML_PARTITION_" + b.partition_digest,
      ].join("\n"),
  };
}

test("server partition/session-bound ready, initial finite repair, graded recheck, replay and honest receipt", async () => {
  const s = await session();
  const b = server.projectRecheckBinding(s);
  assert.equal(b.owner_id, s.userId);
  assert.equal(b.source_session_id, s.sessionId);
  assert.equal(s.checkpoints[0].evaluator.expectedOutputIncludes.length, 3);
  await assert.rejects(server.recordProjectRecheck(s, payload(s)));
  await assert.rejects(server.markProjectRecheckReady(s, b));
  result(s, false);
  result(s, false);
  result(s, true);
  assert.equal(s.status, "completed");
  const reversed = Object.fromEntries(Object.entries(b).reverse());
  const ready = await server.markProjectRecheckReady(s, reversed);
  assert.deepEqual(ready.project_recheck_ready.binding, b);
  assert.equal(typeof ready.project_recheck_ready.at, "number");
  assert.ok(Number.isFinite(ready.project_recheck_ready.at));
  const fail = await server.recordProjectRecheck(
    s,
    payload(s, false, "Reviewed changed-input cases failed: 4"),
  );
  assert.equal(fail.project_recheck_receipts[0].passed, 1);
  assert.equal(fail.project_recheck_receipts[0].total, 2);
  const pass = await server.recordProjectRecheck(s, payload(s));
  const receipt = pass.project_recheck_receipts.at(-1);
  assert.equal(receipt.passed, 2);
  assert.equal(typeof receipt.at, "number");
  assert.ok(Number.isFinite(receipt.at));
  assert.equal(receipt.provenance, "extension-reported");
  assert.equal(receipt.test_source, "reviewed-existing-tests");
  assert.deepEqual(receipt.binding, b);
  await server.recordProjectRecheck(s, payload(s));
  assert.equal(s.projectRecheckReceipts.length, 2);
  assert.equal(
    s.attempts,
    3,
    "recheck does not overwrite original task attempts",
  );
});
test("server rejects owner/session/evaluator/partition/signature/test/cases drift and blocked output", async () => {
  const s = await session();
  result(s, false);
  result(s, false);
  result(s, true);
  const b = server.projectRecheckBinding(s);
  await server.markProjectRecheckReady(s, b);
  for (const [key, value] of Object.entries({
    source_session_id: "another",
    evaluator_id: "another",
    partition_digest: "b".repeat(64),
    passed: 1,
    output: "BLOCKED: changed tests",
  }))
    await assert.rejects(
      server.recordProjectRecheck(s, { ...payload(s), [key]: value }),
    );
  for (const output of [
    "BLOCKED: no result",
    "Reviewed changed-input cases failed: 1",
    "Reviewed changed-input cases failed: 3,3",
    "Reviewed changed-input cases failed: 9",
    "Reviewed changed-input cases failed: 03",
    "BML_LITERAL_RECHECK_V1_PASS",
  ])
    await assert.rejects(
      server.recordProjectRecheck(s, payload(s, false, output)),
    );
  for (const mutate of [
    (s) => (s.userId = "other"),
    (s) => (s.sessionId = "other"),
    (s) => (s.projectContext.test_digest = "b".repeat(64)),
    (s) => (s.projectContext.repair_contract.source_digest = "b".repeat(64)),
    (s) => (s.projectContext.repair_contract.cases_digest = "b".repeat(64)),
    (s) => (s.projectContext.repair_contract.arguments = ["other", "discount"]),
    (s) =>
      (s.projectContext.repair_contract.partition.partition_digest = "b".repeat(
        64,
      )),
  ]) {
    const copy = structuredClone(s);
    mutate(copy);
    await assert.rejects(server.recordProjectRecheck(copy, payload(s)));
  }
});
test("legacy finite-only sessions cannot earn changed-input receipts or adopt unapproved partitions", async () => {
  const input = contract();
  delete input.partition;
  delete input.approved_partition;
  const s = await session(input);
  assert.equal(server.projectRecheckBinding(s), null);
  assert.equal(s.checkpoints[0].evaluator.expectedOutputIncludes.length, 2);
  await assert.rejects(server.markProjectRecheckReady(s, {}));
  const bad = contract();
  delete bad.approved_partition;
  await assert.rejects(session(bad));
  const drift = contract();
  drift.partition.partition_digest = "c".repeat(64);
  await assert.rejects(session(drift));
  const repeat = contract();
  repeat.cases_json = JSON.stringify([
    { args: [1, 0], expected: 1 },
    { args: [true, 0], expected: 1 },
    { args: [2, 0], expected: 2 },
    { args: [3, 0], expected: 3 },
  ]);
  repeat.cases_digest = hash(repeat.cases_json);
  await assert.rejects(session(repeat));
});
test("generic or mismatched failure claims cannot unlock readiness", async () => {
  const s = await session();
  server.recordEvent(s, "test_result", { status: "failed" });
  server.recordEvent(s, "test_result", { status: "failed" });
  result(s, true);
  await assert.rejects(
    server.markProjectRecheckReady(s, server.projectRecheckBinding(s)),
  );
});

test("strict save rejects backend failure and rolls back unsaved readiness/receipt", async () => {
  const s = await session();
  result(s, false);
  result(s, false);
  result(s, true);
  // Wait for inherited best-effort event writes before toggling the fixture outage.
  await new Promise((resolve) => setTimeout(resolve, 5));
  rejectWrites = true;
  await assert.rejects(
    server.markProjectRecheckReady(s, server.projectRecheckBinding(s)),
    /save failed/,
  );
  assert.equal(s.projectRecheckReady, undefined);
  rejectWrites = false;
  await server.markProjectRecheckReady(s, server.projectRecheckBinding(s));
  const before = s.projectRecheckReceipts?.length ?? 0;
  rejectWrites = true;
  await assert.rejects(
    server.recordProjectRecheck(s, payload(s)),
    /save failed/,
  );
  assert.equal(s.projectRecheckReceipts?.length ?? 0, before);
  rejectWrites = false;
  await server.recordProjectRecheck(s, payload(s));
  assert.equal(
    db.get(s.sessionId).session_data.projectRecheckReceipts.length,
    1,
  );
});

test("actual Python inspector to server assignment, initial attempt events, ready and two-case receipt", async () => {
  const dir = mkdtempSync(join(tmpdir(), "bml-connected-recheck-"));
  const evaluator = fileURLToPath(
    new URL(
      "../../vscode-extension/media/python_literal_repair.py",
      import.meta.url,
    ),
  );
  const run = (args) =>
    spawnSync("python3", ["-I", evaluator, ...args], {
      cwd: dir,
      encoding: "utf8",
      timeout: 2000,
    });
  try {
    mkdirSync(join(dir, "shop"));
    const file = join(dir, "shop", "prices.py");
    writeFileSync(
      file,
      "def sale_price(price, discount):\n    return price + discount",
    );
    writeFileSync(
      join(dir, "test_prices.py"),
      "from shop.prices import sale_price\nassert sale_price(20,5)==15\nassert sale_price(4,5)==0\nassert sale_price(5,5)==0\nassert sale_price(100,20)==80",
    );
    const inspected = run([
      "--inspect-partition",
      "shop/prices.py",
      "sale_price",
      "test_prices.py",
    ]);
    assert.equal(inspected.status, 0, inspected.stderr);
    const input = JSON.parse(inspected.stdout);
    const s = await session(input),
      b = server.projectRecheckBinding(s);
    assert.equal(b.partition_digest, input.partition.partition_digest);
    const args = [
      input.path,
      input.function_name,
      input.test_path,
      input.test_digest,
      input.arguments.join(","),
      input.cases_digest,
      input.partition.partition_digest,
    ];
    const report = (r) =>
      server.recordEvent(s, "test_result", {
        status: r.status === 0 ? "passed" : "failed",
        checkpoint_results: [
          {
            index: 0,
            evaluator_id: s.challengeId,
            passed: r.status === 0,
            evidence_kind: r.status === 0 ? "assertion" : "execution",
            output: r.stdout.trim(),
          },
        ],
      });
    for (let i = 0; i < 2; i++) {
      const failed = run(args);
      assert.equal(failed.status, 1, failed.stderr);
      report(failed);
    }
    // Overfitting the first approved inputs passes initial repair but not the reserved group.
    writeFileSync(
      file,
      "def sale_price(price, discount):\n    if price == 20:\n        return 15\n    return 0",
    );
    const initial = run(args);
    assert.equal(initial.status, 0, initial.stderr);
    report(initial);
    assert.equal(s.status, "completed");
    // This helper call simulates a successful route-owned cloud lesson gate, not a real learner lesson.
    await server.markProjectRecheckReady(s, b);
    const failedRecheck = run(["--recheck", ...args]);
    assert.equal(failedRecheck.status, 1, failedRecheck.stderr);
    const fail = await server.recordProjectRecheck(
      s,
      payload(s, false, failedRecheck.stdout.trim()),
    );
    assert.equal(fail.project_recheck_receipts.at(-1).passed, 1);
    writeFileSync(
      file,
      "def sale_price(price, discount):\n    if price < discount:\n        return 0\n    return price - discount",
    );
    const fixed = run(["--recheck", ...args]);
    assert.equal(fixed.status, 0, fixed.stderr);
    const pass = await server.recordProjectRecheck(
      s,
      payload(s, true, fixed.stdout.trim()),
    );
    assert.equal(pass.project_recheck_receipts.at(-1).passed, 2);
    writeFileSync(join(dir, "test_prices.py"), "# changed tests");
    const blocked = run(["--recheck", ...args]);
    assert.equal(blocked.status, 3);
    assert.equal(
      s.projectRecheckReceipts.length,
      2,
      "blocked execution adds no receipt",
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
