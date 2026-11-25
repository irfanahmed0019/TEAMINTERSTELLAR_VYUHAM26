import test from "node:test";
import assert from "node:assert/strict";
import { STUDY_TOPICS } from "./topic-library.ts";

test("practice explanations do not claim a finite check proves every input", () => {
  const bad = /works for any|works for every|for any number the user types/i;
  const hits = [];
  let checked = 0;
  for (const topic of STUDY_TOPICS) {
    for (const [lang, practice] of Object.entries(topic.exercise ?? {})) {
      if (!practice?.explain) continue;
      checked += 1;
      if (bad.test(practice.explain)) hits.push(`${topic.id}/${lang}`);
    }
  }
  assert.ok(checked > 10, "expected to inspect real exercise explanations");
  assert.deepEqual(hits, []);
});
