import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { STUDY_TOPICS } from "./topic-library.ts";

test("every offered Python lesson has authored notes, starter and executable finite checks", () => {
  assert.ok(STUDY_TOPICS.length >= 10);
  for (const topic of STUDY_TOPICS) {
    assert.ok(topic.notes.python.points.length && topic.notes.python.code);
    const e = topic.exercise.python;
    assert.ok(e.title && e.task && e.instructions.length && e.starterCode);
    assert.ok(e.tests.length);
    const authoredAnswers = {
      variables: "a=5\nb=7\ntotal=a+b\nprint(total)",
      math: "print(17 % 5)",
      loops: "for i in range(1,6):\n print(i)",
      functions: "def square(n): return n*n\nprint(square(6))",
      recursion:
        "def factorial(n):\n if n<=1: return 1\n return n*factorial(n-1)\nprint(factorial(5))",
      "arrays-lists":
        "marks=[4,8,15]\ntotal=0\nfor m in marks: total+=m\nprint(total)",
      strings: "word='logic'\nprint(len(word))",
    };
    const source = e.solution || authoredAnswers[topic.id] || e.starterCode;
    for (const c of e.tests) {
      const r = spawnSync("python3", ["-I", "-c", source], {
        input: c.stdin,
        encoding: "utf8",
        timeout: 3000,
      });
      assert.equal(r.status, 0, `${topic.id}: ${r.stderr}`);
      assert.equal(
        r.stdout.trim(),
        c.expected.trim(),
        `${topic.id}: ${c.name}`,
      );
    }
  }
});
test("Mentor Python view preserves C mount and uses the real existing TopicPractice path", () => {
  const app = readFileSync(
    new URL("../components/mentor/MentorApp.tsx", import.meta.url),
    "utf8",
  );
  const python = readFileSync(
    new URL("../components/mentor/PythonMentorLessons.tsx", import.meta.url),
    "utf8",
  );
  assert.match(app, /hidden=\{technology !== "C"\}/);
  assert.match(app, /\["C", "Python"\]/);
  assert.match(python, /language="python"/);
  assert.match(python, /exercise=\{topic.exercise.python\}/);
  assert.match(python, /key=\{`python:\$\{topic.id\}`\}/);
  assert.match(python, /not the full\s+adaptive C calculator journey/);
  assert.ok(!python.includes("mentor/start") && !python.includes("aiGenerate"));
});
