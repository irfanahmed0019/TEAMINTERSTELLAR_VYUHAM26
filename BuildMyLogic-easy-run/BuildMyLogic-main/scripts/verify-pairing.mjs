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
    if (o.method === "POST") {
      const row = JSON.parse(o.body);
      sessions.set(row.session_id, row);
      return new Response(null, { status: 204 });
    }
    const id = u.searchParams.get("session_id")?.slice(3);
    return Response.json(sessions.has(id) ? [sessions.get(id)] : []);
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
  const practice = await call(
    "/api/sessions/start",
    {
      user_id: owner,
      practice_task: "python-loops-fibonacci-v1",
      challenge_id: "ignored",
      instructions: "untrusted override",
    },
    "owner",
  );
  assert.equal(practice.status, 200);
  assert.equal(practice.body.state.challenge_id, "python-loops-fibonacci-v1");
  assert.ok(practice.body.state.instructions.includes("Fibonacci"));
  assert.equal(practice.body.state.instructions.split("\n").length, 2);
  const dir = mkdtempSync(join(tmpdir(), "bml-fib-connected-"));
  try {
    for (const [source, pass] of [
      ["for n in range(10): print(n)", false],
      ["a,b=0,1\nfor _ in range(10):\n print(a,end=' ')\n a,b=b,a+b", true],
    ]) {
      writeFileSync(join(dir, "main.py"), source);
      const local = spawnSync(
        "python3",
        [
          "-I",
          join(
            process.cwd(),
            "vscode-extension/media/python_loops_practice.py",
          ),
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
                  evaluator_id: "python-loops-fibonacci-v1",
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
    console.log(
      "PASS explicit task -> actual packaged Python wrong fails -> corrected Fibonacci passes -> actual route finite receipt complete; no AI, mock REST.",
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
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
