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
      activeTextEditor: {
        document: {
          uri: { scheme: "file", fsPath: "/outside/k.py" },
          version: 1,
          isDirty: false,
          isClosed: false,
          save: async () => true,
        },
      },
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
test("unknown internal practice command is blocked, never executed and never emits test evidence", async () => {
  const f = await sidebarFixture();
  f.sidebar.connection = { sessionId: "BML-ABCDE" };
  f.sidebar.session = {
    session_id: "BML-ABCDE",
    checkpoints: [
      {
        index: 0,
        status: "active",
        title: "Unknown",
        detail: "",
        evaluator: {
          id: "unsupported",
          command: "buildmylogic:unsupported",
          expectedOutputIncludes: ["FAKE"],
        },
      },
    ],
  };
  let runs = 0;
  f.sidebar.runCommand = async () => {
    runs++;
    throw Error("not allowed");
  };
  assert.deepEqual(await f.sidebar.runNextCheckpoint("/project", ""), []);
  assert.equal(runs, 0);
  assert.ok(!f.posts.some((p) => p.type === "tests"));
});
test("every allowlisted practice routes only its fixed ID after consent, cancels without running and does not replace practice with project repair", async () => {
  for (const id of [
    "python-loops-fibonacci-v1",
    "python-conditions-sign-v1",
    "python-functions-double-v1",
    "python-strings-vowels-v1",
  ]) {
    const f = await sidebarFixture();
    f.sidebar.connection = { sessionId: "BML-ABCDE" };
    f.sidebar.session = {
      session_id: "BML-ABCDE",
      challenge_id: id,
      checkpoints: [
        {
          index: 0,
          status: "active",
          title: "Practice",
          detail: "",
          evaluator: {
            id,
            command: "buildmylogic:" + id,
            expectedOutputIncludes: ["BML_PRACTICE_PASS:" + id],
          },
        },
      ],
    };
    let commands = [];
    f.sidebar.runCommand = async (command) => {
      commands.push(command);
      return { code: 3, passed: false, output: "Missing main.py" };
    };
    f.vscode.window.showWarningMessage = async () => undefined;
    assert.deepEqual(
      await f.sidebar.runNextCheckpoint("/project", "ignored"),
      [],
    );
    assert.equal(commands.length, 0);
    f.vscode.window.showWarningMessage = async () => "Run my Python code";
    f.context.asAbsolutePath = (p) => "/extension/" + p;
    assert.deepEqual(
      await f.sidebar.runNextCheckpoint("/project", "ignored"),
      [],
    );
    assert.equal(commands.length, 1);
    assert.ok(commands[0].includes("'" + id + "'"));
    f.sidebar.evidenceConsent = true;
    f.vscode.workspace.isTrusted = true;
    f.vscode.window.showQuickPick = () => {
      throw Error("practice must not be overwritten");
    };
    await f.sidebar.offerProjectChallenge();
  }
});
test("active-file consent rejects changed document, failed save, and uses quoted outside-workspace path", async () => {
  const f = await sidebarFixture();
  f.sidebar.connection = { sessionId: "BML-ABCDE" };
  f.sidebar.session = {
    session_id: "BML-ABCDE",
    checkpoints: [
      {
        index: 0,
        status: "active",
        title: "Practice",
        detail: "",
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
  f.context.asAbsolutePath = (p) => "/extension/" + p;
  const doc = f.vscode.window.activeTextEditor.document;
  let runs = 0;
  f.sidebar.runCommand = async (cmd, cwd, timeout, validate) => {
    assert.equal(cwd, "/outside");
    assert.ok(cmd.includes("k.py"));
    assert.equal(validate(), true);
    runs++;
    return { code: 3, output: "missing", passed: false };
  };
  f.vscode.window.showWarningMessage = async () => {
    doc.version++;
    return "Run my Python code";
  };
  assert.deepEqual(await f.sidebar.runNextCheckpoint("/project", ""), []);
  assert.equal(runs, 0);
  f.vscode.window.showWarningMessage = async () => "Run my Python code";
  doc.isDirty = true;
  doc.save = async () => false;
  assert.deepEqual(await f.sidebar.runNextCheckpoint("/project", ""), []);
  assert.equal(runs, 0);
  doc.isDirty = false;
  assert.deepEqual(await f.sidebar.runNextCheckpoint("/project", ""), []);
  assert.equal(runs, 1);
});
test("in-flight prior-task local result is discarded after generation change; valid same generation posted", async () => {
  for (const change of [true, false]) {
    const f = await sidebarFixture();
    f.sidebar.connection = { sessionId: "BML-ABCDE" };
    f.sidebar.session = {
      session_id: "BML-ABCDE",
      challenge_id: "python-loops-fibonacci-v1",
      task_generation: 2,
      attempts: 0,
      status: "active",
    };
    f.api.runPlan = async () => ({ run_plan: { command: "ignored" } });
    let posts = [];
    f.api.test = async (id, payload) => {
      posts.push(payload);
      return {};
    };
    f.sidebar.runNextCheckpoint = async () => {
      if (change)
        f.sidebar.session = { ...f.sidebar.session, task_generation: 3 };
      return [
        { index: 0, passed: true, output: "ok", evidence_kind: "assertion" },
      ];
    };
    f.sidebar.results.show = async () => {};
    await f.sidebar.test();
    assert.equal(posts.length, change ? 0 : 1);
    if (!change) assert.equal(posts[0].task_generation, 2);
  }
});

test("completed authored practice Run and Submit show saved result, no API, file read, consent or source upload", async () => {
  const f = await sidebarFixture();
  f.sidebar.connection = { sessionId: "BML-ABCDE" };
  f.sidebar.session = {
    session_id: "BML-ABCDE",
    challenge_id: "python-conditions-sign-v1",
    status: "completed",
    attempts: 1,
    test_score: { passed: 1, total: 1 },
    checkpoints: [
      { lastOutput: "BML_PRACTICE_PASS:python-conditions-sign-v1" },
    ],
  };
  let updates = [],
    shown = 0;
  f.sidebar.results.update = (...args) => updates.push(args);
  f.sidebar.results.show = async () => {
    shown++;
  };
  for (const name of ["runPlan", "test", "submit"])
    f.api[name] = async () => {
      throw Error("unexpected API " + name);
    };
  f.vscode.window.showWarningMessage = () => {
    throw Error("must not ask upload/execute consent");
  };
  f.vscode.workspace.findFiles = () => {
    throw Error("must not enumerate files");
  };
  f.vscode.workspace.fs = {
    readFile: () => {
      throw Error("must not read source");
    },
  };
  for (const command of ["runTests", "submit"])
    await f.sidebar.handle({ command });
  assert.equal(shown, 2);
  assert.equal(updates.length, 2);
  assert.equal(f.sidebar.session.attempts, 1);
  assert.equal(f.sidebar.session.test_score.passed, 1);
  assert.ok(f.posts.every((p) => p.type === "status" && !p.error));
  assert.match(f.posts.at(-1).text, /result is saved/);
});
test("completed project task keeps existing project submit flow, not authored-practice no-op", async () => {
  const f = await sidebarFixture();
  f.sidebar.connection = { sessionId: "BML-ABCDE" };
  f.sidebar.session = {
    session_id: "BML-ABCDE",
    challenge_id: "project-other",
    status: "completed",
  };
  let consent = 0;
  f.vscode.workspace.isTrusted = true;
  f.vscode.window.showWarningMessage = async () => {
    consent++;
    return undefined;
  };
  await f.sidebar.submitProject();
  assert.equal(consent, 1);
});
test("paired session chat sends only explicit text and bound generation, never source or full-course credentials", async () => {
  const f = await sidebarFixture();
  f.sidebar.connection = { sessionId: "BML-CHAT" };
  f.sidebar.session = {
    session_id: "BML-CHAT",
    challenge_id: "python-conditions-sign-v1",
    task_generation: 3,
    attempts: 0,
  };
  let calls = [];
  f.api.mentorChat = async (...args) => {
    calls.push(args);
    return { guidance: "Zero needs its own branch. Test zero separately." };
  };
  f.vscode.workspace.fs = {
    readFile: () => {
      throw Error("no source read");
    },
  };
  f.vscode.env = {
    openExternal: () => {
      throw Error("no website");
    },
  };
  await f.sidebar.handle({ command: "mentorChat", message: "Why zero?" });
  assert.deepEqual(calls, [["BML-CHAT", "Why zero?", 3]]);
  assert.equal(f.posts.at(-1).type, "mentorReply");
  assert.equal(f.sidebar.session.attempts, 0);
});
test("chat errors keep tests unchanged, malformed replies do not become praise, stale generation reply discarded", async () => {
  const f = await sidebarFixture();
  f.sidebar.connection = { sessionId: "BML-CHAT" };
  f.sidebar.session = {
    session_id: "BML-CHAT",
    challenge_id: "python-conditions-sign-v1",
    task_generation: 0,
    attempts: 2,
  };
  f.api.mentorChat = async () => {
    throw Error("Rate limit. Wait a minute.");
  };
  await f.sidebar.handle({ command: "mentorChat", message: "Why?" });
  assert.equal(f.posts.at(-1).type, "mentorError");
  assert.match(f.posts.at(-1).text, /unchanged/);
  assert.equal(f.sidebar.session.attempts, 2);
  f.api.mentorChat = async () => ({});
  await f.sidebar.handle({ command: "mentorChat", message: "Why?" });
  assert.equal(f.posts.at(-1).type, "mentorError");
  const before = f.posts.length;
  f.api.mentorChat = async () => {
    f.sidebar.session = { ...f.sidebar.session, task_generation: 1 };
    return { guidance: "OLD TASK REPLY" };
  };
  await f.sidebar.handle({ command: "mentorChat", message: "Why?" });
  assert.equal(f.posts.length, before);
});
test("oversized/blank session chat never calls API", async () => {
  const f = await sidebarFixture();
  f.sidebar.connection = { sessionId: "BML-CHAT" };
  f.sidebar.session = { session_id: "BML-CHAT" };
  f.api.mentorChat = () => {
    throw Error("must not send");
  };
  for (const message of [" ", "x".repeat(1001)])
    await f.sidebar.handle({ command: "mentorChat", message });
  assert.equal(f.posts.filter((p) => p.type === "mentorError").length, 2);
});
