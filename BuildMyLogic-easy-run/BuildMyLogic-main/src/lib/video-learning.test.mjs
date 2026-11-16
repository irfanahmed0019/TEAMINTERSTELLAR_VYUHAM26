import test from "node:test";
import assert from "node:assert/strict";
import {
  completedCheckpoint,
  checkpointEnd,
  videoQuestion,
} from "./video-learning.ts";
import { absenceAction, sampleVideo } from "./video-checkpoint.ts";
test("contiguous completed question checkpoints only, final partial bounded", () => {
  assert.equal(completedCheckpoint({ completed: [3, 1, 2, 2, 5] }), 3);
  assert.equal(completedCheckpoint({ completed: [2, 3] }), 0);
  assert.equal(checkpointEnd(59, 7200), 7200);
  assert.equal(checkpointEnd(2, 250), 250);
});
test("absence strictly over four seconds, no grace period watch credit", () => {
  for (const n of [0, 2000, 3999, 4000])
    assert.equal(absenceAction(n, { paused: false, rewound: false }), null);
  assert.equal(
    absenceAction(4001, { paused: false, rewound: false }),
    "replay",
  );
  const s = { watched: 119, position: 119, sampledAt: 0 };
  assert.equal(sampleVideo(s, 123, 4000, true, false).state.watched, 119);
});
test("authored questions keep correct answer after rotation and never claim execution", () => {
  for (const id of ["loops", "input", "variables", "python-foundations"])
    for (let i = 0; i < 60; i++) {
      const q = videoQuestion(id, i);
      assert.ok(q.options[q.answer]);
      assert.ok(q.explanation.length > 8);
      assert.equal(q.options.length, 4);
    }
  assert.equal(
    videoQuestion("loops", 0).options[videoQuestion("loops", 0).answer],
    "3",
  );
});
