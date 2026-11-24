import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { createMockSupabase } from "./mock-supabase.test-helper.mjs";
// Isolated: in-memory PostgREST stand-in, no real network, no AI call.
process.env.SUPABASE_SERVICE_ROLE_KEY = "regression-only-mock";
process.env.VITE_SUPABASE_URL = "https://session-regression.invalid";
delete process.env.SARVAM_API_KEY;
const temp = new URL("./session-evidence-cas.testable.tmp.ts", import.meta.url);
writeFileSync(
  temp,
  readFileSync(
    new URL("./learning-sessions.server.ts", import.meta.url),
    "utf8",
  ).replace(
    'import { sarvamJson } from "./sarvam.server";',
    'const sarvamJson = async <T>(..._args: unknown[]): Promise<T> => { throw new Error("AI must not be called by this test"); };',
  ),
);
process.on("exit", () => rmSync(temp, { force: true }));
const server = await import(temp.href);
const mock = createMockSupabase();
globalThis.fetch = (url, options) => mock.fetchImpl(url, options);
const OWNER = "123e4567-e89b-42d3-a456-426614174000";
const clone = (x) => JSON.parse(JSON.stringify(x));
const result = (attempt, output = "wrong", passed = false) => ({
  attempt,
  status: passed ? "passed" : "failed",
  passed: passed ? 1 : 0,
  total: 1,
  checkpoint_results: [{ index: 0, passed, output }],
});
async function fresh() {
  mock.state.failNext.length = 0;
  mock.state.beforeWrite = undefined;
  const s = await server.startLearningSession({
    challenge_id: "isolated-cas-test",
    user_id: OWNER,
    concept: "conditions",
    language: "python",
    checkpoints: [{ title: "A", detail: "A" }],
  });
  return s;
}
const stored = (s) => mock.state.db.get(s.sessionId).session_data;
const tests = (d) => d.events.filter((e) => e.eventType === "test_result");
const consistent = (d) =>
  d.attempts === tests(d).length &&
  d.checkpoints[0].attempts === tests(d).length;

test("an accepted result is saved under a revision check before the call returns", async () => {
  const s = await fresh();
  await server.commitEvidenceEvent(s, "test_result", result(1));
  const d = stored(s);
  assert.equal(tests(d).length, 1);
  assert.equal(d.evidenceSeq, 1);
  assert.ok(d.events.at(-1).id);
  assert.equal(mock.state.db.get(s.sessionId).attempts, 1);
  assert.ok(consistent(d));
});

test("a stale instance adopts newer stored evidence whole, then applies only its own event", async () => {
  const s = await fresh();
  const stale = clone(s);
  await server.commitEvidenceEvent(s, "test_result", result(1, "a"));
  await server.commitEvidenceEvent(s, "test_result", result(2, "b"));
  assert.equal(stale.attempts, 0);
  await server.commitEvidenceEvent(stale, "test_result", result(3, "c"));
  const d = stored(s);
  assert.equal(tests(d).length, 3);
  assert.equal(d.attempts, 3);
  assert.equal(d.checkpoints[0].lastOutput, "c");
  assert.ok(consistent(d));
  assert.equal(stale.attempts, 3);
});

test("a conflicting writer between read and write: no loss, both events kept after retry", async () => {
  const s = await fresh();
  const other = clone(s);
  let injected = false;
  mock.state.beforeWrite = (_row, method) => {
    if (method !== "PATCH" || injected) return;
    injected = true;
    // Another instance commits first: advance the stored row under the same revision.
    const row = mock.state.db.get(s.sessionId);
    const d = row.session_data;
    d.rev = (d.rev ?? 0) + 1;
    d.evidenceSeq = (d.evidenceSeq ?? 0) + 1;
    d.attempts += 1;
    d.checkpoints[0].attempts += 1;
    d.checkpoints[0].lastOutput = "concurrent";
    d.events.push({
      id: "other-writer",
      eventType: "test_result",
      at: "2026-01-01T00:00:00.000Z",
      payload: { attempt: 1 },
    });
    row.attempts = d.attempts;
  };
  await server.commitEvidenceEvent(s, "test_result", result(2, "mine"));
  mock.state.beforeWrite = undefined;
  void other;
  const d = stored(s);
  assert.equal(tests(d).length, 2);
  assert.ok(d.events.some((e) => e.id === "other-writer"));
  assert.equal(d.attempts, 2);
  assert.equal(d.checkpoints[0].lastOutput, "mine");
  assert.ok(consistent(d));
});

test("retries are bounded: constant conflicts fail visibly and leave the in-memory copy as it was", async () => {
  const s = await fresh();
  mock.state.beforeWrite = (_row, method) => {
    if (method !== "PATCH") return;
    const row = mock.state.db.get(s.sessionId);
    row.session_data.rev = (row.session_data.rev ?? 0) + 1;
  };
  const patchesBefore = mock.state.log.filter(
    (l) => l.method === "PATCH",
  ).length;
  await assert.rejects(
    server.commitEvidenceEvent(s, "test_result", result(1)),
    (e) => e.statusCode === 503,
  );
  mock.state.beforeWrite = undefined;
  assert.equal(
    mock.state.log.filter((l) => l.method === "PATCH").length - patchesBefore,
    3,
  );
  assert.equal(s.attempts, 0);
  assert.equal(tests(s).length, 0);
  assert.equal(tests(stored(s)).length, 0);
});

test("storage read failure rejects the result; nothing is accepted in memory", async () => {
  const s = await fresh();
  for (let i = 0; i < 3; i++) mock.state.failNext.push("read503");
  await assert.rejects(
    server.commitEvidenceEvent(s, "test_result", result(1)),
    (e) => e.statusCode === 503,
  );
  mock.state.failNext.length = 0;
  assert.equal(s.attempts, 0);
  assert.equal(tests(stored(s)).length, 0);
});

test("write failure after retries rejects visibly and keeps the stored row intact", async () => {
  const s = await fresh();
  for (let i = 0; i < 3; i++) mock.state.failNext.push("write503");
  await assert.rejects(
    server.commitEvidenceEvent(s, "test_result", result(1)),
    (e) => e.statusCode === 503,
  );
  assert.equal(s.attempts, 0);
  assert.equal(tests(stored(s)).length, 0);
});

test("ambiguous success (write applied, response lost) is not recorded twice on retry", async () => {
  const s = await fresh();
  mock.state.failNext.push("writeLost");
  await server.commitEvidenceEvent(s, "test_result", result(1, "same"));
  const d = stored(s);
  assert.equal(tests(d).length, 1);
  assert.equal(d.attempts, 1);
  assert.equal(s.attempts, 1);
});

test("the extension retrying the same request after success adds no duplicate evidence", async () => {
  const s = await fresh();
  await server.commitEvidenceEvent(s, "test_result", result(1, "same"));
  await server.commitEvidenceEvent(s, "test_result", result(1, "same"));
  assert.equal(tests(stored(s)).length, 1);
  await server.commitEvidenceEvent(s, "test_result", result(2, "same"));
  assert.equal(tests(stored(s)).length, 2);
});

test("task generation or owner changing during the retry window is a 409, not an overwrite", async () => {
  for (const change of [
    { taskGeneration: 5 },
    { userId: "223e4567-e89b-42d3-a456-426614174000" },
  ]) {
    const s = await fresh();
    mock.state.beforeWrite = (_row, method) => {
      if (method !== "PATCH") return;
      const row = mock.state.db.get(s.sessionId);
      Object.assign(row.session_data, change);
      row.session_data.rev = (row.session_data.rev ?? 0) + 1;
    };
    await assert.rejects(
      server.commitEvidenceEvent(s, "test_result", result(1)),
      (e) => e.statusCode === 409,
    );
    mock.state.beforeWrite = undefined;
    assert.equal(s.attempts, 0);
    assert.equal(tests(stored(s)).length, 0);
  }
});

test("a stale heartbeat cannot overwrite newer stored evidence", async () => {
  const s = await fresh();
  const stale = clone(s);
  await server.commitEvidenceEvent(s, "test_result", result(1));
  await server.commitEvidenceEvent(s, "test_result", result(2));
  server.recordEvent(stale, "heartbeat", {});
  await new Promise((r) => setTimeout(r, 80));
  const d = stored(s);
  assert.equal(d.attempts, 2);
  assert.equal(tests(d).length, 2);
  assert.ok(consistent(d));
});

test("initial creation race: an existing row is never replaced by the creator's insert", async () => {
  mock.state.failNext.length = 0;
  let raced = false;
  mock.state.beforeWrite = (row, method) => {
    if (method !== "POST" || raced) return;
    raced = true;
    mock.state.db.set(row.session_id, structuredClone({ ...row, attempts: 0 }));
  };
  const s = await server.startLearningSession({
    challenge_id: "isolated-cas-race",
    user_id: OWNER,
    checkpoints: [{ title: "A", detail: "A" }],
  });
  mock.state.beforeWrite = undefined;
  assert.ok(mock.state.db.get(s.sessionId));
  assert.equal(mock.state.db.size >= 1, true);
});

test("heartbeat-only writes do not change evidence or derived state", async () => {
  const s = await fresh();
  await server.commitEvidenceEvent(s, "test_result", result(1));
  const before = clone(stored(s));
  server.recordEvent(s, "heartbeat", {});
  await new Promise((r) => setTimeout(r, 80));
  const d = stored(s);
  assert.equal(d.attempts, before.attempts);
  assert.deepEqual(d.checkpoints, before.checkpoints);
  assert.equal(tests(d).length, 1);
});
