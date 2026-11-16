// ONE connected local harness. Auth + cloud REST are explicit in-memory mocks.
// The router, session helpers and saved-receipt validator are real.
// Graded pass records below are constructed expected-output fixtures, not Python execution.
// No real learner identity, external account, paid AI, or user project is used.
import { createServer } from "vite";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import assert from "node:assert/strict";
const app = process.cwd(),
  dir = mkdtempSync(join(tmpdir(), "bml-connected-"));
const oldFetch = global.fetch,
  oldEnv = { ...process.env };
const owner = "123e4567-e89b-42d3-a456-426614174000",
  other = "223e4567-e89b-42d3-a456-426614174000";
const host = "https://connected-fixture.invalid",
  db = new Map();
let savedState = null,
  rejectWrites = false;
delete process.env.SARVAM_API_KEY;
process.env.VITE_SUPABASE_URL = host;
process.env.VITE_SUPABASE_ANON_KEY = "mock-anon";
process.env.SUPABASE_SERVICE_ROLE_KEY = "mock-service";
global.fetch = async (url, options = {}) => {
  url = String(url);
  if (!url.startsWith(host + "/"))
    throw Error("UNEXPECTED NETWORK BLOCKED " + url);
  if (url.includes("/auth/v1/user")) {
    const auth = options.headers?.authorization;
    return auth === "Bearer owner-fixture"
      ? Response.json({ id: owner })
      : auth === "Bearer foreign-fixture"
        ? Response.json({ id: other })
        : Response.json({}, { status: 401 });
  }
  if (url.includes("/rest/v1/learner_memory"))
    return Response.json(
      savedState ? [{ state_json: structuredClone(savedState) }] : [],
    );
  if (url.includes("/rest/v1/learning_sessions")) {
    if (options.method === "PATCH") {
      const id = new URL(url).searchParams.get("session_id")?.slice(3),
        row = db.get(id);
      if (!row) return Response.json([]);
      const next = JSON.parse(options.body);
      db.set(id, { ...row, ...next });
      return Response.json([db.get(id)]);
    }
    if (options.method === "POST") {
      if (rejectWrites)
        return new Response("mock storage unavailable", { status: 503 });
      const row = JSON.parse(options.body);
      db.set(row.session_id, structuredClone(row));
      return new Response(null, { status: 204 });
    }
    const id = new URL(url).searchParams.get("session_id")?.slice(3),
      row = db.get(id);
    return Response.json(row ? [structuredClone(row)] : []);
  }
  throw Error("UNEXPECTED MOCK PATH " + url);
};
const vite = await createServer({
  configFile: false,
  server: { middlewareMode: true },
  resolve: { alias: { "@": join(app, "src") } },
});
try {
  const router = (await vite.ssrLoadModule("/src/server.ts")).default;
  const { ingestProjectEvidence } = await vite.ssrLoadModule(
    "/src/lib/project-evidence.ts",
  );
  const {
    projectBinding,
    reviewProjectRecovery,
    ingestProjectRechecks,
    projectRecoverySessions,
  } = await vite.ssrLoadModule("/src/lib/project-recovery.ts");
  const { competencyView, competencyContext } = await vite.ssrLoadModule(
    "/src/lib/competency.ts",
  );
  const { priorityLearningTopics } = await vite.ssrLoadModule(
    "/src/lib/adaptive-learning.ts",
  );
  const { failureReplay } = await vite.ssrLoadModule(
    "/src/lib/struggle-engine.ts",
  );
  const request = async (path, body, auth = "owner-fixture", token) => {
    const response = await router.fetch(
      new Request("http://localhost" + path, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          "content-type": "application/json",
          ...(auth ? { authorization: "Bearer " + auth } : {}),
          ...(token ? { "x-bml-session-token": token } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
      {},
      {},
    );
    const data = await response.json();
    return { response, data };
  };

  const { practiceTaskBody } = await vite.ssrLoadModule(
    "/src/lib/practice-task.ts",
  );
  const { newPracticeReassessment } = await vite.ssrLoadModule(
    "/src/lib/practice-reassessment.ts",
  );
  const {
    recordBuildSessionOutcome,
    attachReassessment,
    recordReassessmentAttempt,
    emptyStruggleState,
  } = await vite.ssrLoadModule("/src/lib/struggle-engine.ts");
  const task = "python-conditions-sign-v1";
  const start = await request("/api/sessions/start", {
    user_id: owner,
    ...practiceTaskBody(task),
  });
  assert.equal(start.response.status, 200);
  const sid = start.data.session_id,
    token = start.data.connection_token,
    base = "/api/sessions/" + sid;
  const sessionModule = await vite.ssrLoadModule(
    "/src/lib/learning-sessions.server.ts",
  );
  await sessionModule.connectLearningSession({ session_id: sid });
  let struggle = emptyStruggleState;
  for (let n = 1; n <= 2; n++)
    struggle = recordBuildSessionOutcome(struggle, {
      sessionKey: "fail" + n,
      sessionId: sid,
      verifiedOwnerId: owner,
      sourceChallengeId: task,
      topicId: "conditions",
      concept: "conditions",
      topicTitle: "Conditions",
      language: "python",
      exerciseTitle: "Original",
      completed: false,
      failed: true,
      passed: 0,
      total: 1,
      checkpoints: [
        { title: "conditions", status: "failed", lastOutput: "wrong" },
      ],
      at: n * 1000,
    }).state;
  const pid = struggle.misconceptions[0].id;
  struggle = attachReassessment(
    struggle,
    pid,
    newPracticeReassessment(task, 1, 3000),
  );
  const args = (at) => {
    const spec = struggle.misconceptions[0].reassessment;
    return {
      misconceptionId: pid,
      ownerId: owner,
      practiceStage: spec.practiceStage,
      reassessmentCreatedAt: spec.createdAt,
      at,
      constructOk: true,
      graded: spec.tests.map((t) => ({
        ...t,
        actual: t.expected,
        passed: true,
        hidden: true,
        status: "Accepted",
        stderr: "",
      })),
    };
  };
  struggle = recordReassessmentAttempt(struggle, args(4000)).state;
  savedState = { struggle };
  let result = await request(base + "/conquest", { pattern_id: pid });
  assert.equal(result.response.status, 409);
  console.log(
    "PASS actualrouter first1/2saved checkpoint cannotpublishconquest",
  );
  struggle = recordReassessmentAttempt(struggle, args(5000)).state;
  savedState = { struggle };
  result = await request(
    base + "/conquest",
    { pattern_id: pid },
    "foreign-fixture",
  );
  assert.equal(result.response.status, 403);
  result = await request(base + "/conquest", { pattern_id: pid });
  assert.equal(result.response.status, 200, JSON.stringify(result.data));
  assert.equal(result.data.state.conquest_receipts.length, 1);
  result = await request(base + "/conquest", { pattern_id: pid });
  assert.equal(result.response.status, 200);
  assert.equal(result.data.state.conquest_receipts.length, 1);
  result = await request(base + "/state", undefined, null, token);
  assert.equal(result.response.status, 200);
  assert.equal(result.data.state.conquest_receipts.length, 1);
  console.log(
    "PASS actualrouter ownercloudsaved2/2 -> persistedconquestreceipt -> extensiontokenstate seesone; replayone,wrongowner403",
  );
  savedState = {
    struggle: {
      ...struggle,
      attempts: struggle.attempts.filter((a) => a.at !== 4000),
    },
  };
  result = await request(base + "/conquest", { pattern_id: pid });
  assert.equal(result.response.status, 409);
  console.log("PASS actualrouter missingfirstpassproof409; nofake2/2receipt");
} finally {
  await vite.close();
  global.fetch = oldFetch;
  for (const key of Object.keys(process.env))
    if (!(key in oldEnv)) delete process.env[key];
  Object.assign(process.env, oldEnv);
  rmSync(dir, { recursive: true, force: true });
}
