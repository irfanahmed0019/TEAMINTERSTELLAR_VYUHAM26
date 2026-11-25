import test from "node:test";
import assert from "node:assert/strict";
import { sidebarHtml } from "./webviewHtml.ts";
import { build } from "esbuild";
import { createRequire } from "node:module";
test("basic extension: Mission and Progress tabs, no mentor, recovery or setup tabs", () => {
  const html = sidebarHtml("vscode-resource:");
  for (const tab of ["mission", "progress"])
    assert.ok(html.includes('data-tab="' + tab + '"'));
  for (const gone of ["mentor", "recovery", "setup"])
    assert.ok(!html.includes('data-tab="' + gone + '"'));
  assert.ok(html.includes("send('ready')"));
  assert.ok(html.includes('id="run"') && html.includes('id="submit"'));
  assert.ok(!html.includes("68%"));
  new Function(html.match(/<script>([\s\S]*)<\/script>/)[1]);
});
test("bottom results view escapes untrusted session data and starts honestly empty", async () => {
  const result = await build({
    entryPoints: ["src/resultsPanel.ts"],
    bundle: true,
    platform: "node",
    format: "cjs",
    write: false,
    plugins: [
      {
        name: "vscode-stub",
        setup(b) {
          b.onResolve({ filter: /^vscode$/ }, () => ({
            path: "vscode",
            namespace: "stub",
          }));
          b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
            contents: "export const commands={executeCommand:async()=>{}};",
          }));
        },
      },
    ],
  });
  const mod = { exports: {} };
  new Function("module", "exports", "require", result.outputFiles[0].text)(
    mod,
    mod.exports,
    createRequire(import.meta.url),
  );
  const p = new mod.exports.ResultsPanel();
  const view = { webview: { options: {}, html: "" } };
  p.resolveWebviewView(view);
  assert.ok(view.webview.html.includes("No test results yet"));
  p.update({
    session_id: "qa",
    title: "<script>leak()</script>",
    attempts: 1,
    test_score: { passed: 0, total: 1 },
    checkpoints: [
      {
        title: "<img onerror=leak()>",
        status: "failed",
        lastOutput: "<script>bad()</script>",
      },
    ],
  });
  assert.ok(!view.webview.html.includes("<script>"));
  assert.ok(view.webview.html.includes("&lt;script&gt;"));
  assert.ok(view.webview.html.includes("client-trusted"));
});

import { executeLocalCommand } from "./processRunner.ts";
import { SessionClient } from "./sessionClient.ts";
import { mkdtempSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
test("timeout terminates descendants and reports timeout explicitly", async () => {
  const dir = mkdtempSync(join(tmpdir(), "bml-runner-"));
  try {
    const marker = join(dir, "leak");
    const r = await executeLocalCommand(
      `python3 -c "import time; time.sleep(0.6); open('${marker}','w').write('leaked')"`,
      dir,
      100,
    );
    assert.equal(r.passed, false);
    assert.match(r.output, /timed out/);
    await new Promise((r) => setTimeout(r, 800));
    assert.equal(existsSync(marker), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("command output bounded and nonzero exit is a failure", async () => {
  const r = await executeLocalCommand(
    `python3 -c "print('x'*20000);raise SystemExit(7)"`,
    tmpdir(),
    3000,
  );
  assert.equal(r.code, 7);
  assert.equal(r.passed, false);
  assert.ok(r.output.length <= 6000);
});
test("connection failure stays on configured host", async () => {
  const old = globalThis.fetch,
    calls = [];
  globalThis.fetch = async (url) => {
    calls.push(url);
    return new Response(JSON.stringify({ ok: false, error: "expired" }), {
      status: 410,
    });
  };
  try {
    await assert.rejects(
      new SessionClient("http://127.0.0.1:19999").connect("BML-LOCALONLY"),
      /expired/,
    );
    assert.deepEqual(calls, ["http://127.0.0.1:19999/api/sessions/connect"]);
  } finally {
    globalThis.fetch = old;
  }
});

test("unscored prior output is labeled historical; changed task generation clears cached output", async () => {
  const result = await build({
    entryPoints: ["src/resultsPanel.ts"],
    bundle: true,
    platform: "node",
    format: "cjs",
    write: false,
    plugins: [
      {
        name: "vscode-stub",
        setup(b) {
          b.onResolve({ filter: /^vscode$/ }, () => ({
            path: "vscode",
            namespace: "stub",
          }));
          b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
            contents: "export const commands={executeCommand:async()=>{}};",
          }));
        },
      },
    ],
  });
  const mod = { exports: {} };
  new Function("module", "exports", "require", result.outputFiles[0].text)(
    mod,
    mod.exports,
    createRequire(import.meta.url),
  );
  const panel = new mod.exports.ResultsPanel(),
    view = { webview: { options: {}, html: "" } };
  panel.resolveWebviewView(view);
  panel.update({
    session_id: "same",
    challenge_id: "old",
    task_generation: 0,
    attempts: 0,
    checkpoints: [
      {
        title: "Old output",
        status: "active",
        lastOutput: "BML_PRACTICE_PASS:old",
      },
    ],
  });
  assert.match(view.webview.html, /No test results yet/);
  assert.match(
    view.webview.html,
    /Previous command output only. No current test result is recorded/,
  );
  panel.update(
    {
      session_id: "same",
      challenge_id: "old",
      task_generation: 0,
      attempts: 1,
      test_score: { passed: 1, total: 1 },
      checkpoints: [],
    },
    "OLD_PRIVATE_OUTPUT",
  );
  assert.ok(!view.webview.html.includes("Previous command output only"));
  panel.update({
    session_id: "same",
    challenge_id: "new",
    task_generation: 1,
    attempts: 0,
    checkpoints: [],
  });
  assert.ok(!view.webview.html.includes("OLD_PRIVATE_OUTPUT"));
  assert.match(view.webview.html, /No test results yet/);
});
import { mentorPreview } from "./webviewHtml.ts";
test("pairing form is disabled while a saved session restores", () => {
  const html = sidebarHtml("vscode-resource:");
  assert.ok(html.includes("m.type==='restoring'"));
  assert.ok(
    html.includes("$('pairCode').disabled=$('pairButton').disabled=!!m.on"),
  );
  new Function(html.match(/<script>([\s\S]*)<\/script>/)[1]);
});
test("pairing form is re-enabled when a session renders or on disconnect", () => {
  const html = sidebarHtml("vscode-resource:");
  const on = "$('pairCode').disabled=$('pairButton').disabled=false;";
  assert.ok(html.includes("lastSync=Date.now();" + on));
  assert.ok(html.includes("if(m.type==='disconnected'){current=null;" + on));
});
test("a failed evidence share after connect does not drop the saved session", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("./extension.ts", import.meta.url), "utf8");
  const i = src.indexOf(
    "this.startLiveSync();\n      // The session is already connected",
  );
  assert.ok(i > 0);
  const block = src.slice(i, i + 700);
  assert.ok(
    /try \{\s*await this\.consentEvidence\(\);\s*\} catch \(evidenceError\)/.test(
      block,
    ),
  );
});
