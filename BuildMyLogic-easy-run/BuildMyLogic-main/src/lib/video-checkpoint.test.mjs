import test from "node:test";
import assert from "node:assert/strict";
import {
  initialVideoProgress,
  sectionLength,
  sectionStart,
  sampleVideo,
  rewindSection,
} from "./video-checkpoint.ts";
test("40-minute videos use 2-minute sections, hour videos use 4", () => {
  assert.equal(sectionLength(2400), 120);
  assert.equal(sectionLength(3600), 240);
  assert.equal(sectionStart(359, 2400), 240);
  assert.equal(sectionStart(359, 3600), 240);
  assert.equal(sectionStart(239, 3600), 0);
});
test("first and final partial section bounds are safe", () => {
  assert.equal(sectionStart(0, 2400), 0);
  assert.equal(sectionStart(250, 250), 240);
  assert.equal(sectionStart(3600, 3600), 3360);
  assert.equal(sectionLength(0), 120);
});
test("normal watched playback advances and permits replay", () => {
  let s = initialVideoProgress();
  for (let n = 0; n <= 300; n++) {
    const r = sampleVideo(s, n, n * 1000, true, true);
    assert.equal(r.seek, null);
    s = r.state;
  }
  assert.equal(s.watched, 300);
  const replay = sampleVideo(s, 40, 301000, true, true);
  assert.equal(replay.seek, null);
  assert.equal(replay.state.watched, 300);
});
test("forward seek is corrected without unlocking skipped sections", () => {
  const s = { watched: 140, position: 140, sampledAt: 1000 };
  const r = sampleVideo(s, 700, 1333, true, true);
  assert.equal(r.seek, 140);
  assert.equal(r.state.watched, 140);
  const paused = sampleVideo(s, 700, 1333, false, true);
  assert.equal(paused.seek, 140);
});
test("absence rewinds only current section and preserves completed playback", () => {
  const r = rewindSection(
    { watched: 385, position: 385, sampledAt: 1000 },
    2400,
  );
  assert.equal(r.seek, 360);
  assert.equal(r.state.watched, 385);
  assert.equal(r.state.sampledAt, null);
  assert.equal(
    rewindSection({ watched: 385, position: 385, sampledAt: 1000 }, 3600).seek,
    240,
  );
});
test("absence and pauses never advance watched range", () => {
  const s = { watched: 20, position: 20, sampledAt: 1000 };
  assert.equal(sampleVideo(s, 20.5, 1333, true, false).state.watched, 20);
  assert.equal(sampleVideo(s, 20.5, 1333, false, true).state.watched, 20);
});
test("long gaps and new player instances cannot unlock unwatched content", () => {
  assert.equal(
    sampleVideo(
      { watched: 10, position: 10, sampledAt: 1000 },
      200,
      600000,
      true,
      true,
    ).seek,
    10,
  );
  assert.equal(
    sampleVideo(initialVideoProgress(), 200, 1000, true, true).seek,
    0,
  );
});
test("2x playback works and invalid samples do not corrupt state", () => {
  const s = { watched: 20, position: 20, sampledAt: 1000 };
  assert.equal(sampleVideo(s, 22, 2000, true, true).state.watched, 22);
  assert.deepEqual(sampleVideo(s, NaN, 2000, true, true).state, s);
});
