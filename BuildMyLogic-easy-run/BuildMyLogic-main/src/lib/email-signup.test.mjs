import test from "node:test";
import assert from "node:assert/strict";
import { createConfirmedAccount } from "./email-signup.ts";
const args = [
  " new@example.invalid ",
  "local-test-only",
  "local-test-only",
  "https://app.example.invalid",
  async () => true,
];
function stub(result = { data: { session: null }, error: null }) {
  let sent,
    loggedOut = 0;
  return {
    auth: {
      signUp: async (v) => ((sent = v), result),
      signOut: async () => {
        loggedOut++;
      },
    },
    get sent() {
      return sent;
    },
    get loggedOut() {
      return loggedOut;
    },
  };
}
test("pending confirmation succeeds without session, trims email and uses same-origin callback", async () => {
  const c = stub();
  assert.match(await createConfirmedAccount(c, ...args), /Check your email/);
  assert.deepEqual(c.sent, {
    email: "new@example.invalid",
    password: "local-test-only",
    options: { emailRedirectTo: "https://app.example.invalid/auth/callback" },
  });
  assert.equal(c.loggedOut, 0);
});
test("instant confirmation misconfiguration signs out and does not claim success", async () => {
  const c = stub({
    data: { session: { user: { id: "fixture" } } },
    error: null,
  });
  await assert.rejects(
    createConfirmedAccount(c, ...args),
    /did not require email confirmation/,
  );
  assert.equal(c.loggedOut, 1);
});
test("missing or changed confirmation policy fails closed before contacting signup", async () => {
  for (const policy of [
    async () => false,
    async () => {
      throw Error("offline");
    },
  ]) {
    const c = stub();
    await assert.rejects(
      createConfirmedAccount(c, ...args.slice(0, 4), policy),
      /unavailable/,
    );
    assert.equal(c.sent, undefined);
  }
});
test("validation prevents provider requests for short or mismatching passwords", async () => {
  const c = stub();
  await assert.rejects(
    createConfirmedAccount(
      c,
      "a@example.invalid",
      "short",
      "short",
      args[3],
      args[4],
    ),
    /at least 8/,
  );
  await assert.rejects(
    createConfirmedAccount(c, args[0], args[1], "different", args[3], args[4]),
    /do not match/,
  );
  assert.equal(c.sent, undefined);
});
test("provider reflection and existing identity details are masked", async () => {
  const c = stub({
    data: { session: null },
    error: { code: "user_already_exists", message: "PRIVATE REFLECTION" },
  });
  await assert.rejects(
    createConfirmedAccount(c, ...args),
    (e) => !e.message.includes("PRIVATE") && /original method/.test(e.message),
  );
});
test("rate-limit and network failures are actionable without automatic resend", async () => {
  let c = stub({
    data: { session: null },
    error: { code: "over_email_send_rate_limit", message: "private" },
  });
  await assert.rejects(createConfirmedAccount(c, ...args), /Wait a few/);
  c = stub();
  c.auth.signUp = async () => {
    throw Error("private");
  };
  await assert.rejects(createConfirmedAccount(c, ...args), /connection/);
});
test("missing provider never creates local signup", async () => {
  await assert.rejects(createConfirmedAccount(null, ...args), /not configured/);
});
