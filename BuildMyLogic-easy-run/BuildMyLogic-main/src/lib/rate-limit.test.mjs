import test from "node:test";
import assert from "node:assert/strict";
import { createRateLimiter } from "./rate-limit.ts";

test("allows up to max then blocks within the window", () => {
  const limited = createRateLimiter();
  for (let i = 0; i < 3; i++) assert.equal(limited("a", 3, 60_000, 1000 + i), false);
  assert.equal(limited("a", 3, 60_000, 1010), true);
});
test("keys are independent", () => {
  const limited = createRateLimiter();
  limited("a", 1, 60_000, 0);
  assert.equal(limited("a", 1, 60_000, 1), true);
  assert.equal(limited("b", 1, 60_000, 1), false);
});
test("window expiry frees the key", () => {
  const limited = createRateLimiter();
  limited("a", 1, 1000, 0);
  assert.equal(limited("a", 1, 1000, 500), true);
  assert.equal(limited("a", 1, 1000, 1500), false);
});
test("blocked attempts do not extend the block", () => {
  const limited = createRateLimiter();
  limited("a", 1, 1000, 0);
  for (let t = 100; t < 900; t += 100) limited("a", 1, 1000, t);
  assert.equal(limited("a", 1, 1000, 1001), false);
});
