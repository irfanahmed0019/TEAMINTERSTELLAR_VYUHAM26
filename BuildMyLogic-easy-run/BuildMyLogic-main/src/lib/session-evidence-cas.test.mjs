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
const result = (attempt, output = "wrong", passed = false, key) => ({
  attempt,
  ...(key ? { client_event_id: key } : {}),
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
  await server.commitEvidenceEvent(
    s,
    "test_result",
    result(1, "same", false, "key-ambiguous-1"),
  );
  const d = stored(s);
  assert.equal(tests(d).length, 1);
  assert.equal(d.attempts, 1);
  assert.equal(s.attempts, 1);
});

test("retry with the same client key after success adds nothing, even when the attempt number advanced", async () => {
  const s = await fresh();
  const K = "key-retry-0001";
  await server.commitEvidenceEvent(
    s,
    "test_result",
    result(1, "same", false, K),
  );
  // client refreshed its cache after a lost reply, so it now says attempt 2
  await server.commitEvidenceEvent(
    s,
    "test_result",
    result(2, "same", false, K),
  );
  assert.equal(tests(stored(s)).length, 1);
  assert.equal(stored(s).attempts, 1);
});

test("two separate identical submissions with different keys both count", async () => {
  const s = await fresh();
  await server.commitEvidenceEvent(
    s,
    "test_result",
    result(1, "same", false, "key-aaaa-0001"),
  );
  await server.commitEvidenceEvent(
    s,
    "test_result",
    result(1, "same", false, "key-bbbb-0002"),
  );
  assert.equal(tests(stored(s)).length, 2);
  assert.ok(consistent(stored(s)));
});

test("a request without a key is never deduplicated (identical sends both count)", async () => {
  const s = await fresh();
  await server.commitEvidenceEvent(s, "test_result", result(1, "same"));
  await server.commitEvidenceEvent(s, "test_result", result(1, "same"));
  assert.equal(tests(stored(s)).length, 2);
});

test("read refresh: a stale instance adopts the stored evidence whole", async () => {
  const s = await fresh();
  const stale = clone(s);
  await server.commitEvidenceEvent(
    s,
    "test_result",
    result(1, "a", false, "key-read-0001"),
  );
  await server.commitEvidenceEvent(
    s,
    "test_result",
    result(2, "b", true, "key-read-0002"),
  );
  Object.assign(stale, { events: stale.events, attempts: 0 });
  await server.refreshConquestReceipts(stale);
  assert.equal(stale.attempts, 2);
  assert.equal(stale.checkpoints[0].attempts, 2);
  assert.equal(tests(stale).length, 2);
  assert.deepEqual(stale.testScore, stored(s).testScore);
});

test("legacy snapshots: absent evidenceSeq with differing events adopts the stored row on read", async () => {
  const s = await fresh();
  await server.commitEvidenceEvent(
    s,
    "test_result",
    result(1, "a", false, "key-leg-00001"),
  );
  const row = mock.state.db.get(s.sessionId);
  // make the stored row look legacy: no evidenceSeq, 2 attempts
  delete row.session_data.evidenceSeq;
  row.session_data.attempts = 2;
  row.session_data.checkpoints[0].attempts = 2;
  row.session_data.events.push({
    eventType: "test_result",
    at: new Date().toISOString(),
    payload: { attempt: 2, status: "failed" },
  });
  row.session_data.rev = (row.session_data.rev ?? 0) + 1;
  const mem = clone(s);
  delete mem.evidenceSeq;
  mem.rev = row.session_data.rev;
  await server.refreshConquestReceipts(mem);
  assert.equal(mem.attempts, 2);
  assert.equal(tests(mem).length, 2);
});

test("legacy snapshots: equal evidenceSeq, differing events, memory strictly newer by rev keeps memory", async () => {
  const s = await fresh();
  await server.commitEvidenceEvent(
    s,
    "test_result",
    result(1, "a", false, "key-leg-00002"),
  );
  const mem = clone(s);
  mem.rev = (mem.rev ?? 0) + 5;
  mem.events.push({
    eventType: "heartbeat",
    at: new Date().toISOString(),
    payload: {},
  });
  await server.refreshConquestReceipts(mem);
  assert.equal(mem.events[mem.events.length - 1].eventType, "heartbeat");
  assert.equal(mem.attempts, 1);
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

test("REGRESSION: memory ahead only by heartbeat rev, equal or legacy evidenceSeq, does not keep stale evidence over a newer stored result", async () => {
  const s = await fresh();
  await server.commitEvidenceEvent(
    s,
    "test_result",
    result(1, "a", false, "key-hb-000001"),
  );
  const stale = clone(s);
  await server.commitEvidenceEvent(
    s,
    "test_result",
    result(2, "b", true, "key-hb-000002"),
  );
  // memory only has heartbeats since: higher rev, same evidence
  for (const legacy of [false, true]) {
    const mem = clone(stale);
    for (let i = 0; i < 5; i++)
      mem.events.push({
        eventType: "heartbeat",
        at: new Date().toISOString(),
        payload: {},
      });
    mem.rev = (stored(s).rev ?? 0) + 50;
    if (legacy) {
      delete mem.evidenceSeq;
      const row = mock.state.db.get(s.sessionId);
      delete row.session_data.evidenceSeq;
    }
    await server.refreshConquestReceipts(mem);
    assert.equal(mem.attempts, 2, legacy ? "legacy" : "seq");
    assert.equal(tests(mem).length, 2);
    assert.equal(mem.checkpoints[0].attempts, 2);
  }
});

test("unsaved accepted legacy evidence in memory is kept, not dropped, when stored has nothing extra", async () => {
  const s = await fresh();
  const mem = clone(s);
  mem.events.push({
    eventType: "test_result",
    at: new Date().toISOString(),
    payload: { attempt: 1, status: "failed" },
  });
  mem.attempts = 1;
  await server.refreshConquestReceipts(mem);
  assert.equal(mem.attempts, 1);
  assert.equal(tests(mem).length, 1);
});

test("unrecoverable legacy divergence: stored wins and the other side's event is kept, labelled, not counted", async () => {
  const s = await fresh();
  await server.commitEvidenceEvent(
    s,
    "test_result",
    result(1, "a", false, "key-div-000001"),
  );
  const mem = clone(s);
  mem.events = mem.events.filter((e) => e.eventType !== "test_result");
  mem.attempts = 1;
  mem.events.push({
    eventType: "test_result",
    at: "2026-01-01T00:00:00.000Z",
    payload: { attempt: 1, status: "failed", stdout: "only-in-memory" },
  });
  await server.refreshConquestReceipts(mem);
  assert.equal(tests(mem).length, 1);
  assert.notEqual(tests(mem)[0].payload.stdout, "only-in-memory");
  assert.equal(mem.divergedEvidence.length, 1);
  assert.equal(mem.divergedEvidence[0].payload.stdout, "only-in-memory");
});

test("divergence past the retention cap reports overflow instead of claiming everything was kept", async () => {
  const s = await fresh();
  await server.commitEvidenceEvent(
    s,
    "test_result",
    result(1, "a", false, "key-cap-000001"),
  );
  const mem = clone(s);
  mem.events = mem.events.filter((e) => e.eventType !== "test_result");
  for (let i = 0; i < 25; i++)
    mem.events.push({
      eventType: "test_result",
      at: "2026-01-01T00:00:" + String(i).padStart(2, "0") + ".000Z",
      payload: { attempt: i, status: "failed", stdout: "m" + i },
    });
  await server.refreshConquestReceipts(mem);
  assert.equal(mem.divergedEvidence.length, 20);
  assert.equal(mem.divergedEvidenceOverflow, 5);
  assert.equal(tests(mem).length, 1);
});

test("stale heartbeat does not regress completed status, receipts, connection fields or hints (non-evidence fields)", async () => {
  const s = await fresh();
  const stale = clone(s);
  const row = mock.state.db.get(s.sessionId);
  Object.assign(row.session_data, {
    status: "completed",
    connectedAt: "2026-01-01T00:00:00.000Z",
    hintsUsed: 2,
    latestFeedback: "newer hint",
    conquestReceipts: [{ id: "r-1", at: "x" }],
    lastSeenAt: "2099-01-01T00:00:00.000Z",
    rev: (row.session_data.rev ?? 0) + 3,
  });
  row.status = "completed";
  const hash = row.session_data.connectionTokenHash;
  assert.ok(hash);
  stale.connectionTokenHash = "stale-hash";
  server.recordEvent(stale, "heartbeat", {});
  await new Promise((r) => setTimeout(r, 120));
  const d = stored(s);
  assert.equal(d.status, "completed");
  assert.equal(d.connectedAt, "2026-01-01T00:00:00.000Z");
  assert.equal(d.hintsUsed, 2);
  assert.equal(d.latestFeedback, "newer hint");
  assert.deepEqual(
    d.conquestReceipts.map((r) => r.id),
    ["r-1"],
  );
  assert.equal(d.connectionTokenHash, hash);
  assert.ok(d.lastSeenAt >= "2099-01-01");
  assert.equal(d.owner ?? d.userId, row.session_data.userId);
});

test("legitimate forward transitions still apply (active to connected, new receipt added)", async () => {
  const s = await fresh();
  s.status = "connected";
  s.connectedAt = new Date().toISOString();
  s.conquestReceipts = [{ id: "r-new", at: "y" }];
  server.recordEvent(s, "heartbeat", {});
  await new Promise((r) => setTimeout(r, 120));
  const d = stored(s);
  assert.equal(d.status, "connected");
  assert.ok(d.connectedAt);
  assert.ok(d.conquestReceipts.some((r) => r.id === "r-new"));
});

async function pendingProject() {
  mock.state.failNext.length = 0;
  mock.state.beforeWrite = undefined;
  const s = await server.startLearningSession({
    challenge_id: "project-context-pending",
    user_id: OWNER,
    concept: "debugging",
    language: "python",
    checkpoints: [{ title: "Inspect", detail: "Inspect" }],
  });
  return s;
}
// Another instance assigned the repair and saved it. Only the stored row is changed here.
function storeAssignedRepair(
  s,
  challengeId = "python-literal-repair:" + "a".repeat(24),
) {
  const row = mock.state.db.get(s.sessionId);
  const d = row.session_data;
  d.challengeId = challengeId;
  d.title = "Repair tracker.py:is_yes against its approved project tests";
  d.rev = (d.rev ?? 0) + 1;
  d.testCommand = "buildmylogic:python-literal-repair-v1";
  d.checkpoints = [{ title: "Pass approved project cases", detail: "6 cases" }];
  row.challenge_id = challengeId;
  return d;
}

test("a stale pending project instance reads the stored project assignment instead of serving 'pending'", async () => {
  const s = await pendingProject();
  assert.equal(s.challengeId, "project-context-pending");
  const saved = storeAssignedRepair(s);
  const seen = await server.verifySession(s.sessionId, true);
  assert.equal(seen.challengeId, saved.challengeId);
  assert.equal(seen.testCommand, saved.testCommand);
});

test("an assigned project session in memory keeps its stored attempts when read", async () => {
  const s = await pendingProject();
  storeAssignedRepair(s);
  const seen = await server.verifySession(s.sessionId, true);
  await server.commitEvidenceEvent(
    seen,
    "test_result",
    result(1, "Approved finite project cases failed: 3"),
  );
  const again = await server.verifySession(s.sessionId, true);
  assert.equal(again.attempts, 1);
  assert.equal(stored(s).attempts, 1);
});

test("a pending session that already has attempts is not replaced by a stored assignment", async () => {
  const s = await pendingProject();
  s.attempts = 2;
  storeAssignedRepair(s);
  const seen = await server.verifySession(s.sessionId, true);
  assert.equal(seen.challengeId, "project-context-pending");
});
