import test from "node:test";
import assert from "node:assert/strict";
import {
  isPublicDemo,
  learnerStorage,
  enterPublicDemo,
  exitPublicDemo,
} from "./demo-mode.ts";
function storage() {
  const m = new Map();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => m.set(k, v),
    removeItem: (k) => m.delete(k),
  };
}
test("same-app demo state is tab-isolated, never reads or overwrites real learner storage", () => {
  const real = storage(),
    demo = storage(),
    paths = [];
  global.window = {
    localStorage: real,
    sessionStorage: demo,
    location: { assign: (p) => paths.push(p) },
  };
  real.setItem("loop.state.v1", "REAL ACCOUNT");
  real.setItem("bml-vscode-session", "PRIVATE SESSION");
  assert.equal(learnerStorage.getItem("loop.state.v1"), "REAL ACCOUNT");
  enterPublicDemo();
  assert.ok(isPublicDemo());
  assert.deepEqual(paths, ["/auth/dashboard"]);
  assert.equal(learnerStorage.getItem("loop.state.v1"), null);
  assert.equal(learnerStorage.getItem("bml-vscode-session"), null);
  learnerStorage.setItem("loop.state.v1", "SAMPLE");
  learnerStorage.removeItem("bml-vscode-session");
  assert.equal(real.getItem("loop.state.v1"), "REAL ACCOUNT");
  assert.equal(real.getItem("bml-vscode-session"), "PRIVATE SESSION");
  assert.equal(learnerStorage.getItem("loop.state.v1"), "SAMPLE");
  exitPublicDemo();
  assert.equal(isPublicDemo(), false);
  assert.equal(learnerStorage.getItem("loop.state.v1"), "REAL ACCOUNT");
  assert.deepEqual(paths, ["/auth/dashboard", "/"]);
  delete global.window;
});
