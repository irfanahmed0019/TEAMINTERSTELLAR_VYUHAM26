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
process.env.SARVAM_API_KEY = "fixture-only-not-real";
let aiCalls = 0,
  aiBody,
  invalid = false,
  duringReply;
global.fetch = async (input, o = {}) => {
  const u = new URL(input);
  if (u.hostname === "api.sarvam.ai") {
    aiCalls++;
    aiBody = JSON.parse(o.body);
    duringReply?.();
    return Response.json({
      choices: [
        {
          message: {
            content: JSON.stringify(
              invalid
                ? {}
                : {
                    guidance:
                      "Check the boundary condition. No current editor tests were run.",
                  },
            ),
          },
        },
      ],
    });
  }
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
  const call = async (path, body, auth = "owner", token) => {
    const r = await router.fetch(
      new Request("https://buildmylogicxyz.vercel.app" + path, {
        method: body ? "POST" : "GET",
        headers: {
          "content-type": "application/json",
          ...(auth ? { authorization: "Bearer " + auth } : {}),
          ...(token ? { "x-bml-session-token": token } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }),
      {},
      {},
    );
    return { status: r.status, data: await r.json() };
  };
  const start = await call("/api/sessions/start", {
    user_id: owner,
    challenge_id: "mentor-fixture",
  });
  assert.equal(start.status, 200, JSON.stringify(start));
  const id = start.data.session_id,
    token = start.data.connection_token,
    route = "/api/sessions/" + id + "/mentor-chat";
  const q = { message: "Why check zero?", task_generation: 0 };
  assert.equal((await call(route, q, "wrong")).status, 403);
  assert.equal((await call(route, q, null, "wrong")).status, 403);
  assert.equal((await call(route)).status, 405);
  assert.equal((await call(route, { ...q, message: " " })).status, 400);
  assert.equal(
    (await call(route, { ...q, message: "x".repeat(1001) })).status,
    400,
  );
  assert.equal((await call(route, { message: q.message })).status, 409);
  assert.equal((await call(route, { ...q, task_generation: 1 })).status, 409);
  assert.equal(aiCalls, 0);
  const before = JSON.stringify([...sessions]);
  const good = await call(route, q, null, token);
  assert.equal(good.status, 200, JSON.stringify(good));
  assert.match(good.data.guidance, /boundary/);
  assert.equal(aiCalls, 1);
  assert.ok(aiBody.messages[1].content.includes(q.message));
  assert.ok(!aiBody.messages[1].content.includes(token));
  assert.ok(!aiBody.messages[1].content.includes(owner));
  assert.equal(JSON.stringify([...sessions]), before);
  invalid = true;
  assert.equal((await call(route, q)).status, 503);
  ((invalid = false), duringReply);
  delete process.env.SARVAM_API_KEY;
  assert.equal((await call(route, q)).status, 503);
  process.env.SARVAM_API_KEY = "fixture-only-not-real";
  const lib = await vite.ssrLoadModule("/src/lib/learning-sessions.server.ts");
  const current = await lib.verifySession(id, true);
  current.status = "completed";
  const completed = await call(route, q, null, token);
  assert.equal(completed.status, 200, JSON.stringify(completed));
  duringReply = () => {
    current.taskGeneration = 1;
  };
  assert.equal((await call(route, q, null, token)).status, 409);
  duringReply = undefined;
  current.taskGeneration = 0;
  const savedHash = current.connectionTokenHash;
  duringReply = () => {
    current.connectionTokenHash = "revoked";
  };
  assert.equal((await call(route, q, null, token)).status, 403);
  duringReply = undefined;
  current.connectionTokenHash = savedHash;
  current.status = "expired";
  assert.equal((await call(route, q, null, token)).status, 401);
  current.status = "completed";
  const chat = await vite.ssrLoadModule("/src/lib/session-mentor.server.ts");
  const paidBefore = aiCalls;
  await assert.rejects(
    chat.sessionMentorChat(
      { ...current, userId: "1d561e07-91d0-41d6-8a07-afd2c7fb8fd5" },
      q.message,
    ),
  );
  assert.equal(aiCalls, paidBefore);
  for (let n = 0; n < 9; n++) await call(route, q, null, token);
  assert.equal((await call(route, q, null, token)).status, 429);
  console.log(
    "PASS actual router: owner/token auth, method, bounds, exact generation, no provider calls on rejected requests, provider receives question but no IDs/token/source, valid reply, malformed/missing AI 503, completed session chat, in-flight generation409/token revocation403, rate cap. Mock provider/DB ONLY, no paid AI.",
  );
} finally {
  await vite.close();
  global.fetch = original;
  for (const k of Object.keys(process.env))
    if (!(k in env)) delete process.env[k];
  Object.assign(process.env, env);
}
