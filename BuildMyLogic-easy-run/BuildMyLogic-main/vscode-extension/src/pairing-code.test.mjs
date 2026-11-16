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
  const vscode = {
    ConfigurationTarget: { Global: 1 },
    workspace: {
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
    },
  };
  const sidebar = new mod.exports.TestSidebar(api, { update() {} }, context);
  const posts = [];
  sidebar.post = (m) => posts.push(m);
  sidebar.startLiveSync = () => {};
  sidebar.consentEvidence = async () => {
    calls.push("consent");
  };
  sidebar.checkSetup = async () => {};
  sidebar.notifyConquests = async () => {};
  return { sidebar, api, stored, settings, calls, posts };
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
