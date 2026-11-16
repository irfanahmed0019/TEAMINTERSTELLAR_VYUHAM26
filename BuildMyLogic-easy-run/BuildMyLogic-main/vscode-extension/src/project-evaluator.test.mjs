import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
const script = resolve("media/python_decimal_contract.py");
function evaluate(source) {
  const dir = mkdtempSync(join(tmpdir(), "bml-project-"));
  try {
    writeFileSync(join(dir, "app.py"), source);
    return spawnSync("python3", ["-I", script, "app.py", "parse_count"], {
      cwd: dir,
      encoding: "utf8",
      timeout: 2000,
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
test("actual selected Python evaluator rejects real baseline then accepts contract fix", () => {
  const baseline = evaluate("def parse_count(value):\n    return int(value)\n");
  assert.notEqual(baseline.status, 0);
  assert.match(baseline.stderr, /Invalid input accepted/);
  const fixed = evaluate(
    `raise RuntimeError('whole module MUST NOT run')\ndef parse_count(value):\n    if isinstance(value, bool) or not isinstance(value, (int, str)):\n        raise ValueError('type')\n    try:\n        return int(value)\n    except (ValueError, TypeError):\n        raise ValueError('input')\n`,
  );
  assert.equal(fixed.status, 0, fixed.stderr);
  assert.match(fixed.stdout, /BML_DECIMAL_CONTRACT_14_PASS/);
});
test("selected function cannot import ambient file/network code or use dunder access", () => {
  for (const source of [
    "def parse_count(value):\n    import os\n    return int(value)",
    "def parse_count(value):\n    return value.__class__",
  ]) {
    const result = evaluate(source);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Unsupported/);
  }
});
test("function missing/ambiguous and infinite loop cannot fabricate evaluator pass", () => {
  assert.notEqual(
    evaluate("def other(value):\n    return int(value)").status,
    0,
  );
  const result = evaluate("def parse_count(value):\n    while True: pass");
  assert.ok(result.error || result.signal);
  assert.ok(!result.stdout.includes("BML_DECIMAL_CONTRACT_14_PASS"));
});
