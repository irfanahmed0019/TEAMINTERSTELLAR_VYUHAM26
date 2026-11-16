import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { STUDY_TOPICS } from "./topic-library.ts";
const topic = STUDY_TOPICS.find((t) => t.id === "conditions");
for (const language of ["c", "python"])
  test(`${language} conditions checks cover zero and kill >= boundary mutant`, () => {
    const ex = topic.exercise[language];
    assert.deepEqual(
      ex.tests.map((t) => Number(t.stdin)).sort((a, b) => a - b),
      [-3, 0, 8],
    );
    const dir = mkdtempSync(join(tmpdir(), "bml-condition-"));
    try {
      function run(code, input) {
        const path = join(dir, language === "c" ? "main.c" : "main.py");
        writeFileSync(path, code);
        if (language === "c") {
          const c = spawnSync("gcc", [path, "-o", join(dir, "main")], {
            encoding: "utf8",
          });
          assert.equal(c.status, 0, c.stderr);
        }
        const r = spawnSync(
          language === "c" ? join(dir, "main") : "python3",
          language === "c" ? [] : [path],
          { input, encoding: "utf8", timeout: 3000 },
        );
        assert.equal(r.status, 0, r.stderr);
        return r.stdout.trim();
      }
      for (const t of ex.tests)
        assert.equal(run(ex.solution, t.stdin), t.expected, t.name);
      const wrong = ex.solution.replace("n > 0", "n >= 0");
      assert.notEqual(wrong, ex.solution);
      const results = ex.tests.map((t) => run(wrong, t.stdin) === t.expected);
      assert.equal(results.filter(Boolean).length, 2);
      assert.equal(results[2], false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
