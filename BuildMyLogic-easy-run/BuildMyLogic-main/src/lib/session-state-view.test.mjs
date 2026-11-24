import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  sessionViewState,
  classifyStateResponse,
} from "./session-state-view.ts";

test("delayed state response: a known session id with no state yet is loading, never ready", () => {
  assert.equal(
    sessionViewState({
      hasSessionId: true,
      hasRemoteState: false,
      loadFailed: false,
    }),
    "loading",
  );
});
test("failed state response with no verified state shows an error, not endless loading", () => {
  assert.equal(
    sessionViewState({
      hasSessionId: true,
      hasRemoteState: false,
      loadFailed: true,
    }),
    "error",
  );
});
test("last verified same-session state is kept when a later call fails", () => {
  assert.equal(
    sessionViewState({
      hasSessionId: true,
      hasRemoteState: true,
      loadFailed: true,
    }),
    "ready",
  );
});
test("no session id means no loading state", () => {
  assert.equal(
    sessionViewState({
      hasSessionId: false,
      hasRemoteState: false,
      loadFailed: false,
    }),
    "none",
  );
});
test("response classification: ok applies, auth/404 resets, other failures are failed", () => {
  assert.equal(
    classifyStateResponse({ ok: true, status: 200, hasState: true }),
    "apply",
  );
  for (const status of [401, 403, 404])
    assert.equal(
      classifyStateResponse({ ok: false, status, hasState: false }),
      "reset",
    );
  for (const status of [500, 502, 503, 504])
    assert.equal(
      classifyStateResponse({ ok: false, status, hasState: false }),
      "failed",
    );
  assert.equal(
    classifyStateResponse({ ok: true, status: 200, hasState: false }),
    "failed",
  );
});
test("Sessions page hides local plan data while the session state is pending", () => {
  const src = readFileSync(
    new URL("../routes/sessions.tsx", import.meta.url),
    "utf8",
  );
  assert.match(src, /sessionViewState\(/);
  assert.match(src, /const testsLabel = remotePending/);
  assert.match(src, /const attemptsLabel = remotePending/);
  assert.match(src, /remotePending\s*\?\s*\[\]/);
  assert.match(src, /setStateLoadFailed\(true\)/);
});

test("page keys verified state to the shown session id, backs off failures and offers retry", () => {
  const src = readFileSync(
    new URL("../routes/sessions.tsx", import.meta.url),
    "utf8",
  );
  assert.match(src, /remoteState\?\.session_id\?\.toUpperCase\(\)/);
  assert.match(src, /Math\.min\(5000 \* 2 \*\* failures, 60000\)/);
  assert.match(src, /Retry now/);
  assert.doesNotMatch(src, /saved result is not affected/);
});
