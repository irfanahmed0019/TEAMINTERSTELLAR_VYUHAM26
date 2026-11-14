import test from "node:test";
import assert from "node:assert/strict";
import { isPublicDemo } from "./demo-mode.ts";
import {
  passwordLoginEmail,
  isSampleAccount,
  SAMPLE_ACCOUNT_ID,
} from "./sample-account.ts";
test("public preview is retired, legacy tab flag cannot bypass authentication", () => {
  global.window = { sessionStorage: { getItem: () => "1" } };
  assert.equal(isPublicDemo(), false);
  delete global.window;
});
test("test login alias resolves only the explicit sample principal email", () => {
  assert.equal(
    passwordLoginEmail(" Demo@Gmail.com "),
    "demo@buildmylogic.invalid",
  );
  assert.equal(passwordLoginEmail("someone@gmail.com"), "someone@gmail.com");
  assert.equal(
    passwordLoginEmail("demo@gmail.com.evil"),
    "demo@gmail.com.evil",
  );
  assert.ok(isSampleAccount(SAMPLE_ACCOUNT_ID));
  assert.equal(isSampleAccount("local-builder"), false);
});
