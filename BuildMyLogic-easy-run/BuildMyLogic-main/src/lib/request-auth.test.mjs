import test from "node:test";
import assert from "node:assert/strict";
import { authenticatedUserId } from "./request-auth.server.ts";

const UID = "11111111-2222-4333-8444-555555555555";
const req = (auth) => new Request("https://x.test/", { headers: auth ? { authorization: auth } : {} });
const realFetch = globalThis.fetch;
function setup(handler) {
  process.env.VITE_SUPABASE_URL = "https://proj.supabase.test";
  process.env.VITE_SUPABASE_ANON_KEY = "anon";
  globalThis.fetch = async (url, init) => handler(String(url), init);
}
test.afterEach(() => { globalThis.fetch = realFetch; });

test("no bearer token is rejected without calling Supabase", async () => {
  let called = false; setup(() => { called = true; return new Response("{}"); });
  assert.equal(await authenticatedUserId(req()), undefined);
  assert.equal(called, false);
});
test("valid token resolves to the Supabase user id", async () => {
  setup((url, init) => { assert.ok(url.endsWith("/auth/v1/user")); assert.equal(init.headers.authorization, "Bearer good"); return Response.json({ id: UID }); });
  assert.equal(await authenticatedUserId(req("Bearer good")), UID);
});
test("rejected token and malformed id are refused", async () => {
  setup(() => new Response("{}", { status: 401 }));
  assert.equal(await authenticatedUserId(req("Bearer bad")), undefined);
  setup(() => Response.json({ id: "not-a-uuid" }));
  assert.equal(await authenticatedUserId(req("Bearer odd")), undefined);
});
test("network failure fails closed", async () => {
  setup(() => { throw new Error("down"); });
  assert.equal(await authenticatedUserId(req("Bearer x")), undefined);
});
