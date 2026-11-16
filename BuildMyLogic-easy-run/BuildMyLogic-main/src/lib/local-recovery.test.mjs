import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  prepareSafeSignOut,
  requiresAccountRecovery,
  hasLocalWork,
} from "./local-recovery.ts";
const empty = { sessions: [], activity: [], learningChats: {} };
test("empty unknown browser does not block; prior owner nonempty data does", () => {
  assert.equal(hasLocalWork(empty), false);
  assert.equal(requiresAccountRecovery(null, "b", empty), false);
  assert.equal(
    requiresAccountRecovery("a", "b", {
      ...empty,
      profile: { resumeText: "private" },
    }),
    true,
  );
  assert.equal(
    requiresAccountRecovery("a", "a", { ...empty, profile: {} }),
    false,
  );
});
test("offline cancelled signout preserves authority and data; explicit discard is required", async () => {
  let choices = 0;
  assert.equal(
    await prepareSafeSignOut({
      owner: "a",
      current: () => "a",
      save: async () => {
        throw Error("offline");
      },
      confirmDiscard: () => {
        choices++;
        return false;
      },
    }),
    false,
  );
  assert.equal(choices, 1);
  assert.equal(
    await prepareSafeSignOut({
      owner: "a",
      current: () => "a",
      save: async () => false,
      confirmDiscard: () => true,
    }),
    true,
  );
});
test("account switch during pending flush cannot clear incoming account or ask its discard permission", async () => {
  let uid = "a",
    finish;
  const saved = new Promise((r) => (finish = r));
  let asked = false;
  const task = prepareSafeSignOut({
    owner: "a",
    current: () => uid,
    save: () => saved,
    confirmDiscard: () => {
      asked = true;
      return true;
    },
  });
  uid = "b";
  finish(true);
  assert.equal(await task, false);
  assert.equal(asked, false);
});
test("successful same-owner flush permits signout without destructive question", async () => {
  assert.equal(
    await prepareSafeSignOut({
      owner: "a",
      current: () => "a",
      save: async () => true,
      confirmDiscard: () => {
        throw Error("unexpected");
      },
    }),
    true,
  );
});
test("switch handling never writes a new raw retained snapshot; recovery gates route rendering", () => {
  const cloud = readFileSync(
    new URL("./cloud-sync.tsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(cloud, /setItem\(`loop\.state\.retained/);
  const root = readFileSync(
    new URL("../routes/__root.tsx", import.meta.url),
    "utf8",
  );
  assert.match(root, /<AccountRecoveryBoundary>/);
  assert.match(root, /<Outlet \/>/);
});
test("local edits during flush cancel signout rather than discard newer work", async () => {
  assert.equal(
    await prepareSafeSignOut({
      owner: "a",
      current: () => "a",
      save: async () => true,
      unchanged: () => false,
      confirmDiscard: () => {
        throw Error("no implicit discard");
      },
    }),
    false,
  );
});
test("ordinary signout is hydration-gated and readiness never transfers between owners", async () => {
  const { setReadyCloudOwner, isReadyCloudOwner } =
    await import("./cloud-readiness.ts");
  setReadyCloudOwner(null);
  assert.equal(isReadyCloudOwner("a"), false);
  setReadyCloudOwner("a");
  assert.equal(isReadyCloudOwner("a"), true);
  assert.equal(isReadyCloudOwner("b"), false);
  setReadyCloudOwner(null);
  assert.equal(isReadyCloudOwner("a"), false);
  const auth = readFileSync(new URL("./auth.ts", import.meta.url), "utf8");
  assert.ok(
    auth.indexOf("!isReadyCloudOwner(owner)") <
      auth.indexOf("const before = JSON.stringify(getLoopState())"),
  );
});
test("signed-out direct routes and reload remain blocked by pending or legacy archived recovery", async () => {
  const { blockSignedOutRecovery } = await import("./local-recovery.ts");
  assert.equal(blockSignedOutRecovery("a", "a", empty, []), true);
  assert.equal(
    blockSignedOutRecovery(null, null, empty, ["loop.state.retained.a"]),
    true,
  );
  assert.equal(
    blockSignedOutRecovery(
      null,
      "a",
      { ...empty, profile: { resumeText: "private" } },
      [],
    ),
    true,
  );
  assert.equal(blockSignedOutRecovery(null, null, empty, []), false);
  const ui = readFileSync(
    new URL("../components/AccountRecoveryBoundary.tsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(ui, /undefined" \|\| !auth\) return/);
  assert.match(ui, /blockSignedOutRecovery/);
});
test("unbound discard is possible only by explicit local choice; B cannot discard bound A", async () => {
  const { canDiscardRecovery } = await import("./local-recovery.ts");
  assert.equal(canDiscardRecovery(null, "unbound", "b", false), true);
  assert.equal(canDiscardRecovery("a", "a", "b", false), false);
  assert.equal(canDiscardRecovery("a", "a", "a", false), true);
  assert.equal(canDiscardRecovery(null, "unbound", undefined, false), false);
});
