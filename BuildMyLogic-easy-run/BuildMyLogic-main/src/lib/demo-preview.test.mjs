import test from "node:test";
import assert from "node:assert/strict";
import { isDemoPreviewIdentifier } from "./demo-preview.ts";
test("only the dedicated synthetic identifier selects the public preview", () => {
  assert.ok(isDemoPreviewIdentifier("demo@buildmylogic.invalid"));
  assert.ok(isDemoPreviewIdentifier(" Demo@BuildMyLogic.Invalid "));
  for (const email of [
    "demo@gmail.com",
    "demo@buildmylogic.invalid.evil",
    "other@buildmylogic.invalid",
    "demo@buildmylogic.invalid@evil.test",
    "",
  ])
    assert.equal(isDemoPreviewIdentifier(email), false);
});
