import test from "node:test";
import assert from "node:assert/strict";
import { normalizePairingCode, pairingApiOrigin } from "./pairingCode.ts";
test("pairing capability normalizes grouping/case but never confuses public session id or arbitrary input", () => {
  for (const value of ["ABCD2345", "abcd-2345", " ABCD 2345 "])
    assert.equal(normalizePairingCode(value), "ABCD2345");
  for (const value of [
    "BML-ABCDE",
    "123456",
    "ABCD23456",
    "ABCDO234",
    "ABCDI234",
    "ABCD1234",
    "ABCD\n2345",
    "https://site.invalid/ABCD2345",
    "<script>",
  ])
    assert.equal(normalizePairingCode(value), null);
});
test("pairing only sends to exact official origin or loopback development, never workspace-controlled external origin", () => {
  assert.equal(
    pairingApiOrigin("https://buildmylogicxyz.vercel.app/"),
    "https://buildmylogicxyz.vercel.app",
  );
  assert.equal(
    pairingApiOrigin("http://127.0.0.1:8080"),
    "http://127.0.0.1:8080",
  );
  assert.equal(
    pairingApiOrigin("http://localhost:8080"),
    "http://localhost:8080",
  );
  for (const value of [
    "https://buildmylogicxyz.vercel.app.attacker.invalid",
    "https://user:pass@buildmylogicxyz.vercel.app",
    "https://attacker.invalid",
    "http://buildmylogicxyz.vercel.app",
    "https://buildmylogicxyz.vercel.app?send=secret",
    "https://buildmylogicxyz.vercel.app#fragment",
    "file:///tmp/app",
    "http://127.0.0.1.attacker.invalid",
  ])
    assert.throws(() => pairingApiOrigin(value), /No code was sent/);
});
import { claimPairingCode } from "./pairingCode.ts";
test("claim sends normalized capability in POST body once, no token/cookie header, refuses redirects and validates secret result", async () => {
  const old = globalThis.fetch,
    calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return Response.json({
      ok: true,
      session_id: "BML-ABCDE",
      connection_token: "x".repeat(43),
    });
  };
  try {
    const claim = await claimPairingCode(
      "https://buildmylogicxyz.vercel.app",
      "abcd-2345",
    );
    assert.equal(claim.session_id, "BML-ABCDE");
    assert.equal(calls.length, 1);
    const { url, options } = calls[0];
    assert.equal(
      url,
      "https://buildmylogicxyz.vercel.app/api/sessions/pairing/claim",
    );
    assert.deepEqual(JSON.parse(options.body), { code: "ABCD2345" });
    assert.equal(options.redirect, "error");
    assert.equal(options.credentials, "omit");
    assert.deepEqual(options.headers, { "Content-Type": "application/json" });
    await assert.rejects(claimPairingCode("https://evil.invalid", "ABCD2345"));
    assert.equal(calls.length, 1);
  } finally {
    globalThis.fetch = old;
  }
});
test("no raw server/network error can echo pairing capability or token; no retry on rejected/consumed/lost response", async () => {
  const old = globalThis.fetch;
  let calls = 0;
  try {
    for (const response of [
      new Response("ABCD2345 x-secret", { status: 400 }),
      new Response("ABCD2345", { status: 429 }),
      Response.json({
        ok: true,
        session_id: "BML-X",
        connection_token: "ABCD2345",
      }),
      Response.json({
        ok: true,
        session_id: "BML-ABCDE",
        connection_token: "too-short",
      }),
      new Response("notjson", { status: 200 }),
    ]) {
      globalThis.fetch = async () => {
        calls++;
        return response;
      };
      const before = calls;
      await assert.rejects(
        claimPairingCode("https://buildmylogicxyz.vercel.app", "ABCD2345"),
        (error) =>
          !error.message.includes("ABCD2345") &&
          !error.message.includes("x-secret"),
      );
      assert.equal(calls, before + 1);
    }
    globalThis.fetch = async () => {
      calls++;
      throw Error("redirect error ABCD2345");
    };
    const before = calls;
    await assert.rejects(
      claimPairingCode("https://buildmylogicxyz.vercel.app", "ABCD2345"),
      /No automatic retry/,
    );
    assert.equal(calls, before + 1);
  } finally {
    globalThis.fetch = old;
  }
});
import { build } from "esbuild";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const nativeRequire = createRequire(import.meta.url);
async function sidebarFixture() {
  const result = await build({
    stdin: {
      contents:
        readFileSync("src/extension.ts", "utf8") +
        "\nexport {Sidebar as TestSidebar};",
      resolveDir: process.cwd() + "/src",
      loader: "ts",
    },
    bundle: true,
    platform: "node",
    format: "cjs",
    write: false,
    external: ["vscode"],
  });
  const mod = { exports: {} },
    settings = [],
    stored = new Map();
  const events = {};
  const listen = (name) => (fn) => {
    events[name] = fn;
    return {
      dispose() {
        delete events[name];
      },
    };
  };
  const vscode = {
    ConfigurationTarget: { Global: 1 },
    window: {
      state: { focused: true },
      onDidChangeWindowState: listen("focus"),
    },
    languages: { onDidChangeDiagnostics: listen("diagnostics") },
    workspace: {
      workspaceFolders: [{ uri: { fsPath: "/project" } }],
      onDidChangeTextDocument: listen("edit"),
      onDidSaveTextDocument: listen("save"),
      asRelativePath: (uri) => uri.fsPath.replace("/project/", ""),
      getConfiguration: () => ({
        update: async (...args) => {
          settings.push(args);
        },
      }),
    },
  };
  new Function("module", "exports", "require", result.outputFiles[0].text)(
    mod,
    mod.exports,
    (name) => (name === "vscode" ? vscode : nativeRequire(name)),
  );
  const calls = [],
    api = {
      base: "https://buildmylogicxyz.vercel.app",
      getBaseUrl() {
        return this.base;
      },
      setSessionToken(token) {
        this.token = token;
      },
      connect: async (id) => {
        calls.push({ id, token: api.token });
        return { session: { session_id: id } };
      },
    };
  const context = {
    secrets: {
      store: async (k, v) => {
        stored.set(k, v);
      },
      get: async (k) => stored.get(k),
      delete: async (k) => stored.delete(k),
    },
  };
  const sidebar = new mod.exports.TestSidebar(api, { update() {} }, context);
  const posts = [];
  sidebar.post = (m) => posts.push(m);
  const syncs = [];
  sidebar.startLiveSync = () => {
    syncs.push(true);
  };
  sidebar.consentEvidence = async () => {
    calls.push("consent");
  };
  sidebar.checkSetup = async () => {};
  sidebar.notifyConquests = async () => {};
  return {
    sidebar,
    api,
    stored,
    settings,
    calls,
    posts,
    events,
    context,
    vscode,
    syncs,
  };
}
test("actual sidebar claims -> SecretStorage -> existing authenticated connect, no secret in settings/messages", async () => {
  const f = await sidebarFixture(),
    old = globalThis.fetch;
  globalThis.fetch = async () =>
    Response.json({
      ok: true,
      session_id: "BML-ABCDE",
      connection_token: "x".repeat(43),
    });
  try {
    await f.sidebar.pair("ABCD2345");
    assert.equal(
      f.stored.get("bml.session.https://buildmylogicxyz.vercel.app:BML-ABCDE"),
      "x".repeat(43),
    );
    assert.deepEqual(f.calls, [
      { id: "BML-ABCDE", token: "x".repeat(43) },
      "consent",
    ]);
    assert.ok(!JSON.stringify(f.posts).includes("x".repeat(43)));
    assert.ok(!JSON.stringify(f.settings).includes("x".repeat(43)));
    assert.ok(!JSON.stringify(f.settings).includes("ABCD2345"));
  } finally {
    globalThis.fetch = old;
  }
});
test("actual sidebar drops late consumed claim after disconnect or changed website without connecting", async () => {
  const old = globalThis.fetch;
  try {
    for (const change of [
      (f) => {
        f.sidebar.connectEpoch++;
      },
      (f) => {
        f.api.base = "https://evil.invalid";
      },
    ]) {
      const f = await sidebarFixture();
      let resolve;
      globalThis.fetch = () => new Promise((r) => (resolve = r));
      const work = f.sidebar.pair("ABCD2345");
      change(f);
      resolve(
        Response.json({
          ok: true,
          session_id: "BML-ABCDE",
          connection_token: "x".repeat(43),
        }),
      );
      await work;
      assert.equal(f.stored.size, 0);
      assert.equal(f.calls.length, 0);
    }
  } finally {
    globalThis.fetch = old;
  }
});
function deferred() {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
}
const settle = () => new Promise((r) => setImmediate(r));
test("race: website changes while SecretStorage read waits must never send old credential to new host", async () => {
  const f = await sidebarFixture(),
    read = deferred();
  f.context.secrets.get = () => read.promise;
  const work = f.sidebar.connect("BML-ABCDE", false);
  await settle();
  f.api.base = "https://evil.invalid";
  read.resolve("x".repeat(43));
  await work;
  assert.equal(
    f.calls.length,
    0,
    "no connect or consent may follow a changed website",
  );
});
test("race: disconnect during saved session settings write must not resurrect sync or consent", async () => {
  const f = await sidebarFixture(),
    write = deferred();
  f.vscode.workspace.getConfiguration = () => ({
    update: async () => write.promise,
  });
  const work = f.sidebar.connect("BML-ABCDE", false);
  await settle();
  f.sidebar.connectEpoch++;
  f.sidebar.connection = undefined;
  f.sidebar.session = undefined;
  write.resolve();
  await work;
  assert.equal(
    f.calls.filter((x) => x === "consent").length,
    0,
    "disconnected flow must not ask consent",
  );
  assert.equal(f.syncs.length, 0, "disconnected flow must not restart sync");
});
test("race: delayed credential write after disconnect must restore prior SecretStorage credential", async () => {
  const f = await sidebarFixture(),
    write = deferred(),
    key = "bml.session.https://buildmylogicxyz.vercel.app:BML-ABCDE";
  f.stored.set(key, "p".repeat(43));
  f.context.secrets.store = async (k, v) => {
    await write.promise;
    f.stored.set(k, v);
  };
  const old = globalThis.fetch;
  globalThis.fetch = async () =>
    Response.json({
      ok: true,
      session_id: "BML-ABCDE",
      connection_token: "x".repeat(43),
    });
  try {
    const work = f.sidebar.pair("ABCD2345");
    await settle();
    f.sidebar.connectEpoch++;
    write.resolve();
    await work;
    assert.equal(f.stored.get(key), "p".repeat(43));
    assert.equal(f.calls.length, 0);
  } finally {
    globalThis.fetch = old;
  }
});
test("serialized same-session pairings keep newest credential even if old write completes late", async () => {
  const f = await sidebarFixture(),
    first = deferred(),
    key = "bml.session.https://buildmylogicxyz.vercel.app:BML-ABCDE";
  let stores = 0;
  f.context.secrets.store = async (k, v) => {
    if (++stores === 1) await first.promise;
    f.stored.set(k, v);
  };
  const old = globalThis.fetch;
  let claims = 0;
  globalThis.fetch = async () =>
    Response.json({
      ok: true,
      session_id: "BML-ABCDE",
      connection_token: (++claims === 1 ? "x" : "y").repeat(43),
    });
  try {
    const a = f.sidebar.pair("ABCD2345");
    await settle();
    const b = f.sidebar.pair("EFGH2345");
    await settle();
    first.resolve();
    await Promise.all([a, b]);
    assert.equal(f.stored.get(key), "y".repeat(43));
    assert.deepEqual(f.calls, [
      { id: "BML-ABCDE", token: "y".repeat(43) },
      "consent",
    ]);
  } finally {
    globalThis.fetch = old;
  }
});
test("actual disconnect during pending settings update leaves no persisted session and never restarts sync", async () => {
  const f = await sidebarFixture(),
    first = deferred(),
    persisted = new Map();
  let writes = 0;
  f.vscode.workspace.getConfiguration = () => ({
    update: async (k, v) => {
      if (++writes === 1) await first.promise;
      persisted.set(k, v);
    },
  });
  const connecting = f.sidebar.connect("BML-ABCDE", false);
  await settle();
  const disconnect = f.sidebar.handle({ command: "disconnect" });
  first.resolve();
  await Promise.all([connecting, disconnect]);
  assert.equal(persisted.get("session"), undefined);
  assert.equal(f.syncs.length, 0);
  assert.equal(f.calls.filter((x) => x === "consent").length, 0);
});
test("claim storage rejection never connects and cannot expose secrets in error text", async () => {
  const f = await sidebarFixture();
  f.context.secrets.store = async () => {
    throw Error("fixture-private-value");
  };
  const old = globalThis.fetch;
  globalThis.fetch = async () =>
    Response.json({
      ok: true,
      session_id: "BML-ABCDE",
      connection_token: "x".repeat(43),
    });
  try {
    await f.sidebar.pair("ABCD2345");
    assert.equal(f.calls.length, 0);
    assert.ok(!JSON.stringify(f.posts).includes("fixture-private-value"));
    assert.ok(!JSON.stringify(f.posts).includes("x".repeat(43)));
  } finally {
    globalThis.fetch = old;
  }
});
test("actual desktop event flow: only connected consented safe-workspace edits count; focus loss flushes final active interval, idle capped", async () => {
  const f = await sidebarFixture(),
    oldNow = Date.now;
  let now = 100000;
  Date.now = () => now;
  const activity = [],
    saved = [];
  f.api.event = async (id, type, payload) => {
    activity.push({ id, type, payload });
    return {};
  };
  f.sidebar.recordFileEvidence = async (doc) => saved.push(doc.uri.fsPath);
  const doc = (fsPath) => ({
    uri: { fsPath, scheme: "file" },
    languageId: "python",
  });
  try {
    f.sidebar.installEvidenceSubscriptions();
    assert.equal(
      Object.keys(f.events).length,
      0,
      "no watchers before authenticated connection/consent",
    );
    f.sidebar.connection = { sessionId: "BML-ABCDE" };
    f.sidebar.session = { session_id: "BML-ABCDE" };
    f.sidebar.evidenceConsent = true;
    f.sidebar.installEvidenceSubscriptions();
    assert.equal(
      f.sidebar.activityAt,
      0,
      "file merely open is not evidence of active coding",
    );
    f.events.edit({ document: doc("/outside/file.py") });
    assert.equal(f.sidebar.activityAt, 0);
    f.events.edit({ document: doc("/project/.env") });
    assert.equal(f.sidebar.activityAt, 0);
    f.events.edit({ document: doc("/project/main.py") });
    now += 5000;
    await f.sidebar.flushActivity();
    assert.equal(activity.at(-1).payload.active_ms, 5000);
    now += 2000;
    f.vscode.window.state.focused = false;
    f.events.focus({ focused: false });
    await settle();
    assert.equal(
      activity.at(-1).payload.active_ms,
      2000,
      "final foreground edit interval must not be lost on blur",
    );
    now += 10000;
    f.events.edit({ document: doc("/project/main.py") });
    assert.equal(
      f.sidebar.activityAt,
      0,
      "programmatic hidden edit cannot start clock",
    );
    f.events.focus({ focused: false });
    await settle();
    assert.equal(
      activity.at(-1).payload.active_ms,
      0,
      "repeated blur cannot credit hidden edit",
    );
    await f.sidebar.flushActivity();
    assert.equal(activity.at(-1).payload.active_ms, 0, "hidden time excluded");
    f.vscode.window.state.focused = true;
    f.events.focus({ focused: true });
    now += 1000;
    await f.sidebar.flushActivity();
    assert.equal(
      activity.at(-1).payload.active_ms,
      0,
      "focus without new activity must not restart clock",
    );
    f.events.save(doc("/project/main.py"));
    await settle();
    assert.deepEqual(saved, ["/project/main.py"]);
    now += 60000;
    await f.sidebar.flushActivity();
    assert.equal(
      activity.at(-1).payload.active_ms,
      30000,
      "idle edit window capped at30s",
    );
    f.sidebar.clearEvidenceSubscriptions();
    assert.equal(Object.keys(f.events).length, 0);
    const count = activity.length;
    await f.sidebar.flushActivity();
    assert.equal(activity.length, count, "disconnect/no consent stops timing");
  } finally {
    f.sidebar.clearEvidenceSubscriptions();
    Date.now = oldNow;
  }
});

test("pending container blocks Run, Submit and Failed without any API evidence or file upload", async () => {
  const f = await sidebarFixture();
  f.sidebar.connection = { sessionId: "BML-ABCDE" };
  f.sidebar.session = {
    session_id: "BML-ABCDE",
    challenge_id: "project-context-pending",
    attempts: 0,
  };
  const calls = [];
  for (const name of ["runPlan", "test", "submit", "fail"])
    f.api[name] = async () => {
      calls.push(name);
      throw Error("must not call " + name);
    };
  for (const command of ["runTests", "submit", "failed"])
    await f.sidebar.handle({ command });
  await f.sidebar.test();
  await f.sidebar.submitProject();
  assert.deepEqual(calls, []);
  assert.equal(f.sidebar.session.attempts, 0);
  assert.equal(f.posts.filter((p) => p.type === "status").length, 5);
  assert.ok(f.posts.every((p) => p.type !== "tests"));
});
test("loop practice requires explicit local-code consent before evaluator runs; blocked read records nothing", async () => {
  const f = await sidebarFixture();
  f.sidebar.connection = { sessionId: "BML-ABCDE" };
  f.sidebar.session = {
    session_id: "BML-ABCDE",
    checkpoints: [
      {
        index: 0,
        title: "Loops",
        detail: "",
        status: "active",
        evaluator: {
          id: "python-loops-fibonacci-v1",
          command: "buildmylogic:python-loops-fibonacci-v1",
          expectedOutputIncludes: [
            "BML_PRACTICE_PASS:python-loops-fibonacci-v1",
          ],
        },
      },
    ],
  };
  let runs = 0;
  f.sidebar.runCommand = async () => {
    runs++;
    return { code: 3, passed: false, output: "Missing main.py" };
  };
  f.vscode.window.showWarningMessage = async () => undefined;
  assert.deepEqual(
    await f.sidebar.runNextCheckpoint("/project", "DO NOT EXECUTE"),
    [],
  );
  assert.equal(runs, 0);
  f.vscode.window.showWarningMessage = async () => "Run my Python code";
  f.context.asAbsolutePath = (p) => "/extension/" + p;
  assert.deepEqual(
    await f.sidebar.runNextCheckpoint("/project", "DO NOT EXECUTE"),
    [],
  );
  assert.equal(runs, 1);
});
