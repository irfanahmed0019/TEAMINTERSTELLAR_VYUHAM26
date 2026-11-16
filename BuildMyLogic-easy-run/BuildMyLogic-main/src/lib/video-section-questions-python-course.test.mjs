import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  sectionQuestion,
  groundedSections,
  SECTION_SECONDS,
} from "./video-section-questions.ts";

// Evidence: exact auto-caption line behind each question, read from YouTube's transcript
// panel on 2026-11-16. Keys are `rfscVS0vtbw:${zeroBasedSection}`.
const ID = "rfscVS0vtbw";
const evidence = JSON.parse(
  readFileSync(
    new URL("./video-section-evidence-python-course.json", import.meta.url),
    "utf8",
  ),
);
const keys = Object.keys(evidence);
const LAST_CAPTION_START = 16004;

test("course covers every zero-based 120s section from 0 through the last caption", () => {
  assert.equal(SECTION_SECONDS, 120);
  assert.equal(keys.length, 134);
  assert.deepEqual(
    groundedSections(ID),
    Array.from({ length: 134 }, (_, i) => i),
  );
  assert.equal(Math.floor(LAST_CAPTION_START / SECTION_SECONDS), 133);
});

test("no question is invented past the captions or for bad inputs", () => {
  assert.equal(sectionQuestion(ID, 134), null);
  assert.equal(sectionQuestion(ID, 999), null);
  assert.equal(sectionQuestion(ID, -1), null);
  assert.equal(sectionQuestion(ID, 1.5), null);
  assert.equal(sectionQuestion("rfscVS0vtbx", 0), null);
});

test("each question's caption interval is whole inside its section (boundaries crossed)", () => {
  for (const key of keys) {
    const s = Number(key.split(":")[1]);
    const q = sectionQuestion(ID, s);
    assert.ok(q, key);
    const p = q.provenance;
    assert.ok(p.startSeconds >= s * SECTION_SECONDS, `${key} starts early`);
    assert.ok(p.endSeconds <= (s + 1) * SECTION_SECONDS, `${key} crosses end`);
    assert.ok(p.endSeconds > p.startSeconds, key);
    assert.equal(p.captionKind, "auto");
    assert.equal(p.sourceUrl, `https://www.youtube.com/watch?v=${ID}`);
  }
});

test("quote is an exact substring of the recorded caption at that time", () => {
  for (const key of keys) {
    const s = Number(key.split(":")[1]);
    const q = sectionQuestion(ID, s);
    const e = evidence[key];
    assert.equal(q.provenance.startSeconds, e.startSeconds, key);
    assert.equal(q.provenance.endSeconds, e.endSeconds, key);
    assert.ok(e.caption.includes(q.provenance.quote), `${key} quote`);
    assert.ok(q.provenance.quote.length >= 12, key);
  }
});

test("question shape: four distinct options, valid answer, explanation", () => {
  const seen = new Set();
  const counts = [0, 0, 0, 0];
  for (const key of keys) {
    const q = sectionQuestion(ID, Number(key.split(":")[1]));
    assert.equal(q.options.length, 4, key);
    assert.equal(new Set(q.options).size, 4, key);
    assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < 4, key);
    assert.ok(q.prompt.endsWith("?"), key);
    assert.ok(q.explanation.length > 10, key);
    assert.ok(!seen.has(q.prompt), `${key} repeats a prompt`);
    seen.add(q.prompt);
    counts[q.answer] += 1;
  }
  assert.ok(Math.min(...counts) >= 30, `answer positions ${counts}`);
});

test("returned data is a copy so callers cannot mutate stored questions", () => {
  const a = sectionQuestion(ID, 0);
  a.options.reverse();
  a.provenance.quote = "changed";
  const b = sectionQuestion(ID, 0);
  assert.notDeepEqual(a.options, b.options);
  assert.notEqual(b.provenance.quote, "changed");
});

test("existing 22-video questions are untouched by the course partition", () => {
  assert.deepEqual(groundedSections("b4DPj0XAfSg"), [0, 1]);
  assert.ok(sectionQuestion("jc7TBgMS_kw", 0));
});

test("reviewed course questions narrow old tutorial simplifications rather than teach incorrect rules", () => {
  const q = (n) => sectionQuestion(ID, n);
  assert.match(q(28).explanation, /numeric float/);
  assert.match(q(98).explanation, /file object/);
  assert.match(q(131).options[q(131).answer], /python3/);
  assert.match(q(108).explanation, /not a built-in/);
  assert.match(q(3).prompt, /tutorial/);
  assert.match(q(51).prompt, /elif/);
  assert.match(q(65).explanation, /editor/);
  assert.match(q(125).explanation, /at least/);
  assert.match(q(126).explanation, /instance methods/);
  assert.match(q(97).prompt, /lowercase/);
  assert.match(q(105).explanation, /without the .py/);
  assert.match(q(89).prompt, /lowercase/);
  assert.match(q(78).options[q(78).answer], /integer/);
  assert.match(q(45).explanation, /argument/);
});
