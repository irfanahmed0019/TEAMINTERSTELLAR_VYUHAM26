import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const route = fs.readFileSync(
  new URL("../routes/sessions.tsx", import.meta.url),
  "utf8",
);
const source = route.slice(
  route.indexOf("  async function createVscodeSession()"),
  route.indexOf("  async function connectExtension("),
);
const js = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.None,
  },
}).outputText;
const deferred = () => {
  let resolve;
  return {
    promise: new Promise((r) => (resolve = r)),
    resolve: (v) => resolve(v),
  };
};
function fixture() {
  const effects = [],
    auth = { uid: "owner-a", idToken: "private-local-token" },
    response = deferred(),
    authWait = deferred();
  let epoch = 1,
    current = auth;
  const token = { current: undefined };
  const context = vm.createContext({
    Error,
    JSON,
    activeMission: { id: "m1" },
    getAuthEpoch: () => epoch,
    getAuthSession: () => current,
    getAuthSessionForApi: () => authWait.promise,
    fetch: () => response.promise,
    connectionTokenRef: token,
    setVscodeSession: (v) => effects.push(["session", v]),
    setRemoteState: (v) => effects.push(["remote", v]),
    learnerStorage: { setItem: (...x) => effects.push(["write", ...x]) },
  });
  vm.runInContext(js, context);
  return {
    effects,
    token,
    authWait,
    response,
    start: () => vm.runInContext("createVscodeSession()", context),
    change: (next) => {
      epoch++;
      current = next;
    },
    auth,
  };
}
const success = {
  ok: true,
  json: async () => ({
    ok: true,
    session_id: "BML-QA123",
    connection_token: "A".repeat(43),
  }),
};
test("actual session creation rejects logout/account switch/same-user ABA before storing old credentials", async () => {
  for (let n = 0; n < 60; n++) {
    const f = fixture(),
      pending = f.start();
    f.authWait.resolve(f.auth);
    await Promise.resolve();
    f.change(n % 3 === 0 ? null : n % 3 === 1 ? { uid: "owner-b" } : f.auth);
    f.response.resolve(success);
    await assert.rejects(pending, /Account changed/);
    assert.deepEqual(f.effects, []);
    assert.equal(f.token.current, undefined);
  }
});
test("auth refresh resolving after account change cannot even send old session request", async () => {
  const f = fixture(),
    pending = f.start();
  f.change(null);
  f.authWait.resolve(f.auth);
  await assert.rejects(pending, /Account changed/);
  assert.deepEqual(f.effects, []);
});
test("normal same-owner create still stores token only in memory and display metadata locally", async () => {
  const f = fixture(),
    pending = f.start();
  f.authWait.resolve(f.auth);
  f.response.resolve(success);
  const result = await pending;
  assert.equal(result.sessionId, "BML-QA123");
  assert.equal(f.token.current, "A".repeat(43));
  assert.equal(f.effects.length, 3);
  assert.ok(!JSON.stringify(f.effects).includes("A".repeat(43)));
});
