// Bounded integration harness: real handler and real local Python execution.
// Supabase/Judge0 transport is mocked. No real account, AI or remote runner calls.
import { createServer } from "vite";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const vite = await createServer({
  configFile: false,
  server: { middlewareMode: true },
  resolve: { alias: { "@": join(process.cwd(), "src") } },
});
let jobs = [],
  sandboxCalls = 0,
  unavailable = false;
const owner = "12345678-1234-1234-1234-123456789012";
const oldFetch = global.fetch;
const oldUrl = process.env.VITE_SUPABASE_URL,
  oldKey = process.env.VITE_SUPABASE_ANON_KEY;
process.env.VITE_SUPABASE_URL = "https://fixture.supabase.co";
process.env.VITE_SUPABASE_ANON_KEY = "fixture";
global.fetch = async (url, options = {}) => {
  url = String(url);
  if (url.startsWith("https://fixture.supabase.co/auth/v1/user"))
    return Response.json(
      { id: owner },
      {
        status:
          options.headers.authorization === "Bearer approved-fixture"
            ? 200
            : 401,
      },
    );
  if (
    url.startsWith(
      "https://ce.judge0.com/submissions/batch?base64_encoded=true",
    )
  ) {
    sandboxCalls++;
    if (unavailable) return new Response("unavailable", { status: 503 });
    if (options.method === "POST") {
      jobs = JSON.parse(options.body).submissions.map((s, i) => {
        assert.equal(s.enable_network, false);
        assert.equal(s.cpu_time_limit, 2);
        assert.equal(s.wall_time_limit, 5);
        const dir = mkdtempSync(join(tmpdir(), "bml-api-"));
        try {
          const code = Buffer.from(s.source_code, "base64").toString();
          const stdin = Buffer.from(s.stdin, "base64").toString();
          const file = join(dir, "main.py");
          writeFileSync(file, code);
          const run = spawnSync("python3", [file], {
            input: stdin,
            encoding: "utf8",
            timeout: 3000,
          });
          const enc = (x) => Buffer.from(x || "").toString("base64");
          return {
            token: "test-" + i,
            status: {
              id: run.status === 0 ? 3 : 11,
              description: run.status === 0 ? "Accepted" : "Runtime Error",
            },
            stdout: enc(run.stdout),
            stderr: enc(run.stderr),
            time: "0.02",
          };
        } finally {
          rmSync(dir, { recursive: true, force: true });
        }
      });
      return Response.json(jobs.map((j) => ({ token: j.token })));
    }
    return Response.json({ submissions: jobs });
  }
  throw Error("Unexpected network " + url);
};
try {
  const { curatedPlan } = await vite.ssrLoadModule(
    "/src/lib/curated-fallback.ts",
  );
  const { defaultStarterProfile } = await vite.ssrLoadModule(
    "/src/lib/loop-types.ts",
  );
  const basePlan = curatedPlan(defaultStarterProfile);
  for (const [passed, hintsUsed, expected] of [
    [0, 0, /One failed check is not a proven weakness/],
    [3, 1, /without a hint/],
    [3, 0, /not general mastery/],
  ]) {
    const profile = {
      ...defaultStarterProfile,
      initialCodingDiagnostic: {
        version: 1,
        language: "python",
        topicId: "conditions",
        submissions: [
          {
            taskId: "coding-v1:conditions:transfer",
            topicId: "conditions",
            language: "python",
            passed,
            total: 3,
            at: 100,
            hintsUsed,
            evidenceId: "initial-coding:fixture",
          },
        ],
      },
    };
    const plan = curatedPlan(profile);
    assert.match(plan.session.tasks[0].title, expected);
    assert.deepEqual(plan.missions, basePlan.missions);
    assert.equal(plan.session.totalMinutes, basePlan.session.totalMinutes);
    assert.equal(
      plan.session.tasks.reduce((n, t) => n + t.minutes, 0),
      basePlan.session.tasks.reduce((n, t) => n + t.minutes, 0),
    );
    assert.deepEqual(plan.skills, basePlan.skills);
  }
  console.log(
    "PASS real fallback roadmap first review adapts failure/hints/pass, no invented skill scores/project generation or added time",
  );
  const { handleMentorApi } = await vite.ssrLoadModule(
    "/src/lib/mentor/mentor.api.server.ts",
  );
  const request = (body, auth = true, origin = "http://localhost") =>
    new Request("http://localhost/api/mentor/diagnostic", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin,
        ...(auth ? { authorization: "Bearer approved-fixture" } : {}),
      },
      body: JSON.stringify(body),
    });
  const body = {
    taskId: "coding-v1:conditions:transfer",
    language: "python",
    code: 'n=int(input())\nprint("negative" if n<0 else "zero" if n==0 else "positive")',
  };
  const noauth = await handleMentorApi(request(body, false));
  assert.equal(noauth.status, 401);
  assert.equal(sandboxCalls, 0);
  const xsite = await handleMentorApi(
    request(body, true, "https://evil.invalid"),
  );
  assert.equal(xsite.status, 403);
  assert.equal(sandboxCalls, 0);
  const invalid = await handleMentorApi(
    request({ ...body, language: "javascript" }),
  );
  assert.equal(invalid.status, 400);
  assert.equal(sandboxCalls, 0);
  let response = await handleMentorApi(
    request({
      ...body,
      expected: "attacker",
      ownerId: "attacker",
      tests: [{ expected: "attacker" }],
      observedMs: 480000,
    }),
  );
  let data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.evidence.ownerId, owner);
  assert.equal(data.evidence.taskId, body.taskId);
  assert.equal(data.evidence.language, "python");
  assert.equal(data.evidence.performance.activeMs, 480000);
  assert.equal(data.evidence.performance.expectedMs, 480000);
  assert.equal(
    data.evidence.performance.timingQuality,
    "browser-interaction-observed",
  );
  assert.equal(data.evidence.passed, 3);
  assert.equal(data.evidence.total, 3);
  assert.equal(data.evidence.source, "server-graded initial coding tests");
  assert.match(data.scope, /independent authorship/);
  console.log(
    "PASS auth, origin, task allowlist, server expected outputs, actual Python good 3/3",
  );
  response = await handleMentorApi(
    request({
      ...body,
      code: 'print("positive")',
      observedMs: Infinity,
      hintUsed: true,
    }),
  );
  data = await response.json();
  assert.equal(data.evidence.passed, 1);
  assert.equal(data.evidence.total, 3);
  assert.equal(data.evidence.hintsUsed, 1);
  assert.equal(data.evidence.performance.timingQuality, "unavailable");
  console.log("PASS actual Python wrong boundary program 1/3");
  unavailable = true;
  response = await handleMentorApi(request(body));
  data = await response.json();
  assert.equal(data.ok, false);
  assert.equal(data.evidence, undefined);
  console.log("PASS unavailable runner returns no evidence", response.status);
} finally {
  global.fetch = oldFetch;
  if (oldUrl === undefined) delete process.env.VITE_SUPABASE_URL;
  else process.env.VITE_SUPABASE_URL = oldUrl;
  if (oldKey === undefined) delete process.env.VITE_SUPABASE_ANON_KEY;
  else process.env.VITE_SUPABASE_ANON_KEY = oldKey;
  await vite.close();
}
