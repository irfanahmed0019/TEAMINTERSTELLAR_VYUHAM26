import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { INPUT_VALIDATION_TOPIC as topic } from "./input-validation-topic.ts";
for (const language of ["python", "c"])
  test(
    "authored input-validation reference executes real finite checks: " +
      language,
    () => {
      const dir = mkdtempSync(join(tmpdir(), "bml-validate-"));
      try {
        const path = join(dir, language === "c" ? "main.c" : "main.py");
        writeFileSync(path, topic.exercise[language].solution);
        if (language === "c") {
          const c = spawnSync(
            "gcc",
            ["-std=c11", "-Wall", "-Werror", path, "-o", join(dir, "main")],
            { encoding: "utf8" },
          );
          assert.equal(c.status, 0, c.stderr);
        }
        for (const t of topic.exercise[language].tests) {
          const r = spawnSync(
            language === "c" ? join(dir, "main") : "python3",
            language === "c" ? [] : [path],
            { input: t.stdin, encoding: "utf8", timeout: 3000 },
          );
          assert.equal(r.status, 0, r.stderr);
          assert.equal(r.stdout.trim(), t.expected, t.name);
        }
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  );
