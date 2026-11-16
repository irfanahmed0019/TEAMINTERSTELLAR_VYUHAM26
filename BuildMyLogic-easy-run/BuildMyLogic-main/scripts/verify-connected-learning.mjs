// ONE connected local harness. Auth + cloud REST are explicit in-memory mocks.
// The router, packaged Python inspector/evaluator, session helpers and shared web selectors are real.
// No real learner identity, external account, paid AI, or user project is used.
import { createServer } from "vite";
import { spawnSync } from "node:child_process";
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
  const start = await request("/api/sessions/start", {
    user_id: owner,
    challenge_id: "project-context-pending",
  });
  assert.equal(start.response.status, 200);
  const sid = start.data.session_id,
    token = start.data.connection_token,
    base = "/api/sessions/" + encodeURIComponent(sid);
  mkdirSync(join(dir, "shop"));
  const source = join(dir, "shop/prices.py"),
    tests = join(dir, "test_prices.py");
  writeFileSync(
    source,
    'raise RuntimeError("module must never run")\ndef sale_price(price, discount):\n    return price + discount\n',
  );
  writeFileSync(
    tests,
    "from shop.prices import sale_price\nassert sale_price(20,5)==15\nassert sale_price(4,5)==0\nassert sale_price(5,5)==0\nassert sale_price(100,20)==80\n",
  );
  const run = (args) =>
    spawnSync(
      "python3",
      [
        "-I",
        join(app, "vscode-extension/media/python_literal_repair.py"),
        ...args,
      ],
      { cwd: dir, encoding: "utf8", timeout: 10000 },
    );
  const inspected = run([
    "--inspect-partition",
    "shop/prices.py",
    "sale_price",
    "test_prices.py",
  ]);
  assert.equal(inspected.status, 0, inspected.stderr);
  const contract = JSON.parse(inspected.stdout);
  const assigned = await request(
    base + "/project-challenge",
    contract,
    null,
    token,
  );
  assert.equal(assigned.response.status, 200, JSON.stringify(assigned.data));
  const cid = assigned.data.state.challenge_id;
  const args = [
    contract.path,
    contract.function_name,
    contract.test_path,
    contract.test_digest,
    contract.arguments.join(","),
    contract.cases_digest,
    contract.partition.partition_digest,
  ];
  let state = {
    plan: {
      skills: [{ name: "React", level: 80 }],
      missions: [{ id: "original" }],
    },
    missionProgress: { original: { status: "active" } },
    activity: [],
    struggle: {
      attempts: [],
      misconceptions: [],
      ingestedSessions: [],
      celebratedIds: [],
    },
  };
  const originalPlan = state.plan,
    originalProgress = state.missionProgress;
  const importState = (remote) => {
    assert.equal(remote.verified_owner_id, owner);
    state = ingestProjectEvidence(state, remote);
    state = ingestProjectRechecks(state, remote);
    state = {
      ...state,
      projectSessions: { ...state.projectSessions, [sid]: remote },
    };
  };
  const refresh = async () => {
    const result = await request(base + "/recovery-state");
    assert.equal(result.response.status, 200, JSON.stringify(result.data));
    importState(result.data.state);
    return result.data.state;
  };
  const grade = async () => {
    const r = run(args);
    assert.ok([0, 1].includes(r.status), r.stderr);
    const event = await request(
      base + "/events",
      {
        event_type: "test_result",
        payload: {
          status: r.status === 0 ? "passed" : "failed",
          checkpoint_results: [
            {
              index: 0,
              passed: r.status === 0,
              output: r.stdout.trim(),
              evidence_kind: r.status === 0 ? "assertion" : "execution",
              evaluator_id: cid,
            },
          ],
        },
      },
      null,
      token,
    );
    assert.equal(event.response.status, 200, JSON.stringify(event.data));
    await refresh();
    return r;
  };
  assert.equal((await grade()).status, 1);
  assert.equal((await grade()).status, 1);
  assert.equal(state.struggle.attempts.length, 2);
  assert.ok(priorityLearningTopics(state).has("project-test-repair"));
  assert.equal(projectRecoverySessions(state, owner).length, 1);
  assert.equal(projectRecoverySessions(state, other).length, 0);
  assert.equal(
    competencyView(state).find((s) => s.skill === "React").observations,
    0,
  );
  assert.match(competencyContext(state), /Python project test repair/);
  writeFileSync(
    source,
    "def sale_price(price, discount):\n    if price == 20:\n        return 15\n    return 0\n",
  );
  assert.equal((await grade()).status, 0);
  let remote = await refresh();
  assert.equal(remote.status, "completed");
  assert.equal(state.struggle.misconceptions[0].status, "locked");
  const binding = projectBinding(remote);
  assert.ok(binding);
  assert.equal(
    (await request(base + "/project-recheck-ready", {}, null, token)).response
      .status,
    403,
    "extension cannot self-authorize learning",
  );
  assert.equal(
    (await request(base + "/project-recheck-ready", {}, "foreign-fixture"))
      .response.status,
    403,
  );
  assert.equal(
    (await request(base + "/project-recheck-ready", {})).response.status,
    409,
    "no owner saved lesson",
  );
  state = reviewProjectRecovery(state, remote, owner, 1);
  savedState = structuredClone(state);
  savedState.projectRecoveryReviews[sid].prediction = 0;
  assert.equal(
    (await request(base + "/project-recheck-ready", {})).response.status,
    409,
    "wrong prediction not accepted",
  );
  savedState = structuredClone(state);
  savedState.projectRecoveryReviews[sid].binding.test_digest = "f".repeat(64);
  assert.equal(
    (await request(base + "/project-recheck-ready", {})).response.status,
    409,
    "stale pins not accepted",
  );
  savedState = structuredClone(state);
  rejectWrites = true;
  assert.equal(
    (await request(base + "/project-recheck-ready", {})).response.status,
    409,
    "unsaved readiness not successful",
  );
  rejectWrites = false;
  let ready = await request(base + "/project-recheck-ready", {});
  assert.equal(ready.response.status, 200, JSON.stringify(ready.data));
  assert.equal(ready.data.state.verified_owner_id, owner);
  assert.equal(typeof ready.data.state.project_recheck_ready.at, "number");
  importState(ready.data.state);
  const firstReview = state.projectRecoveryReviews[sid].reviewed_at;
  state = reviewProjectRecovery(
    state,
    ready.data.state,
    owner,
    1,
    Date.now() + 1000,
  );
  assert.equal(state.projectRecoveryReviews[sid].reviewed_at, firstReview);
  savedState = structuredClone(state);
  ready = await request(base + "/project-recheck-ready", {});
  assert.equal(ready.response.status, 200);
  importState(ready.data.state);
  const postRecheck = async (r) =>
    request(
      base + "/project-recheck",
      {
        source_session_id: sid,
        evaluator_id: cid,
        partition_digest: binding.partition_digest,
        passed: r.status === 0,
        output: r.stdout.trim(),
      },
      null,
      token,
    );
  const reservedFailure = run(["--recheck", ...args]);
  assert.equal(reservedFailure.status, 1);
  assert.match(reservedFailure.stdout, /failed: 4/);
  rejectWrites = true;
  assert.equal(
    (await postRecheck(reservedFailure)).response.status,
    409,
    "unsaved receipt rejected",
  );
  rejectWrites = false;
  let receipt = await postRecheck(reservedFailure);
  assert.equal(receipt.response.status, 200, JSON.stringify(receipt.data));
  remote = await refresh();
  assert.equal(remote.project_recheck_receipts.at(-1).passed, 1);
  assert.equal(state.struggle.misconceptions[0].status, "locked");
  assert.equal(state.struggle.attempts[0].source, "reassessment");
  writeFileSync(
    source,
    "def sale_price(price, discount):\n    if price < discount:\n        return 0\n    return price - discount\n",
  );
  const fixed = run(["--recheck", ...args]);
  assert.equal(fixed.status, 0, fixed.stderr);
  receipt = await postRecheck(fixed);
  assert.equal(receipt.response.status, 200, JSON.stringify(receipt.data));
  remote = await refresh();
  assert.equal(state.struggle.misconceptions[0].status, "conquered");
  assert.equal(state.struggle.attempts.length, 5);
  assert.ok(state.struggle.misconceptions[0].projectRecheckReceiptId);
  assert.equal(state.plan, originalPlan);
  assert.equal(state.missionProgress, originalProgress);
  const replay = failureReplay(state.struggle.misconceptions[0]);
  assert.match(JSON.stringify(replay), /reviewed existing project tests/);
  const count = state.struggle.attempts.length;
  await postRecheck(fixed);
  await refresh();
  assert.equal(
    state.struggle.attempts.length,
    count,
    "replay does not duplicate evidence",
  );
  const restored = JSON.parse(JSON.stringify(state));
  assert.equal(restored.struggle.misconceptions[0].status, "conquered");
  assert.equal(ingestProjectRechecks(restored, remote), restored);
  writeFileSync(tests, "# changed tests\n");
  const blocked = run(["--recheck", ...args]);
  assert.equal(blocked.status, 3);
  assert.equal((await postRecheck(blocked)).response.status, 409);
  remote = await refresh();
  assert.equal(remote.project_recheck_receipts.length, 2);
  console.log(
    "PASS ONE actual local loop: project files -> packaged partition inspector -> scoped API assignment -> two actual CLI failures -> owner recovery import -> shared DNA/competency + relevant Learn lesson -> initial overfit pass stays locked -> actual route owner/cloud lesson+prediction/pin gates -> strict saved readiness (twice) -> actual changed-input1/2 stays locked -> actual corrected2/2 -> strict saved bound receipt -> shared finite recovery/replay -> reload/dedupe. Wrong owner/prediction/pins, failed DB writes and changed-test BLOCKED add no false evidence.",
  );
  console.log(
    "NOT ACCEPTED: real authenticated provider/cloud deployment, real user VS Code pairing, full generic/framework projects, independent/unseen tests, whole-project correctness, or whole resume/onboarding/camera journey. Auth/cloud REST are MOCKED. No paid calls.",
  );
} finally {
  await vite.close();
  global.fetch = oldFetch;
  for (const key of Object.keys(process.env))
    if (!(key in oldEnv)) delete process.env[key];
  Object.assign(process.env, oldEnv);
  rmSync(dir, { recursive: true, force: true });
}
