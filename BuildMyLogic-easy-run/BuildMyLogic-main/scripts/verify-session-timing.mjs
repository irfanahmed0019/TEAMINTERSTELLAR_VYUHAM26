// Actual server router; isolated mock auth/database. No real cloud, code, user or AI.
import { createServer } from "vite";
import { join } from "node:path";
import assert from "node:assert/strict";
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
const originalNow = Date.now;
let clock = originalNow();
Date.now = () => clock;
try {
  const router = (await vite.ssrLoadModule("/src/server.ts")).default;
  const call = async (path, body, token) => {
    const r = await router.fetch(
      new Request("https://buildmylogicxyz.vercel.app" + path, {
        method: body ? "POST" : "GET",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer owner",
          ...(token ? { "x-bml-session-token": token } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }),
      {},
      {},
    );
    const data = await r.json();
    assert.equal(r.status, 200, JSON.stringify(data));
    return data;
  };
  const started = await call("/api/sessions/start", {
      user_id: owner,
      challenge_id: "timing-fixture",
    }),
    id = started.session_id,
    token = started.connection_token;
  await call("/api/sessions/connect", { session_id: id }, token);
  const event = (event_type, payload) =>
    call("/api/sessions/" + id + "/events", { event_type, payload }, token);
  const active = async () => {
    const r = await call("/api/sessions/" + id + "/state");
    return r.state.timing.active_ms;
  };
  await event("work_pause", { paused: false });
  clock += 10000;
  await event("work_activity", { sequence: 1, active_ms: 10000 });
  assert.equal(await active(), 10000);
  await event("work_pause", { paused: true });
  clock += 20000;
  await event("work_activity", { sequence: 2, active_ms: 20000 });
  assert.equal(await active(), 10000);
  await event("work_pause", { paused: false });
  clock += 5000;
  await event("work_activity", { sequence: 3, active_ms: 5000 });
  assert.equal(await active(), 15000);
  for (let n = 0; n < 60; n++)
    await event("work_activity", { sequence: 3, active_ms: 30000 });
  assert.equal(await active(), 15000);
  clock += 1000;
  await event("work_activity", { sequence: 4, active_ms: 30000 });
  assert.equal(await active(), 16000);
  clock += 1000;
  await event("work_activity", { sequence: 5, active_ms: -100 });
  assert.equal(await active(), 16000);
  console.log(
    "PASS actual router connect ->10s active ->20s paused stays10s ->5s resumed15s ->60duplicate reports no credit ->wallclock clamp ->negative rejected. All external I/O mocked, virtual clock, no AI/live load.",
  );
} finally {
  Date.now = originalNow;
  await vite.close();
  global.fetch = original;
  for (const key of Object.keys(process.env))
    if (!(key in env)) delete process.env[key];
  Object.assign(process.env, env);
}
