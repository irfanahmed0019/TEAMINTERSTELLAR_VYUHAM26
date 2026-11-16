import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
const script = resolve("media/python_decimal_contract.py");
const fixed = `def parse_count(value):\n    if isinstance(value, bool) or not isinstance(value, (int, str)):\n        raise ValueError('type')\n    try:\n        return int(value)\n    except (ValueError, TypeError):\n        raise ValueError('input')\n`;
function fixture(run) {
  const dir = mkdtempSync(join(tmpdir(), "bml-project-"));
  try {
    return run(dir, (args) =>
      spawnSync("python3", ["-I", script, ...args], {
        cwd: dir,
        encoding: "utf8",
        timeout: 2000,
      }),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
function evaluate(source) {
  return fixture((dir, run) => {
    writeFileSync(join(dir, "app.py"), source);
    return run(["app.py", "parse_count"]);
  });
}
test("actual selected Python evaluator rejects baseline then accepts contract fix without executing module", () => {
  const baseline = evaluate("def parse_count(value):\n    return int(value)\n");
  assert.notEqual(baseline.status, 0);
  assert.match(baseline.stderr, /contract failed/);
  const pass = evaluate(
    "raise RuntimeError('whole module MUST NOT run')\n" +
      fixed +
      "\ndef unrelated():\n    raise RuntimeError('not selected')\n",
  );
  assert.equal(pass.status, 0, pass.stderr);
  assert.match(pass.stdout, /BML_DECIMAL_CONTRACT_14_PASS/);
});
test("strict grammar rejects ambient code, loops, recursion, large AST and dynamic access before execution", () => {
  for (const body of [
    "import os\n    return int(value)",
    "return value.__class__",
    "while True: pass",
    "return parse_count(value)",
    "return int(value) * 999999999",
    'return getattr(value, "strip")()',
  ]) {
    const result = evaluate("def parse_count(value):\n    " + body);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Unsupported|unsupported|dependency/);
    assert.ok(!result.error, "unsupported syntax must reject before timeout");
  }
  assert.notEqual(
    evaluate("def parse_count(value):\n" + "    pass\n".repeat(130)).status,
    0,
  );
});
const ownTests = `import pytest\nfrom app.inputs import parse_count as parse\n\ndef test_existing_decimal_contract():\n    assert parse('23') == 23\n    assert parse(' -5 ') == -5\n    with pytest.raises(ValueError):\n        parse(True)\n\ndef dangerous_fixture():\n    raise RuntimeError('test helper must not run')\n`;
test("real multi-function module and own aliased literal tests produce failing baseline provenance, fix passes pinned tests", () =>
  fixture((dir, run) => {
    mkdirSync(join(dir, "app"));
    writeFileSync(
      join(dir, "app", "inputs.py"),
      "import no_such_module\n\ndef helper():\n    raise RuntimeError('not run')\n\ndef parse_count(value):\n    return int(value)\n",
    );
    writeFileSync(join(dir, "test_inputs.py"), ownTests);
    const inspect = run([
      "--inspect",
      "app/inputs.py",
      "parse_count",
      "test_inputs.py",
    ]);
    assert.equal(inspect.status, 0, inspect.stderr);
    const info = JSON.parse(inspect.stdout);
    assert.equal(info.cases.length, 3);
    assert.equal(info.baseline_failures, 1);
    assert.match(info.test_digest, /^[a-f0-9]{64}$/);
    assert.equal(info.skipped, 1);
    writeFileSync(
      join(dir, "app", "inputs.py"),
      "import no_such_module\n" + fixed,
    );
    const evaluated = run([
      "app/inputs.py",
      "parse_count",
      "test_inputs.py",
      info.test_digest,
    ]);
    assert.equal(evaluated.status, 0, evaluated.stderr);
    assert.match(evaluated.stdout, /BML_PINNED_TEST_/);
    writeFileSync(
      join(dir, "test_inputs.py"),
      ownTests + "\n# changed after assignment",
    );
    const drift = run([
      "app/inputs.py",
      "parse_count",
      "test_inputs.py",
      info.test_digest,
    ]);
    assert.notEqual(drift.status, 0);
    assert.match(drift.stderr, /digest changed/);
    assert.equal(
      drift.status,
      3,
      "provenance drift is blocked evaluation, not skill failure",
    );
  }));
test("passing existing tests never fabricate a repair, wrong module and arbitrary fixtures cannot establish cases", () =>
  fixture((dir, run) => {
    writeFileSync(
      join(dir, "app.py"),
      "def parse_count(value):\n    return int(value)\n",
    );
    for (const [content, reason] of [
      [
        "from app import parse_count\nassert parse_count('23') == 23\nassert parse_count('0') == 0",
        /already pass/,
      ],
      [
        "from wrong import parse_count\nassert parse_count('23') == 23\nassert parse_count(True) == 1",
        /2-32/,
      ],
      [
        "from app import parse_count\ndef test_fixture(value):\n    assert parse_count(value)==1",
        /2-32/,
      ],
    ]) {
      writeFileSync(join(dir, "tests.py"), content);
      const result = run(["--inspect", "app.py", "parse_count", "tests.py"]);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, reason);
    }
  }));
test("strip baseline and ValueError tests inspect safely; path escape rejected", () =>
  fixture((dir, run) => {
    writeFileSync(
      join(dir, "app.py"),
      "def parse_count(value):\n    return int(value.strip())\n",
    );
    writeFileSync(
      join(dir, "tests.py"),
      "import pytest\nfrom app import parse_count\nassert parse_count('23')==23\nwith pytest.raises(ValueError):\n    parse_count(True)\n",
    );
    const result = run(["--inspect", "app.py", "parse_count", "tests.py"]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).baseline_failures, 1);
    const escape = run(["../outside.py", "parse_count"]);
    assert.notEqual(escape.status, 0);
    assert.match(escape.stderr, /Unsupported/);
  }));

test("builtin shadowing, recursion and local binding routes reject before timeout", () =>
  fixture((dir, run) => {
    for (const [name, source] of [
      ["int", fixed.replace("def parse_count(", "def int(")],
      ["int", "def int(value):\n    return int(value)"],
      ["parse_count", "def parse_count(int):\n    return int(int)"],
      [
        "parse_count",
        "def parse_count(value):\n    int = parse_count\n    return int(value)",
      ],
      [
        "parse_count",
        "def parse_count(value):\n    return (int := parse_count)(value)",
      ],
      [
        "parse_count",
        "def parse_count(value):\n    try:\n        return int(value)\n    except ValueError as int:\n        return int(value)",
      ],
      ["parse_count", "def parse_count(value):\n    return parse_count(value)"],
    ]) {
      writeFileSync(join(dir, "app.py"), source);
      const result = run(["app.py", name]);
      assert.equal(result.status, 3, result.stderr);
      assert.ok(!result.error, "must reject before subprocess timeout");
      assert.ok(!result.stdout.includes("BML_DECIMAL_CONTRACT_14_PASS"));
      assert.match(
        result.stderr,
        /shadows|bindings|recursion|Unsupported function/,
      );
    }
  }));
test("finite loop practice evaluates real correct/wrong/missing/no-loop Python files", () => {
  const script = resolve("media/python_loops_practice.py");
  const folder = mkdtempSync(join(tmpdir(), "bml-loop-"));
  try {
    for (const [code, source] of [
      [
        0,
        'a,b=0,1\nfor i in range(10):\n print(a,end=" " if i<9 else "")\n a,b=b,a+b\n',
      ],
      [1, 'for i in range(10): print(i,end=" ")'],
      [1, 'print("0 1 1 2 3 5 8 13 21 34")'],
    ]) {
      writeFileSync(join(folder, "main.py"), source);
      const r = spawnSync("python3", ["-I", script], {
        cwd: folder,
        encoding: "utf8",
        timeout: 6000,
      });
      assert.equal(r.status, code, r.stdout + r.stderr);
      assert.equal(r.stdout.includes("BML_PRACTICE_PASS:"), code === 0);
    }
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});
