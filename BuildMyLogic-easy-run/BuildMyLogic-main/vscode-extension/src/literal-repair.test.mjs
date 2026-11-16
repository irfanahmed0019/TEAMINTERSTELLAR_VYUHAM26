import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";
const evaluator = resolve("media/python_literal_repair.py");
function fixture(fn) {
  const dir = mkdtempSync(join(tmpdir(), "bml-utility-"));
  try {
    mkdirSync(join(dir, "shop"));
    const run = (args) =>
      spawnSync("python3", ["-I", evaluator, ...args], {
        cwd: dir,
        encoding: "utf8",
        timeout: 2000,
      });
    return fn(dir, run);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
const baseline =
  "def sale_price(price, discount):\n    return price + discount";
const repaired =
  "def sale_price(price, discount):\n    if price < discount:\n        return 0\n    return price - discount";
const tests = `from shop.prices import sale_price as price\n\ndef test_approved_prices():\n    assert price(20, 5) == 15\n    assert price(4, 5) == 0\n    assert price(5, 5) == 0\n\ndef unrelated_helper():\n    raise RuntimeError('must not execute')\n`;
function inspect(dir, run, source = baseline, testSource = tests) {
  writeFileSync(
    join(dir, "shop", "prices.py"),
    "import missing_dependency\n" +
      source +
      "\ndef unused():\n    raise RuntimeError('never run')\n",
  );
  writeFileSync(join(dir, "test_prices.py"), testSource);
  return run(["--inspect", "shop/prices.py", "sale_price", "test_prices.py"]);
}
function grade(run, contract) {
  return run([
    "shop/prices.py",
    "sale_price",
    "test_prices.py",
    contract.test_digest,
    contract.arguments.join(","),
    contract.cases_digest,
  ]);
}
test("real multi-function utility repair derives oracle from own tests, baseline fails and corrected function passes", () =>
  fixture((dir, run) => {
    const initial = inspect(dir, run);
    assert.equal(initial.status, 0, initial.stderr);
    const info = JSON.parse(initial.stdout);
    assert.equal(info.kind, "python-literal-repair-v1");
    assert.equal(info.baseline_failures, 3);
    assert.equal(info.skipped, 1);
    assert.deepEqual(info.arguments, ["price", "discount"]);
    assert.equal(JSON.parse(info.cases_json).length, 3);
    const failure = grade(run, info);
    assert.equal(failure.status, 1);
    assert.match(failure.stdout, /cases failed/);
    writeFileSync(
      join(dir, "shop", "prices.py"),
      "raise RuntimeError('module MUST NOT execute')\n" + repaired,
    );
    const result = grade(run, info);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /BML_LITERAL_REPAIR_V1_PASS/);
    writeFileSync(join(dir, "test_prices.py"), tests + "\n# changed");
    const drift = grade(run, info);
    assert.equal(drift.status, 3);
    assert.match(drift.stderr, /digest changed/);
  }));
test("string normalization and boolean threshold are project-specific oracles, not decimal substitutes", () =>
  fixture((dir, run) => {
    for (const [source, fix, own] of [
      [
        "def sale_price(label):\n    return label",
        "def sale_price(label):\n    return label.strip().lower()",
        "from shop.prices import sale_price\nassert sale_price('  HELLO ')=='hello'\nassert sale_price(' World')=='world'",
      ],
      [
        "def sale_price(age):\n    return age > 18",
        "def sale_price(age):\n    return age >= 18",
        "from shop.prices import sale_price\nassert sale_price(18)==True\nassert sale_price(17)==False",
      ],
    ]) {
      const initial = inspect(dir, run, source, own);
      assert.equal(initial.status, 0, initial.stderr);
      const info = JSON.parse(initial.stdout);
      writeFileSync(join(dir, "shop", "prices.py"), fix);
      assert.equal(grade(run, info).status, 0);
    }
  }));
test("passing baseline and bool/int equality follow actual project assertion semantics", () =>
  fixture((dir, run) => {
    assert.equal(inspect(dir, run, repaired).status, 3);
    const typed = inspect(
      dir,
      run,
      "def sale_price(value):\n    return 1",
      "from shop.prices import sale_price\nassert sale_price(1)==True\nassert sale_price(0)==False",
    );
    assert.equal(typed.status, 0, typed.stderr);
    assert.equal(JSON.parse(typed.stdout).baseline_failures, 1);
  }));
test("unsafe grammar, names, allocation and alias ambiguity block without process timeout", () =>
  fixture((dir, run) => {
    const own =
      "from shop.prices import sale_price\nassert sale_price(2)==4\nassert sale_price(3)==6";
    for (const source of [
      "def sale_price(value):\n    return sale_price(value)",
      "def sale_price(value):\n    import os\n    return 4",
      "def sale_price(value):\n    while True: pass",
      "def sale_price(value):\n    return value.__class__",
      "def sale_price(value):\n    return 2 ** 1000000",
      'def sale_price(value):\n    return "x" * 1000000',
      "def sale_price(int):\n    return int(int)",
      "def sale_price(value):\n    def int(value):\n        return value\n    return int(value)",
      "def sale_price(value):\n    return 999999 * 999999",
    ]) {
      const result = inspect(dir, run, source, own);
      assert.equal(result.status, 3, result.stderr);
      assert.ok(!result.error, "must block before timeout");
      assert.ok(!result.stdout.includes("BML_LITERAL_REPAIR_V1_PASS"));
    }
    for (const suffix of [
      "\nfrom other import sale_price as price",
      "\nprice = other",
    ]) {
      const result = inspect(dir, run, baseline, tests + suffix);
      assert.equal(result.status, 3);
      assert.match(result.stderr, /alias/);
    }
  }));
test("grade-time function signature and case-binding changes block", () =>
  fixture((dir, run) => {
    const info = JSON.parse(inspect(dir, run).stdout);
    writeFileSync(
      join(dir, "shop", "prices.py"),
      "def sale_price(cost, discount):\n    return cost - discount",
    );
    assert.equal(grade(run, info).status, 3);
    writeFileSync(join(dir, "shop", "prices.py"), repaired);
    const bad = { ...info, cases_digest: "a".repeat(64) };
    assert.equal(grade(run, bad).status, 3);
  }));

test("nested alias rebinding, unsafe defaults and grade-time builtin shadowing block", () =>
  fixture((dir, run) => {
    const info = JSON.parse(inspect(dir, run).stdout);
    for (const source of [
      "def sale_price(price, discount=0):\n    return price - discount",
      "def sale_price(int, discount):\n    return int - discount",
      "def sale_price(price, discount):\n    return abs",
      "def sale_price(price, discount):\n    return price.strip",
      "def sale_price(price, discount):\n    return 99999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999",
    ]) {
      writeFileSync(join(dir, "shop", "prices.py"), source);
      const result = grade(run, info);
      assert.equal(result.status, 3, result.stderr);
      assert.ok(!result.error);
    }
    for (const suffix of [
      "\nif True:\n    from other import sale_price as price",
      "\ntry:\n    pass\nexcept ValueError as price:\n    pass",
      "\nprice.__code__ = malicious",
    ]) {
      const result = inspect(dir, run, baseline, tests + suffix);
      assert.equal(result.status, 3, result.stderr);
    }
  }));

test("existing project equality follows Python numeric and bool semantics", () =>
  fixture((dir, run) => {
    for (const [source, fix, own] of [
      [
        "def sale_price(value):\n    return value + 1",
        "def sale_price(value):\n    return value // 2",
        "from shop.prices import sale_price\nassert sale_price(4)==2.0\nassert sale_price(8)==4.0",
      ],
      [
        "def sale_price(value):\n    return value + 1",
        "def sale_price(value):\n    return value / 2",
        "from shop.prices import sale_price\nassert sale_price(4)==2\nassert sale_price(8)==4",
      ],
    ]) {
      const initial = inspect(dir, run, source, own);
      assert.equal(initial.status, 0, initial.stderr);
      const info = JSON.parse(initial.stdout);
      writeFileSync(join(dir, "shop", "prices.py"), fix);
      const result = grade(run, info);
      assert.equal(result.status, 0, result.stderr);
    }
    const initial = inspect(
      dir,
      run,
      "def sale_price(value):\n    return 0",
      "from shop.prices import sale_price\nassert sale_price(1)==True\nassert sale_price(0)==False",
    );
    const info = JSON.parse(initial.stdout);
    writeFileSync(
      join(dir, "shop", "prices.py"),
      "def sale_price(value):\n    return value",
    );
    assert.equal(grade(run, info).status, 0);
  }));
test("malformed evaluator CLI is blocked not failed evidence", () =>
  fixture((dir, run) => {
    for (const args of [
      [],
      ["--inspect"],
      ["missing.py"],
      ["missing.py", "fn", "tests.py"],
    ]) {
      const result = run(args);
      assert.equal(result.status, 3);
      assert.match(result.stderr, /BLOCKED/);
      assert.ok(!result.stderr.includes("Traceback"));
    }
  }));

test("Python equality keeps None/string mismatches false without adding a type oracle", () =>
  fixture((dir, run) => {
    const own =
      "from shop.prices import sale_price\nassert sale_price(1)==True\nassert sale_price(0)==False";
    const info = JSON.parse(
      inspect(dir, run, "def sale_price(value):\n    return None", own).stdout,
    );
    writeFileSync(
      join(dir, "shop", "prices.py"),
      "def sale_price(value):\n    return 'True'",
    );
    assert.equal(grade(run, info).status, 1);
    writeFileSync(
      join(dir, "shop", "prices.py"),
      "def sale_price(value):\n    return value",
    );
    assert.equal(grade(run, info).status, 0);
  }));

test("new reviewed partition grades initial group then different existing inputs, never retroactive holdout", () =>
  fixture((dir, run) => {
    const own =
      "from shop.prices import sale_price\nassert sale_price(20,5)==15\nassert sale_price(4,5)==0\nassert sale_price(5,5)==0\nassert sale_price(100,20)==80";
    inspect(dir, run, baseline, own);
    const initial = run([
      "--inspect-partition",
      "shop/prices.py",
      "sale_price",
      "test_prices.py",
    ]);
    assert.equal(initial.status, 0, initial.stderr);
    const info = JSON.parse(initial.stdout);
    assert.deepEqual(info.partition.initial_indices, [0, 1]);
    assert.deepEqual(info.partition.recheck_indices, [2, 3]);
    assert.deepEqual(info.constructs, ["arithmetic"]);
    const gradeArgs = [
      "shop/prices.py",
      "sale_price",
      "test_prices.py",
      info.test_digest,
      info.arguments.join(","),
      info.cases_digest,
      info.partition.partition_digest,
    ];
    writeFileSync(
      join(dir, "shop", "prices.py"),
      "def sale_price(price, discount):\n    if price == 20:\n        return 15\n    return 0",
    );
    const first = run(gradeArgs);
    assert.equal(first.status, 0, first.stderr);
    assert.match(first.stdout, /BML_PARTITION_/);
    const reserved = run(["--recheck", ...gradeArgs]);
    assert.equal(reserved.status, 1);
    assert.match(reserved.stdout, /cases failed: 4/);
    writeFileSync(join(dir, "shop", "prices.py"), repaired);
    const pass = run(["--recheck", ...gradeArgs]);
    assert.equal(pass.status, 0, pass.stderr);
    assert.match(pass.stdout, /BML_LITERAL_RECHECK_V1_PASS/);
    const drift = run(["--recheck", ...gradeArgs.slice(0, -1), "a".repeat(64)]);
    assert.equal(drift.status, 3);
    // Legacy grading without partition still evaluates ALL approved project cases.
    writeFileSync(
      join(dir, "shop", "prices.py"),
      "def sale_price(price, discount):\n    if price == 20:\n        return 15\n    return 0",
    );
    assert.equal(run(gradeArgs.slice(0, -1)).status, 1);
  }));
test("partition blocks insufficient/repeated/equivalent inputs and passing initial baseline", () =>
  fixture((dir, run) => {
    for (const own of [
      tests,
      "from shop.prices import sale_price\nassert sale_price(1,0)==0\nassert sale_price(1.0,0)==0\nassert sale_price(2,0)==0\nassert sale_price(3,0)==0",
      "from shop.prices import sale_price\nassert sale_price(True,0)==0\nassert sale_price(1,0)==0\nassert sale_price(2,0)==0\nassert sale_price(3,0)==0",
    ]) {
      inspect(dir, run, baseline, own);
      const result = run([
        "--inspect-partition",
        "shop/prices.py",
        "sale_price",
        "test_prices.py",
      ]);
      assert.equal(result.status, 3);
    }
    const own =
      "from shop.prices import sale_price\nassert sale_price(20,5)==25\nassert sale_price(4,5)==9\nassert sale_price(5,5)==0\nassert sale_price(100,20)==80";
    inspect(dir, run, baseline, own);
    const result = run([
      "--inspect-partition",
      "shop/prices.py",
      "sale_price",
      "test_prices.py",
    ]);
    assert.equal(result.status, 3);
    assert.match(result.stderr, /initial project cases already pass/);
  }));
