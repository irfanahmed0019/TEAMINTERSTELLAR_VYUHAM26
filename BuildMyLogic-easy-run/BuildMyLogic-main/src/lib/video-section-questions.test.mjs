import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  sectionQuestion,
  groundedSections,
  SECTION_SECONDS,
} from "./video-section-questions.ts";

// Evidence: the exact auto-caption line behind each question, read from YouTube's
// transcript panel on 2026-11-16. Keys are `${videoId}:${zeroBasedSection}`.
const evidence = JSON.parse(
  readFileSync(
    new URL("./video-section-evidence.json", import.meta.url),
    "utf8",
  ),
);
const keys = Object.keys(evidence);

test("sections are zero-based and 120 seconds", () => {
  assert.equal(SECTION_SECONDS, 120);
  assert.ok(sectionQuestion("b4DPj0XAfSg", 0));
  assert.ok(sectionQuestion("b4DPj0XAfSg", 1));
  assert.equal(sectionQuestion("b4DPj0XAfSg", 2), null);
});

test("unknown videos, bad sections and bad ids return null, never invented", () => {
  assert.equal(sectionQuestion("zzzzzzzzzzz", 0), null);
  assert.equal(sectionQuestion("b4DPj0XAfSg", -1), null);
  assert.equal(sectionQuestion("b4DPj0XAfSg", 0.5), null);
  assert.equal(sectionQuestion("b4DPj0XAfSg", Number.NaN), null);
  assert.equal(sectionQuestion("", 0), null);
  assert.equal(sectionQuestion("__proto__", 0), null);
  assert.equal(sectionQuestion("constructor:0", 0), null);
});

test("outro-only final sections stay null (no padding)", () => {
  for (const [id, s] of [
    ["xyQrVEFz9kw", 2],
    ["nrbBmoINqtk", 6],
    ["tb6EYiHtcXU", 6],
    ["60OI5tzmkCw", 4],
  ]) {
    assert.equal(sectionQuestion(id, s), null, `${id}:${s}`);
  }
});

test("every grounded question is whole inside its 120-second section", () => {
  assert.ok(keys.length >= 100);
  for (const key of keys) {
    const [id, sec] = key.split(":");
    const s = Number(sec);
    const q = sectionQuestion(id, s);
    assert.ok(q, key);
    const p = q.provenance;
    assert.ok(p.startSeconds >= s * SECTION_SECONDS, `${key} starts early`);
    assert.ok(
      p.endSeconds <= (s + 1) * SECTION_SECONDS,
      `${key} crosses boundary`,
    );
    assert.ok(p.endSeconds > p.startSeconds, key);
    assert.equal(p.captionKind, "auto");
    assert.equal(p.sourceUrl, `https://www.youtube.com/watch?v=${id}`);
  }
});

test("quote is an exact substring of the recorded caption line at that time", () => {
  for (const key of keys) {
    const [id, sec] = key.split(":");
    const q = sectionQuestion(id, Number(sec));
    const e = evidence[key];
    assert.equal(q.provenance.startSeconds, e.startSeconds, key);
    assert.equal(q.provenance.endSeconds, e.endSeconds, key);
    assert.ok(
      e.caption.includes(q.provenance.quote),
      `${key} quote not in caption`,
    );
    assert.ok(q.provenance.quote.length >= 12, key);
  }
});

test("question shape: four distinct options, valid answer, explanation", () => {
  for (const key of keys) {
    const [id, sec] = key.split(":");
    const q = sectionQuestion(id, Number(sec));
    assert.equal(q.options.length, 4, key);
    assert.equal(new Set(q.options).size, 4, key);
    assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < 4, key);
    assert.ok(q.prompt.endsWith("?"), key);
    assert.ok(q.explanation.length > 10, key);
  }
});

test("returned data is a copy so callers cannot mutate stored questions", () => {
  const a = sectionQuestion("b4DPj0XAfSg", 0);
  a.options.reverse();
  a.provenance.quote = "changed";
  const b = sectionQuestion("b4DPj0XAfSg", 0);
  assert.notDeepEqual(a.options, b.options);
  assert.notEqual(b.provenance.quote, "changed");
});

test("groundedSections lists ascending section indexes per video", () => {
  assert.deepEqual(groundedSections("b4DPj0XAfSg"), [0, 1]);
  assert.deepEqual(
    groundedSections("WrFEtUzVcnw"),
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  );
  assert.deepEqual(groundedSections("unknownvid1"), []);
});

test("the first-section question does not use content from after 120 seconds", () => {
  const q = sectionQuestion("b4DPj0XAfSg", 0);
  assert.ok(q.provenance.endSeconds <= 120);
  assert.ok(!/count by two|i minus minus|decrement/i.test(q.prompt));
});

test("reviewed semantics do not repeat misleading collection, interpreter or C format claims", () => {
  assert.match(sectionQuestion("6YNYuJ_jiu0", 5).prompt, /neither/);
  assert.match(sectionQuestion("gOMW_n2-2Mw", 0).prompt, /comma-separated/);
  assert.match(sectionQuestion("gOMW_n2-2Mw", 1).prompt, /list index/);
  assert.match(sectionQuestion("Sg4GMVMdOPo", 0).prompt, /Windows/);
  assert.match(
    sectionQuestion("gOMW_n2-2Mw", 7).explanation,
    /sets are also mutable/,
  );
  assert.match(sectionQuestion("WrFEtUzVcnw", 4).explanation, /no effect/);
});
