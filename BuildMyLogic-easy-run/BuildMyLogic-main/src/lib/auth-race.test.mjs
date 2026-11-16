import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { prepareSafeSignOut } from "./local-recovery.ts";

// Execute the actual auth module with deterministic async provider boundaries.
// No Supabase network calls, credentials or real learner storage.
function harness() {
  let work = false;
  let local = {},
    saveImplementation = async () => true;
  const writes = [];
  const storage = new Map();
  let listener, resolveRead, resolveLogout;
  let cacheReady = true;
  const read = new Promise((r) => {
    resolveRead = r;
  });
  let logout = Promise.resolve();
  const user = (id = "owner-a") => ({
    user: { id, email: `${id}@example.invalid`, user_metadata: {} },
    access_token: `token-${id}`,
    expires_at: 4102444800,
  });
  const supabase = {
    auth: {
      getSession: () => read,
      signOut: () => logout,
      onAuthStateChange: (fn) => {
        listener = fn;
      },
    },
  };
  const dependencies = {
    "./cloud-readiness": {
      isReadyCloudOwner: () => true,
      setReadyCloudOwner: () => {},
    },
    "./local-recovery": {
      prepareSafeSignOut,
      RECOVERY_OWNER_KEY: "loop.recovery.owner",
      RETAINED_PREFIX: "retained.",
      hasLocalWork: () => work,
    },
    "./cloud-sync-uid": { LOOP_STATE_UID_KEY: "loop.state.uid" },
    "./demo-mode": { isPublicDemo: () => false },
    react: { useSyncExternalStore: () => null },
    "./supabase": {
      supabase,
      hasSupabaseConfig: true,
      saveLearnerStateToSupabase: async (owner, state) => {
        writes.push({ owner, state });
        return await saveImplementation(owner, state);
      },
      loadLearnerStateFromSupabase: async () => null,
      signInWithSupabaseGoogle: async () => null,
    },
    "./signout-order": {
      signOutInOrder: async (a) => {
        a.revoke();
        a.clear();
        await a.remote();
      },
    },
    "./loop-store": {
      refreshLoopCacheFromStorage: () => cacheReady,
      getLoopState: () => local,
      resetLoop: () => storage.set("loop.state.v1", "{}"),
    },
  };
  const code = ts.transpileModule(
    fs.readFileSync(new URL("./auth.ts", import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
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
      localStorage: {
        getItem: (k) => storage.get(k) ?? null,
        setItem: (k, v) => storage.set(k, v),
        removeItem: (k) => storage.delete(k),
      },
      alert: () => {},
      confirm: () => false,
    },
    Date,
    console,
  };
  vm.runInNewContext(code, context, { filename: "actual-auth.cjs" });
  const auth = context.exports;
  listener("SIGNED_IN", user());
  return {
    auth,
    writes,
    enableWork: () => {
      work = true;
      storage.set("loop.state.uid", "owner-a");
    },
    setLocal: (value) => (local = value),
    setSave: (fn) => (saveImplementation = fn),
    blockCache: () => {
      cacheReady = false;
    },
    storage,
    user,
    emit: (event, s) => listener(event, s),
    resolveRead: (session) => resolveRead({ data: { session } }),
    delayLogout: () => {
      logout = new Promise((r) => {
        resolveLogout = r;
      });
      return () => resolveLogout();
    },
  };
}
test("actual auth: getSession resolving after completed logout cannot resurrect persisted auth", async () => {
  const h = harness();
  const pending = h.auth.getAuthSessionForApi();
  assert.equal(await h.auth.signOut(), true);
  h.resolveRead(h.user());
  await pending;
  assert.equal(h.auth.getAuthSession(), null);
  assert.equal(h.storage.has("loop.auth.v1"), false);
});
test("actual auth: same-UID new login does not accept an older pending getSession token", async () => {
  const h = harness();
  const pending = h.auth.getAuthSessionForApi();
  await h.auth.signOut();
  const newer = { ...h.user(), access_token: "new-login-token" };
  h.emit("SIGNED_IN", newer);
  h.resolveRead(h.user());
  await pending;
  assert.equal(h.auth.getAuthSession()?.idToken, "new-login-token");
});
test("actual auth: new login during remote logout survives stale SIGNED_OUT event and finally", async () => {
  const h = harness();
  const release = h.delayLogout();
  const pending = h.auth.signOut();
  h.emit("SIGNED_IN", h.user("owner-b"));
  h.emit("SIGNED_OUT", null);
  release();
  await pending;
  assert.equal(h.auth.getAuthSession()?.uid, "owner-b");
  assert.equal(JSON.parse(h.storage.get("loop.auth.v1")).uid, "owner-b");
});
test("actual auth: normal token refresh remains usable", async () => {
  const h = harness();
  const pending = h.auth.getAuthSessionForApi();
  const refreshed = { ...h.user(), access_token: "fresh" };
  h.emit("TOKEN_REFRESHED", refreshed);
  h.resolveRead(refreshed);
  assert.equal((await pending)?.idToken, "fresh");
});

test("actual auth: duplicate active SIGNED_IN notification does not restart cloud ownership", () => {
  const h = harness();
  const epoch = h.auth.getAuthEpoch();
  h.emit("SIGNED_IN", h.user());
  assert.equal(h.auth.getAuthEpoch(), epoch);
});

test("actual auth: failed persistence in this tab blocks new owner and API reauthentication without shared auth write", async () => {
  const h = harness();
  h.blockCache();
  const old = h.storage.get("loop.auth.v1");
  h.emit("SIGNED_IN", h.user("owner-b"));
  assert.equal(h.auth.getAuthSession(), null);
  assert.equal(h.storage.get("loop.auth.v1"), old);
  assert.equal(await h.auth.getAuthSessionForApi(), null);
});

test("actual auth: blocked tab ignores refresh and signout broadcasts without rewriting shared auth", async () => {
  const h = harness();
  h.blockCache();
  h.emit("SIGNED_IN", h.user("owner-b"));
  const shared = h.storage.get("loop.auth.v1");
  h.emit("TOKEN_REFRESHED", h.user("owner-b"));
  assert.equal(h.auth.getAuthSession(), null);
  assert.equal(h.storage.get("loop.auth.v1"), shared);
  h.emit("SIGNED_OUT", null);
  assert.equal(h.auth.getAuthSession(), null);
  assert.equal(h.storage.get("loop.auth.v1"), shared);
  assert.equal(await h.auth.getAuthSessionForApi(), null);
});

test("cloud writes serialize old in-flight write before newer snapshot and skip stale queued retry", async () => {
  const h = harness();
  let finishOld;
  h.setSave(() => new Promise((r) => (finishOld = r)));
  const first = { attempts: [1] },
    second = { attempts: [1, 2] };
  h.setLocal(first);
  const old = h.auth.saveLoopStateToCloud(first, "owner-a");
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(h.writes.length, 1);
  const obsolete = h.auth.saveLoopStateToCloud(first, "owner-a");
  h.setLocal(second);
  const latest = h.auth.saveLoopStateToCloud(second, "owner-a");
  await Promise.resolve();
  assert.equal(h.writes.length, 1);
  h.setSave(async () => true);
  finishOld(true);
  assert.equal(await old, true);
  assert.equal(await obsolete, false);
  assert.equal(await latest, true);
  assert.deepEqual(
    h.writes.map((w) => JSON.stringify(w.state)),
    [JSON.stringify(first), JSON.stringify(second)],
  );
});
test("queued cloud snapshot cannot write after auth owner/epoch changes", async () => {
  const h = harness();
  let release;
  h.setSave(() => new Promise((r) => (release = r)));
  const state = { attempts: [1] };
  h.setLocal(state);
  const old = h.auth.saveLoopStateToCloud(state, "owner-a");
  await Promise.resolve();
  await Promise.resolve();
  const queued = h.auth.saveLoopStateToCloud(state, "owner-a");
  h.emit("SIGNED_IN", h.user("owner-b"));
  release(true);
  await old;
  assert.equal(await queued, false);
  assert.equal(h.writes.length, 1);
});

test("normal sign-out waits behind old autosave then flushes newest snapshot last before revoking auth", async () => {
  const h = harness();
  h.enableWork();
  let release;
  h.setSave(() => new Promise((r) => (release = r)));
  const first = { attempts: [1] },
    latest = { attempts: [1, 2] };
  h.setLocal(first);
  const pending = h.auth.saveLoopStateToCloud(first, "owner-a");
  await Promise.resolve();
  await Promise.resolve();
  h.setLocal(latest);
  const logout = h.auth.signOut();
  await Promise.resolve();
  assert.equal(h.auth.getAuthSession()?.uid, "owner-a");
  assert.equal(h.writes.length, 1);
  h.setSave(async () => true);
  release(true);
  await pending;
  assert.equal(await logout, true);
  assert.equal(h.auth.getAuthSession(), null);
  assert.deepEqual(
    h.writes.map((w) => JSON.stringify(w.state)),
    [JSON.stringify(first), JSON.stringify(latest)],
  );
});
