import test from "node:test";
import assert from "node:assert/strict";
import { REVIEW_CHALLENGES as challenges, reviewTest } from "./challenge-ai.ts";

test("displayed snippets are exactly equivalent to executed candidates over bounded domain", () => {
  const inputs = Array.from({ length: 121 }, (_, i) => i);
  const lists = [];
  const domain = [-100, -2, -1, 0, 1, 2, 100];
  for (const a of domain) {
    lists.push([a]);
    for (const b of domain) {
      lists.push([a, b]);
      for (const c of domain) lists.push([a, b, c]);
    }
  }
  for (const challenge of challenges) {
    // Only fixed, developer-authored strings are evaluated here, never user input.
    const displayed = new Function(`${challenge.code}; return check;`)();
    for (const input of challenge.id === "boundary" ? inputs : lists) {
      const snapshot = JSON.stringify(input);
      assert.equal(challenge.candidate(input), displayed(input));
      assert.equal(
        JSON.stringify(input),
        snapshot,
        "candidate must not mutate input",
      );
      const expected =
        challenge.id === "boundary"
          ? input >= 18
            ? 1
            : 0
          : challenge.id === "maximum"
            ? [...input].sort((a, b) => b - a)[0]
            : input.filter((v, i) => input.indexOf(v) === i).length;
      assert.equal(challenge.reference(input), expected);
    }
  }
});
test("happy path passes, learner-written counterexamples distinguish failures", () => {
  const cases = [
    ["18", "1"],
    ["[-3, -8]", "-3"],
    ["[2, 7, 2]", "2"],
  ];
  challenges.forEach((c, i) => {
    const example = c.parse(c.example);
    assert.equal(c.candidate(example), c.reference(example));
    const r = reviewTest(c, ...cases[i]);
    assert.equal(r.breaks, true);
    assert.equal(r.predictedCorrectly, true);
    assert.equal(
      reviewTest(c, c.example, String(c.reference(example))).breaks,
      false,
    );
    assert.equal(reviewTest(c, cases[i][0], "99").predictedCorrectly, false);
  });
});
test("reject malformed, unbounded and non-integer input before execution", () => {
  for (const raw of ["", "-1", "121", "1e2", "18.0", "Infinity", "18;alert(1)"])
    assert.throws(() => challenges[0].parse(raw));
  for (const raw of [
    "",
    "[]",
    "null",
    "{}",
    "[1.5]",
    "[101]",
    "[null]",
    '["2"]',
    JSON.stringify(Array(13).fill(1)),
  ])
    assert.throws(() => challenges[1].parse(raw));
  for (const pred of ["", "NaN", "1.5", "1e2", "Infinity", "1;alert(1)"])
    assert.throws(() => reviewTest(challenges[0], "18", pred));
  assert.deepEqual(challenges[1].parse("[-100, 100]"), [-100, 100]);
});
