import test from "node:test";
import assert from "node:assert/strict";
import {
  localStateBelongsToOtherAccount,
  LOOP_STATE_UID_KEY,
} from "./cloud-sync-uid.ts";
test("account switch without sign-out flags the previous account local state", () => {
  assert.equal(localStateBelongsToOtherAccount("uid-a", "uid-b"), true);
});
test("same account and signed-out states keep local state, unbound legacy state is not imported", () => {
  assert.equal(localStateBelongsToOtherAccount("uid-a", "uid-a"), false);
  assert.equal(localStateBelongsToOtherAccount(null, "uid-b"), true);
  assert.equal(localStateBelongsToOtherAccount("uid-a", null), false);
});
test("marker key is namespaced with the loop state key", () => {
  assert.match(LOOP_STATE_UID_KEY, /^loop\.state/);
});
