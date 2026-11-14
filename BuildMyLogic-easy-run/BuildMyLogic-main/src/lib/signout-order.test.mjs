import test from "node:test";
import assert from "node:assert/strict";
import { signOutInOrder } from "./signout-order.ts";
test("logout immediately revokes cloud authority before resetting state during slow signout", async () => {
  const calls = [];
  let uid = "real-user",
    state = "saved progress",
    release;
  const pending = new Promise((resolve) => (release = resolve));
  const done = signOutInOrder({
    revoke: () => {
      calls.push("revoke");
      uid = null;
    },
    clear: () => {
      calls.push("clear");
      state = "empty";
      assert.equal(uid, null);
    },
    remote: async () => {
      calls.push("remote");
      await pending;
    },
  });
  assert.deepEqual(calls, ["revoke", "clear", "remote"]);
  assert.equal(uid, null);
  assert.equal(state, "empty");
  // A pending autosave callback must see no owner, even while network signout waits.
  const writes = [];
  if (uid) writes.push({ uid, state });
  assert.deepEqual(writes, []);
  release();
  await done;
});
test("remote failure never restores write authority or skips revocation", async () => {
  let revoked = false,
    cleared = false;
  await assert.rejects(
    signOutInOrder({
      revoke: () => (revoked = true),
      clear: () => {
        assert.ok(revoked);
        cleared = true;
      },
      remote: async () => {
        throw Error("offline");
      },
    }),
    /offline/,
  );
  assert.ok(revoked && cleared);
});
