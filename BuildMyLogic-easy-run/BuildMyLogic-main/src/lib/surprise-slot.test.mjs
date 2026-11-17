import test from "node:test";
import assert from "node:assert/strict";
import { claimNextSurprise } from "./surprise-slot.server.ts";
test("one persistent owner reservation survives retries, concurrent sessions and new instances", async () => {
  const fetch0 = global.fetch,
    env = { ...process.env };
  const rows = new Map();
  process.env.VITE_SUPABASE_URL = "https://fixture.invalid";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "fixture-not-real";
  global.fetch = async (url, options = {}) => {
    if (options.method === "POST") {
      const row = JSON.parse(options.body);
      assert.equal(row.attempts, 0);
      assert.equal(row.status, "expired");
      assert.equal(row.challenge_id, "surprise-slot-v1");
      assert.ok(row.session_id.startsWith("SURPRISE-V1-"));
      assert.ok(!/^BML-/.test(row.session_id));
      const existing = rows.has(row.session_id);
      if (!existing) rows.set(row.session_id, row);
      return new Response(
        JSON.stringify(existing ? [] : [{ session_data: row.session_data }]),
        { status: 201 },
      );
    }
    const u = new URL(url);
    const id = u.searchParams.get("session_id").slice(3),
      owner = u.searchParams.get("user_id").slice(3);
    const row = rows.get(id);
    return new Response(
      JSON.stringify(
        row?.user_id === owner ? [{ session_data: row.session_data }] : [],
      ),
    );
  };
  try {
    const b = {
      userId: "123e4567-e89b-42d3-a456-426614174000",
      sessionId: "BML-AAAAA",
      challengeId: "question-a",
      taskGeneration: 1,
    };
    const outcomes = await Promise.all([
      claimNextSurprise(b),
      claimNextSurprise({ ...b, sessionId: "BML-BBBBB" }),
    ]);
    assert.deepEqual(outcomes, [true, false]);
    assert.equal(rows.size, 1);
    assert.equal(await claimNextSurprise(b), true, "same assignment retry");
    assert.equal(
      await claimNextSurprise({ ...b, taskGeneration: 2 }),
      false,
      "later question is ordinary",
    );
    assert.equal(
      await claimNextSurprise({
        ...b,
        challengeId: "question-c",
        sessionId: "BML-CCCCC",
      }),
      false,
      "future project ordinary",
    );
    assert.equal(
      await claimNextSurprise({
        ...b,
        userId: "223e4567-e89b-42d3-a456-426614174000",
      }),
      true,
      "other owner independent",
    );
    assert.equal(rows.size, 2);
    global.fetch = async () => new Response("bad", { status: 503 });
    await assert.rejects(() => claimNextSurprise(b));
  } finally {
    global.fetch = fetch0;
    process.env = env;
  }
});
