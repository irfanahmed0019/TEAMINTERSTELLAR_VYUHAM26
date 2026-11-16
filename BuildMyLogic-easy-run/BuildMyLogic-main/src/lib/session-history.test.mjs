import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
// No external database or AI call is allowed in this isolated unit test.
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.SARVAM_API_KEY;
const temp = new URL("./session-history.testable.tmp.ts", import.meta.url);
const source = readFileSync(
  new URL("./learning-sessions.server.ts", import.meta.url),
  "utf8",
);
writeFileSync(
  temp,
  source.replace(
    'import { sarvamJson } from "./sarvam.server";',
    'let calls=0; export const paidCalls=()=>calls; const sarvamJson = async <T>(..._args: unknown[]): Promise<T> => { calls++; throw new Error("AI must not be called by this test"); };',
  ),
);
process.on("exit", () => rmSync(temp, { force: true }));
const {
  startLearningSession,
  recordEvent,
  stateOf,
  getRunPlan,
  submitProject,
  getHint,
  failSession,
  paidCalls,
  assignProjectChallenge,
  sessionTokenValid,
  takeSessionConnectionToken,
} = await import(temp.href);
test("session state exposes original numbered test attempts, not synthesized checkpoint history", async () => {
  const session = await startLearningSession({
    challenge_id: "isolated-history-test",
    concept: "loops",
    language: "python",
    checkpoints: [{ title: "Loops", detail: "Check a loop" }],
  });
  recordEvent(session, "test_result", {
    passed: 0,
    total: 1,
    checkpoint_results: [
      { index: 0, passed: false, output: "expected 5, got 4" },
    ],
  });
  recordEvent(session, "heartbeat", {});
  recordEvent(session, "test_result", {
    passed: 0,
    total: 1,
    checkpoint_results: [
      { index: 0, passed: false, output: "expected 5, got 4 again" },
    ],
  });
  const history = stateOf(session).attempt_history;
  assert.equal(history.length, 2);
  assert.deepEqual(
    history.map((a) => a.attempt),
    [1, 2],
  );
  assert.equal(history[0].checkpoints[0].lastOutput, "expected 5, got 4");
  assert.equal(history[1].checkpoints[0].lastOutput, "expected 5, got 4 again");
  assert.ok(history.every((a) => Number.isFinite(a.at)));
});

import { SAMPLE_ACCOUNT_ID } from "./sample-account.ts";
test("sample extension handlers never call paid AI even with a configured key", async () => {
  process.env.SARVAM_API_KEY = "test-configured-never-send";
  const s = await startLearningSession({
    user_id: SAMPLE_ACCOUNT_ID,
    challenge_id: "sample-extension-fixture",
    language: "Python",
    instructions: "Run main.py",
  });
  assert.equal((await getRunPlan(s, "linux")).command, "python3 main.py");
  assert.ok((await getHint(s)).guidance);
  assert.ok((await getHint(s, true)).guidance);
  assert.ok(
    (await submitProject(s, [{ path: "main.py", content: "print(1)" }])).review,
  );
  assert.ok((await failSession(s, "synthetic test")).recovery);
  assert.equal(paidCalls(), 0);
  delete process.env.SARVAM_API_KEY;
});

test("successful sequential assertion checkpoints never create false struggle", async () => {
  const s = await startLearningSession({
    challenge_id: "success-regression",
    checkpoints: ["a", "b", "c"].map((id) => ({
      title: id,
      evaluator: {
        id,
        command: "python3 -m pytest",
        expectedOutputIncludes: ["1 passed"],
      },
    })),
  });
  for (let i = 0; i < 3; i++) {
    recordEvent(s, "test_result", {
      passed: 1,
      total: 3,
      checkpoint_results: [
        {
          index: i,
          passed: true,
          evidence_kind: "assertion",
          evaluator_id: ["a", "b", "c"][i],
          output: "1 passed",
        },
      ],
    });
    assert.equal(s.potentialStruggle, false);
  }
  assert.equal(s.status, "completed");
  assert.deepEqual(s.testScore, { passed: 3, total: 3 });
});
test("compile/start success and aggregate completion do not prove requirements", async () => {
  const s = await startLearningSession({
    challenge_id: "compile-only",
    checkpoints: [{ title: "correct output" }],
  });
  recordEvent(s, "test_result", {
    passed: 1,
    total: 1,
    checkpoint_results: [
      {
        index: 0,
        passed: true,
        evidence_kind: "execution",
        output: "compiled",
      },
    ],
  });
  assert.notEqual(s.status, "completed");
  assert.equal(s.checkpoints[0].evidence, "detected");
  recordEvent(s, "test_result", { passed: 1, total: 1 });
  assert.notEqual(s.status, "completed");
});
test("session credential is high entropy, hashed in saved state and absent from public state", async () => {
  const s = await startLearningSession({ challenge_id: "auth-test" });
  const token = takeSessionConnectionToken(s);
  assert.equal(token.length, 43);
  assert.equal(sessionTokenValid(s, token), true);
  assert.equal(sessionTokenValid(s, "BML-AAAAA"), false);
  assert.equal(sessionTokenValid(s, "x".repeat(43)), false);
  assert.equal(s.connectionToken, undefined);
  assert.ok(!JSON.stringify(stateOf(s)).includes(token));
  assert.ok(!JSON.stringify(stateOf(s)).includes(s.connectionTokenHash));
});
test("heartbeat never grants active time and timing is bounded, paused and deduplicated", async () => {
  const s = await startLearningSession({
    challenge_id: "time-test",
    expected_duration_ms: 300000,
  });
  recordEvent(s, "heartbeat", {});
  assert.equal(stateOf(s).timing.active_ms, 0);
  assert.equal(stateOf(s).timing.quality, "unavailable");
  s.timing.lastReportAt = Date.now() - 10000;
  recordEvent(s, "work_activity", { sequence: 1, active_ms: 999999 });
  assert.ok(s.timing.activeMs >= 10000 && s.timing.activeMs < 10100);
  const before = s.timing.activeMs;
  recordEvent(s, "work_activity", { sequence: 1, active_ms: 30000 });
  assert.equal(s.timing.activeMs, before);
  recordEvent(s, "work_pause", { paused: true });
  s.timing.lastReportAt = Date.now() - 10000;
  recordEvent(s, "work_activity", { sequence: 2, active_ms: 10000 });
  assert.equal(s.timing.activeMs, before);
  assert.equal(stateOf(s).timing.expected_ms, 300000);
});
test("unavailable project evaluator never invents a score", async () => {
  delete process.env.SARVAM_API_KEY;
  const s = await startLearningSession({ challenge_id: "no-fake-review" });
  const result = await submitProject(s, [
    { path: "main.py", content: "print(1)" },
  ]);
  assert.equal(result.review.score, null);
  assert.equal(result.review.status, "not-evaluated");
});

test("actual API handler requires owner or scoped token and rejects aggregate completion", async () => {
  const ts = await import("typescript");
  const vm = await import("node:vm");
  const sessionModule = await import(temp.href);
  const { canReadRecoverySession } = await import("./request-auth.ts");
  let apiSource = readFileSync(new URL("../server.ts", import.meta.url), "utf8")
    .replace(/^import[\s\S]*?;\n/gm, "")
    .replace("export default {", "const exported = {");
  const js = ts.default.transpileModule(
    apiSource + "\nglobalThis.testApi = handleBuildMyLogicApi;",
    {
      compilerOptions: {
        target: ts.default.ScriptTarget.ES2022,
        module: ts.default.ModuleKind.ESNext,
      },
    },
  ).outputText;
  const context = vm.createContext({
    ...sessionModule,
    canReadRecoverySession,
    createRateLimiter: () => () => false,
    process: { env: { NODE_ENV: "development" } },
    Request,
    Response,
    URL,
    console,
    AbortSignal,
    setTimeout,
    clearTimeout,
    fetch: () => {
      throw Error("External call forbidden");
    },
  });
  vm.runInContext(js, context);
  const api = context.testApi;
  const start = await api(
    new Request("http://localhost:8080/api/sessions/start", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer local-builder",
      },
      body: JSON.stringify({
        challenge_id: "api-auth",
        user_id: "local-builder",
      }),
    }),
  );
  assert.equal(start.status, 200);
  const created = await start.json();
  assert.equal(created.connection_token.length, 43);
  const url = "http://localhost:8080/api/sessions/" + created.session_id;
  // A real UUID owner never inherits the local-builder development exception.
  const real = await startLearningSession({
    challenge_id: "real-owner",
    user_id: "12345678-1234-4234-8234-123456789abc",
  });
  assert.equal(
    (
      await api(
        new Request(
          "http://localhost:8080/api/sessions/" + real.sessionId + "/state",
        ),
      )
    ).status,
    403,
  );
  const headers = {
    "content-type": "application/json",
    "x-bml-session-token": created.connection_token,
  };
  assert.equal(
    (
      await api(
        new Request("http://localhost:8080/api/sessions/connect", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ session_id: created.session_id }),
        }),
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await api(
        new Request("http://localhost:8080/api/sessions/connect", {
          method: "POST",
          headers,
          body: JSON.stringify({ session_id: created.session_id }),
        }),
      )
    ).status,
    200,
  );
  const extensionState = await api(new Request(url + "/state", { headers }));
  assert.equal(extensionState.status, 200);
  assert.equal(
    (await extensionState.json()).state.verified_owner_id,
    undefined,
  );
  const ownerState = await api(
    new Request(url + "/state", {
      headers: { authorization: "Bearer local-builder" },
    }),
  );
  assert.equal(
    (await ownerState.json()).state.verified_owner_id,
    "local-builder",
  );
  assert.equal(
    (
      await api(
        new Request(url + "/complete", { method: "POST", headers, body: "{}" }),
      )
    ).status,
    409,
  );
});

test("a generic passing suite cannot prove an arbitrary mission requirement", async () => {
  const s = await startLearningSession({
    challenge_id: "generic-suite",
    checkpoints: [{ title: "Implement correct authentication" }],
  });
  recordEvent(s, "test_result", {
    passed: 1,
    total: 1,
    checkpoint_results: [
      {
        index: 0,
        passed: true,
        evidence_kind: "assertion",
        output: "99 passed",
      },
    ],
  });
  assert.notEqual(s.status, "completed");
  assert.equal(stateOf(s).attempt_history[0].total, 0);
});

test("source-grounded challenge requires exact supported function, names its source and evaluator", async () => {
  const s = await startLearningSession({
    challenge_id: "original",
    language: "C",
  });
  await assert.rejects(
    assignProjectChallenge(s, {
      path: "web/app.js",
      source: "function f(x){return x}",
    }),
    /Unsupported/,
  );
  await assert.rejects(
    assignProjectChallenge(s, {
      path: "app.py",
      source: "def f(x):\n    return x+1",
    }),
    /No supported/,
  );
  const source = "def parse_count(value):\n    return int(value)";
  const result = await assignProjectChallenge(s, {
    path: "app/input.py",
    source,
  });
  assert.match(result.title, /app\/input.py:parse_count/);
  assert.equal(result.language, "Python");
  assert.equal(result.expected_duration_ms, 480000);
  assert.match(result.challenge_id, /^python-decimal-contract:/);
  assert.equal(
    result.checkpoints[0].evaluator.command,
    "buildmylogic:python-decimal-contract",
  );
  assert.deepEqual(result.project_context.inspected_files, ["app/input.py"]);
  assert.match(result.project_context.summary, /Source digest/);
  recordEvent(s, "test_result", {
    passed: 0,
    total: 1,
    checkpoint_results: [
      {
        index: 0,
        passed: false,
        evidence_kind: "assertion",
        evaluator_id: s.checkpoints[0].evaluator.id,
        output: "Invalid input accepted",
      },
    ],
  });
  await assert.rejects(
    assignProjectChallenge(s, { path: "app/input.py", source }),
    /fresh session/,
  );
});

test("legacy successful partial aggregates do not invent failed checks or struggle", async () => {
  const s = await startLearningSession({
    userId: "legacy-qa",
    challenge_id: "legacy",
    title: "Legacy",
    language: "Python",
    instructions: "Read",
  });
  for (let i = 0; i < 3; i++)
    recordEvent(s, "test_result", { status: "passed", passed: 1, total: 4 });
  assert.equal(stateOf(s).potential_struggle, false);
  assert.equal(
    s.events.filter(
      (e) => e.eventType === "test_result" && e.payload.status === "failed",
    ).length,
    0,
  );
  assert.notEqual(stateOf(s).status, "completed");
});
test("assigned source digest and inspected paths stay pinned despite later manifest", async () => {
  const s = await startLearningSession({
    userId: "pin-qa",
    challenge_id: "pending",
    title: "Pending",
    language: "Python",
    instructions: "Inspect",
  });
  await assignProjectChallenge(s, {
    path: "input.py",
    source: "def parse(value):\n    return int(value)",
  });
  const original = structuredClone(stateOf(s).project_context);
  recordEvent(s, "project_context", {
    inspected_files: ["other.py"],
    summary: "changed",
  });
  assert.deepEqual(stateOf(s).project_context, original);
});

test("first foreground work delta is bounded by authenticated session age, not discarded", async () => {
  const s = await startLearningSession({ challenge_id: "first-time" });
  s.connectedAt = new Date(Date.now() - 5000).toISOString();
  recordEvent(s, "work_activity", { sequence: 1, active_ms: 4000 });
  assert.equal(stateOf(s).timing.active_ms, 4000);
});
test("passive Sessions evidence polling cannot call paid AI retune", () => {
  const source = readFileSync(
    new URL("../routes/sessions.tsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /aiRetunePlan/);
});
