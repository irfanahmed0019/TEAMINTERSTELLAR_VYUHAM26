import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { restoreCloudState } from "./cloud-restore.ts";

function harness() {
  let epoch = 1,
    uid = "owner-a",
    renderedUid = uid,
    local = { history: ["local"] },
    resolveRead;
  const storage = new Map([["loop.state.uid", uid]]),
    effects = [],
    applied = [];
  const read = new Promise((r) => {
    resolveRead = r;
  });
  const dependencies = {
    "./cloud-readiness": { setReadyCloudOwner: () => {} },
    "./local-recovery": {
      RECOVERY_OWNER_KEY: "loop.recovery.owner",
      RETAINED_PREFIX: "retained.",
      requiresAccountRecovery: (cached, incoming, state) =>
        cached !== incoming && state.history.length > 0,
    },
    "./publish-conquest": { publishSavedConquests: async () => {} },
    "./demo-mode": {
      isPublicDemo: () => false,
      learnerStorage: {
        getItem: (k) => storage.get(k) ?? null,
        setItem: (k, v) => storage.set(k, v),
      },
    },
    "./cloud-sync-uid": {
      LOOP_STATE_UID_KEY: "loop.state.uid",
      localStateBelongsToOtherAccount: (cached, incoming) =>
        !!incoming && cached !== incoming,
    },
    "@tanstack/react-router": { useLocation: () => "/auth/dashboard" },
    react: {
      useEffect: (fn) => effects.push(fn),
      useRef: (current) => ({ current }),
      useState: (v) => [v, () => {}],
      useSyncExternalStore: () => {},
    },
    "react/jsx-runtime": {
      jsx: (component, props) =>
        typeof component === "function" ? component(props) : null,
    },
    "./auth": {
      getAuthSession: () => (uid ? { uid } : null),
      getAuthEpoch: () => epoch,
      useAuth: () => ({ uid: renderedUid }),
      loadLoopStateFromCloud: () => read,
      saveLoopStateToCloud: async () => true,
    },
    "./cloud-restore": { restoreCloudState },
    "./loop-store": {
      getLoopState: () => local,
      normalizeLoopState: (x) => x,
      resetLoop: () => {
        local = { history: [] };
      },
      setLoopState: (fn) => {
        local = fn(local);
        applied.push(local);
      },
      useLoop: () => local,
    },
  };
  const code = ts.transpileModule(
    fs.readFileSync(
      process.env.BML_CLOUD_RACE_SOURCE ||
        new URL("./cloud-sync.tsx", import.meta.url),
      "utf8",
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    },
  ).outputText;
  const context = {
    exports: {},
    require: (id) => {
      assert.ok(id in dependencies, id);
      return dependencies[id];
    },
    window: {
      addEventListener: () => {},
      removeEventListener: () => {},
      setTimeout: () => 1,
      clearTimeout: () => {},
    },
    console,
  };
  vm.runInNewContext(code, context, { filename: "actual-cloud-sync.cjs" });
  return {
    storage,
    applied,
    render: () => {
      context.exports.CloudSync();
      effects.forEach((fn) => fn());
    },
    finish: async () => {
      resolveRead({ history: ["cloud"] });
      await new Promise((r) => setTimeout(r, 0));
    },
    newEpoch: () => {
      epoch++;
    },
    setUid: (v) => {
      uid = v;
    },
    get local() {
      return local;
    },
  };
}
test("actual CloudSync: ordinary same-owner restore applies cloud", async () => {
  const h = harness();
  h.render();
  await h.finish();
  assert.equal(h.applied.length, 1);
});
test("actual CloudSync: same-UID logout/login epoch invalidates pending restore before cleanup", async () => {
  const h = harness();
  h.render();
  h.newEpoch();
  await h.finish();
  assert.equal(h.applied.length, 0);
});
test("actual CloudSync: recovery appearing during read preserves local copy", async () => {
  const h = harness();
  h.render();
  h.storage.set("loop.recovery.owner", "unbound");
  await h.finish();
  assert.equal(h.applied.length, 0);
  assert.equal(h.storage.get("loop.recovery.owner"), "unbound");
});
test("actual CloudSync: removed ownership marker during read invalidates restore", async () => {
  const h = harness();
  h.render();
  h.storage.delete("loop.state.uid");
  await h.finish();
  assert.equal(h.applied.length, 0);
});
test("actual CloudSync: stale rendered auth cannot claim marker or create recovery after revoke", async () => {
  const h = harness();
  h.storage.delete("loop.state.uid");
  h.setUid(null);
  h.render();
  await h.finish();
  assert.equal(h.storage.has("loop.state.uid"), false);
  assert.equal(h.storage.has("loop.recovery.owner"), false);
  assert.equal(h.applied.length, 0);
});
