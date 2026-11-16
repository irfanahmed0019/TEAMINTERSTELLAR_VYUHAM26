// Actual server router; isolated mock auth/database. No real cloud, code, user or AI.
import { createServer } from "vite";
import { join } from "node:path";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
const original = global.fetch,
  env = { ...process.env },
  sessions = new Map(),
  codes = new Map();
const host = "https://pairing-fixture.invalid",
  owner = "123e4567-e89b-42d3-a456-426614174000";
process.env.VITE_SUPABASE_URL = host;
process.env.VITE_SUPABASE_ANON_KEY = "fixture";
process.env.SUPABASE_SERVICE_ROLE_KEY = "fixture-only";
delete process.env.SARVAM_API_KEY;
let rejectAssignmentWrite = false;
let onPendingRead = null,
  onPendingHeartbeatWrite = null;
global.fetch = async (input, o = {}) => {
  const u = new URL(input);
  assert.equal(u.origin, host);
  if (u.pathname === "/auth/v1/user")
    return Response.json({
      id:
        o.headers.authorization === "Bearer owner"
          ? owner
          : "223e4567-e89b-42d3-a456-426614174000",
    });
  if (u.pathname.endsWith("/learning_sessions")) {
    if (o.method === "PATCH") {
      if (
        !u.searchParams.has("session_data->>rev") &&
        onPendingHeartbeatWrite
      ) {
        const done = onPendingHeartbeatWrite;
        onPendingHeartbeatWrite = null;
        queueMicrotask(done);
      }
      if (rejectAssignmentWrite === "network")
        throw new Error("mock network failure");
      if (rejectAssignmentWrite === "json")
        return new Response("bad json", { status: 200 });
      if (rejectAssignmentWrite)
        return new Response("unavailable", { status: 503 });
      const id = u.searchParams.get("session_id")?.slice(3),
        row = sessions.get(id);
      if (
        !row ||
        u.searchParams.get("challenge_id") !== "eq." + row.challenge_id ||
        (u.searchParams.has("attempts") &&
          u.searchParams.get("attempts") !== "eq." + row.attempts) ||
        (u.searchParams.has("session_data->>challengeId") &&
          u.searchParams.get("session_data->>challengeId") !==
            "eq." + row.session_data.challengeId) ||
        (u.searchParams.has("session_data->>rev") &&
          u.searchParams.get("session_data->>rev") !==
            (row.session_data.rev === undefined
              ? "is.null"
              : "eq." + row.session_data.rev)) ||
        (u.searchParams.has("session_data->>taskGeneration") &&
          u.searchParams.get("session_data->>taskGeneration") !==
            (row.session_data.taskGeneration === undefined
              ? "is.null"
              : "eq." + row.session_data.taskGeneration)) ||
        (u.searchParams.has("status") &&
          u.searchParams.get("status").startsWith("eq.") &&
          u.searchParams.get("status") !== "eq." + row.status)
      )
        return Response.json([]);
      Object.assign(row, JSON.parse(o.body));
      return Response.json([{ session_id: id }]);
    }
    if (o.method === "POST") {
      const row = JSON.parse(o.body);
      if (
        !String(o.headers.prefer).includes("ignore-duplicates") ||
        !sessions.has(row.session_id)
      )
        sessions.set(row.session_id, row);
      return new Response(null, { status: 204 });
    }
    const id = u.searchParams.get("session_id")?.slice(3);
    const snapshot = structuredClone(
      sessions.has(id) ? [sessions.get(id)] : [],
    );
    if (onPendingRead) {
      const hook = onPendingRead;
      onPendingRead = null;
      await hook();
    }
    return Response.json(snapshot);
  }
  if (u.pathname.endsWith("/session_pairing_codes")) {
    if (o.method === "POST") {
      const row = JSON.parse(o.body);
      codes.set(row.code_hash, row);
      return new Response(null, { status: 201 });
    }
    assert.equal(o.method, "DELETE");
    const key = u.searchParams.get("code_hash").slice(3),
      row = codes.get(key);
    codes.delete(key);
    return Response.json(row ? [row] : []);
  }
  throw Error("Unexpected mock DB route");
};
const vite = await createServer({
  configFile: false,
  server: { middlewareMode: true },
  resolve: { alias: { "@": join(process.cwd(), "src") } },
});
try {
  const router = (await vite.ssrLoadModule("/src/server.ts")).default;
  const call = async (path, body, auth) => {
    const r = await router.fetch(
      new Request("https://buildmylogicxyz.vercel.app" + path, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(auth ? { authorization: "Bearer " + auth } : {}),
        },
        body: JSON.stringify(body),
      }),
      {},
      {},
    );
    return { status: r.status, body: await r.json() };
  };
  const started = await call(
    "/api/sessions/start",
    { user_id: owner, challenge_id: "pairing-fixture" },
    "owner",
  );
  assert.equal(started.status, 200);
  const id = started.body.session_id,
    token = started.body.connection_token;
  const create = "/api/sessions/" + id + "/pairing/create";
  const pending = await call(
    "/api/sessions/start",
    { user_id: owner, challenge_id: "project-context-pending" },
    "owner",
  );
  for (const action of ["run-plan", "test-result", "failed", "submit"]) {
    const denied = await call(
      "/api/sessions/" + pending.body.session_id + "/" + action,
      {},
      "owner",
    );
    assert.equal(
      denied.status,
      409,
      "pending must not create false failure or paid call: " + action,
    );
  }
  const persistenceFixture = await call(
    "/api/sessions/start",
    { user_id: owner, challenge_id: "project-context-pending" },
    "owner",
  );
  const failureId = persistenceFixture.body.session_id,
    failurePath = "/api/sessions/" + failureId + "/practice-task";
  rejectAssignmentWrite = true;
  assert.equal(
    (
      await call(
        failurePath,
        { practice_task: "python-loops-fibonacci-v1" },
        "owner",
      )
    ).status,
    503,
  );
  assert.equal(
    globalThis.__buildMyLogicLearningSessions.get(failureId).challengeId,
    "project-context-pending",
  );
  assert.equal(sessions.get(failureId).challenge_id, "project-context-pending");
  for (const mode of ["network", "json"]) {
    rejectAssignmentWrite = mode;
    assert.equal(
      (
        await call(
          failurePath,
          { practice_task: "python-loops-fibonacci-v1" },
          "owner",
        )
      ).status,
      503,
    );
    assert.equal(
      globalThis.__buildMyLogicLearningSessions.get(failureId).challengeId,
      "project-context-pending",
    );
    assert.equal(
      sessions.get(failureId).challenge_id,
      "project-context-pending",
    );
  }
  rejectAssignmentWrite = false;
  sessions.get(failureId).session_data.rev = 5;
  const newerPending = await call(
    failurePath,
    { practice_task: "python-loops-fibonacci-v1" },
    "owner",
  );
  assert.equal(
    newerPending.status,
    200,
    "newer cloud pending revision must refresh, not permanently conflict",
  );
  const raceFixture = await call(
    "/api/sessions/start",
    { user_id: owner, challenge_id: "project-context-pending" },
    "owner",
  );
  const raceId = raceFixture.body.session_id,
    racePath = "/api/sessions/" + raceId + "/practice-task";
  const raced = await Promise.all([
    call(racePath, { practice_task: "python-loops-fibonacci-v1" }, "owner"),
    call(racePath, { practice_task: "python-functions-double-v1" }, "owner"),
  ]);
  assert.deepEqual(raced.map((r) => r.status).sort(), [200, 409]);
  const winner = raced.find((r) => r.status === 200).body.state.challenge_id;
  assert.equal(sessions.get(raceId).challenge_id, winner);
  assert.equal(
    globalThis.__buildMyLogicLearningSessions.get(raceId).challengeId,
    winner,
  );
  console.log(
    "PASS cloud write503 keeps pending memory+cloud unchanged; concurrent owner choices get one conditional winner, no overwrite.",
  );
  const heartbeatFixture = await call(
    "/api/sessions/start",
    { user_id: owner, challenge_id: "project-context-pending" },
    "owner",
  );
  const heartbeatId = heartbeatFixture.body.session_id;
  const staleHeartbeat = structuredClone(
    globalThis.__buildMyLogicLearningSessions.get(heartbeatId),
  );
  const heartbeatWritten = new Promise((resolve) => {
    onPendingHeartbeatWrite = resolve;
  });
  onPendingRead = async () => {
    const assigned = await call(
      "/api/sessions/" + heartbeatId + "/practice-task",
      { practice_task: "python-loops-fibonacci-v1" },
      "owner",
    );
    assert.equal(assigned.status, 200);
  };
  const learning = await vite.ssrLoadModule(
    "/src/lib/learning-sessions.server.ts",
  );
  learning.recordEvent(staleHeartbeat, "heartbeat", {});
  await Promise.race([
    heartbeatWritten,
    new Promise((_, reject) =>
      setTimeout(() => reject(Error("heartbeat interleave timeout")), 2000),
    ),
  ]);
  assert.equal(
    sessions.get(heartbeatId).challenge_id,
    "python-loops-fibonacci-v1",
    "old pending read before assignment, conditional heartbeat write after it cannot undo task",
  );
  console.log(
    "PASS delayed stale heartbeat read-before / write-after assignment cannot revert cloud task.",
  );
  const pendingId = pending.body.session_id,
    pendingToken = pending.body.connection_token;
  const assignmentPath = "/api/sessions/" + pendingId + "/practice-task";
  assert.equal(
    (
      await call(
        assignmentPath,
        { practice_task: "python-loops-fibonacci-v1" },
        "other",
      )
    ).status,
    403,
  );
  const stalePending = structuredClone(
    globalThis.__buildMyLogicLearningSessions.get(pendingId),
  );
  const assigned = await call(
    assignmentPath,
    { practice_task: "python-loops-fibonacci-v1" },
    "owner",
  );
  assert.equal(assigned.status, 200);
  assert.equal(assigned.body.session_id, pendingId);
  assert.equal(assigned.body.state.challenge_id, "python-loops-fibonacci-v1");
  assert.ok(assigned.body.state.rev > 0);
  globalThis.__buildMyLogicLearningSessions.set(pendingId, stalePending);
  const sameToken = await router.fetch(
    new Request(
      "https://buildmylogicxyz.vercel.app/api/sessions/" + pendingId + "/state",
      { headers: { "x-bml-session-token": pendingToken } },
    ),
    {},
    {},
  );
  assert.equal(sameToken.status, 200);
  assert.equal(
    (await sameToken.json()).state.challenge_id,
    "python-loops-fibonacci-v1",
  );
  assert.equal(
    (
      await call(
        assignmentPath,
        { practice_task: "python-functions-double-v1" },
        "owner",
      )
    ).status,
    400,
  );
  console.log(
    "PASS stale-instance pending refreshed from cloud; existing pending ID+token kept; owner assigns task; same extension token reads new question; wrong owner and task overwrite blocked.",
  );
  for (const [taskId, keyword, wrong, correct] of [
    [
      "python-loops-fibonacci-v1",
      "Fibonacci",
      "for n in range(10): print(n)",
      "n=int(input('How many numbers do you want? '))\na,b=0,1\nfor _ in range(n):\n print(a,end=' ')\n a,b=b,a+b",
    ],
    [
      "python-conditions-sign-v1",
      "if/else",
      "n=int(input())\nif n<0: print('positive')\nelse: print('zero')",
      "n=int(input())\nif n<0: print('negative')\nelif n==0: print('zero')\nelse: print('positive')",
    ],
    [
      "python-functions-double-v1",
      "double(n)",
      "def double(n): return n+2\nprint(double(int(input())))",
      "def double(n): return n*2\nprint(double(int(input())))",
    ],
    [
      "python-strings-vowels-v1",
      "count",
      "s=input()\nn=0\nfor c in s: n+=1\nprint(n)",
      "s=input()\nn=0\nfor c in s:\n if c in 'aeiou': n+=1\nprint(n)",
    ],
  ]) {
    const practice =
      taskId === "python-loops-fibonacci-v1"
        ? {
            status: 200,
            body: { ...assigned.body, connection_token: pendingToken },
          }
        : await call(
            "/api/sessions/start",
            {
              user_id: owner,
              practice_task: taskId,
              challenge_id: "ignored",
              instructions: "untrusted override",
            },
            "owner",
          );
    assert.equal(practice.status, 200);
    assert.equal(practice.body.state.challenge_id, taskId);
    assert.ok(practice.body.state.instructions.includes(keyword));
    assert.equal(practice.body.state.instructions.split("\n").length, 2);
    const dir = mkdtempSync(join(tmpdir(), "bml-fib-connected-"));
    try {
      for (const [source, pass] of [
        [wrong, false],
        [correct, true],
      ]) {
        const selectedPath = join(
          dir,
          taskId === "python-loops-fibonacci-v1" ? "learner's k.py" : "main.py",
        );
        writeFileSync(selectedPath, source);
        const local = spawnSync(
          "python3",
          [
            "-I",
            join(
              process.cwd(),
              "vscode-extension/media/python_loops_practice.py",
            ),
            taskId,
            selectedPath,
          ],
          { cwd: dir, encoding: "utf8", timeout: 5000 },
        );
        assert.equal(local.status === 0, pass);
        const result = await router.fetch(
          new Request(
            "https://buildmylogicxyz.vercel.app/api/sessions/" +
              practice.body.session_id +
              "/test-result",
            {
              method: "POST",
              headers: {
                "content-type": "application/json",
                "x-bml-session-token": practice.body.connection_token,
              },
              body: JSON.stringify({
                status: pass ? "passed" : "failed",
                checkpoint_results: [
                  {
                    index: 0,
                    passed: pass,
                    output: local.stdout,
                    evaluator_id: taskId,
                    evidence_kind: "assertion",
                  },
                ],
              }),
            },
          ),
          {},
          {},
        );
        const state = (await result.json()).state;
        assert.equal(result.status, 200);
        assert.equal(state.status === "completed", pass);
      }
      if (taskId === "python-loops-fibonacci-v1") {
        const previous =
            globalThis.__buildMyLogicLearningSessions.get(pendingId),
          old = structuredClone(previous);
        const change = await call(
          "/api/sessions/" + pendingId + "/practice-task",
          {
            practice_task: "python-functions-double-v1",
            replace_task: true,
            previous_challenge: taskId,
            task_generation: 0,
          },
          "owner",
        );
        assert.equal(change.status, 200);
        assert.equal(change.body.state.task_generation, 1);
        assert.equal(change.body.state.attempts, 0);
        assert.equal(change.body.state.practice_history.length, 1);
        assert.equal(change.body.state.practice_history[0].state.attempts, 2);
        assert.equal(
          change.body.state.practice_history[0].state.status,
          "completed",
        );
        const late = await call(
          "/api/sessions/" + pendingId + "/test-result",
          {
            status: "passed",
            checkpoint_results: [
              {
                index: 0,
                passed: true,
                output: "BML_PRACTICE_PASS:" + taskId,
                evaluator_id: taskId,
                evidence_kind: "assertion",
              },
            ],
          },
          "owner",
        );
        assert.equal(late.status, 409);
        assert.equal(
          globalThis.__buildMyLogicLearningSessions.get(pendingId).attempts,
          0,
        );
        assert.equal(
          (
            await call(
              "/api/sessions/" + pendingId + "/practice-task",
              {
                practice_task: "python-strings-vowels-v1",
                replace_task: true,
                previous_challenge: taskId,
                task_generation: 0,
              },
              "owner",
            )
          ).status,
          409,
        );
        globalThis.__buildMyLogicLearningSessions.set(pendingId, old);
        const restored = await router.fetch(
          new Request(
            "https://buildmylogicxyz.vercel.app/api/sessions/" +
              pendingId +
              "/state",
            { headers: { "x-bml-session-token": pendingToken } },
          ),
          {},
          {},
        );
        const newer = await restored.json();
        assert.equal(newer.state.task_generation, 1);
        assert.equal(newer.state.challenge_id, "python-functions-double-v1");
        const switchedFile = join(dir, "k.py");
        writeFileSync(
          switchedFile,
          "def double(n): return n*2\nprint(double(int(input('Value? '))))",
        );
        const switchedRun = spawnSync(
          "python3",
          [
            "-I",
            join(
              process.cwd(),
              "vscode-extension/media/python_loops_practice.py",
            ),
            "python-functions-double-v1",
            switchedFile,
          ],
          { cwd: dir, encoding: "utf8", timeout: 12000 },
        );
        assert.equal(switchedRun.status, 0);
        const boundResult = await call(
          "/api/sessions/" + pendingId + "/test-result",
          {
            task_generation: 1,
            status: "passed",
            checkpoint_results: [
              {
                index: 0,
                passed: true,
                output: switchedRun.stdout,
                evaluator_id: "python-functions-double-v1",
                evidence_kind: "assertion",
              },
            ],
          },
          "owner",
        );
        assert.equal(boundResult.status, 200);
        assert.equal(boundResult.body.state.status, "completed");
        assert.equal(
          boundResult.body.state.practice_history[0].state.attempts,
          2,
        );
        console.log(
          "PASS explicit same-ID completed-task switch archives two old attempts; generation1 resets only currenttask; late old result and stale selection409; oldinstance adopts changedquestion.",
        );
      }
      console.log(
        "PASS " +
          taskId +
          " -> actual packaged Python wrong fails -> corrected code passes -> actual route finite receipt complete; no AI, mock REST.",
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  assert.equal((await call(create, { connection_token: token })).status, 401);
  assert.equal(
    (await call(create, { connection_token: token }, "other")).status,
    403,
  );
  assert.equal(
    (await call(create, { connection_token: "bad" }, "owner")).status,
    403,
  );
  const issued = await call(create, { connection_token: token }, "owner");
  assert.equal(issued.status, 200);
  const claims = await Promise.all([
    call("/api/sessions/pairing/claim", { code: issued.body.code }),
    call("/api/sessions/pairing/claim", { code: issued.body.code }),
  ]);
  assert.equal(claims.filter((x) => x.status === 200).length, 1);
  assert.equal(
    claims.find((x) => x.status === 200).body.connection_token,
    token,
  );
  assert.equal(
    (await call("/api/sessions/connect", { session_id: id })).status,
    403,
  );
  const connected = await router.fetch(
    new Request("https://buildmylogicxyz.vercel.app/api/sessions/connect", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-bml-session-token": token,
      },
      body: JSON.stringify({ session_id: id }),
    }),
    {},
    {},
  );
  assert.equal(connected.status, 200);
  console.log(
    "PASS actual router: owner auth, wrong owner/token, atomic claim race, replay, display ID rejected, returned token connects. All external I/O mocked.",
  );
} finally {
  await vite.close();
  global.fetch = original;
  for (const key of Object.keys(process.env))
    if (!(key in env)) delete process.env[key];
  Object.assign(process.env, env);
}
