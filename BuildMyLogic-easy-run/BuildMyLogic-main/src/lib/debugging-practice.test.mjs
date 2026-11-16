import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  DEBUGGING_TASKS,
  gradeDebugging,
  ingestDebuggingResult,
} from "./debugging-practice.ts";
import { competencyView } from "./competency.ts";
const fixed = [
  "age=int(input())\nprint('eligible' if age>=18 else 'underage')",
  "n=int(input())\nprint(sum(range(1,n+1)))",
  "def double(n):\n return n*2\nprint(double(int(input())))",
];
const base = () => ({
  activity: [],
  sessions: [],
  missionProgress: { m: { status: "active" } },
  plan: { skills: [{ name: "Conditions", level: 0 }], missions: [] },
});
function run(task, code) {
  return task.tests.map((t) => {
    const p = spawnSync("python3", ["-I", "-c", code], {
      input: t.stdin + "\n",
      encoding: "utf8",
      timeout: 2000,
    });
    return {
      statusId: p.status === 0 ? 3 : 11,
      status: p.status === 0 ? "Accepted" : "Runtime Error",
      stdout: p.stdout,
      stderr: p.stderr,
      compileOutput: "",
    };
  });
}
test("all three authored broken programs fail, real fixed Python passes four cases", () => {
  DEBUGGING_TASKS.forEach((t, i) => {
    assert.ok(gradeDebugging(t, run(t, t.starter)).some((r) => !r.passed));
    assert.ok(gradeDebugging(t, run(t, fixed[i])).every((r) => r.passed));
  });
});
test("actual fail then fix updates only Debugging central estimate, replay/restore dedup, projects unchanged", () => {
  const b = base(),
    t = DEBUGGING_TASKS[0],
    fail = gradeDebugging(t, run(t, t.starter)),
    pass = gradeDebugging(t, run(t, fixed[0]));
  const a = ingestDebuggingResult(b, "qa", t, "a".repeat(64), fail, 1000),
    s = ingestDebuggingResult(a, "qa", t, "b".repeat(64), pass, 2000);
  const before = competencyView(a).find((c) => c.skill === "Debugging"),
    after = competencyView(s).find((c) => c.skill === "Debugging");
  assert.ok(after.estimate > before.estimate);
  assert.equal(after.observations, 2);
  assert.equal(s.struggle.attempts.length, 2);
  assert.equal(s.missionProgress, b.missionProgress);
  assert.equal(
    competencyView(s).find((c) => c.skill === "Conditions").estimate,
    null,
  );
  assert.equal(
    ingestDebuggingResult(s, "qa", t, "b".repeat(64), pass, 3000),
    s,
  );
  const restored = JSON.parse(JSON.stringify(s));
  assert.equal(
    ingestDebuggingResult(restored, "qa", t, "b".repeat(64), pass, 4000),
    restored,
  );
});
test("incomplete/pending/internal-error responses cannot create fake failures or passes", () => {
  const t = DEBUGGING_TASKS[0];
  for (const raw of [
    [],
    null,
    [{}],
    t.tests.map(() => ({
      statusId: 13,
      status: "Internal error",
      stdout: "",
      stderr: "",
      compileOutput: "",
    })),
  ])
    assert.throws(() => gradeDebugging(t, raw));
  const b = base();
  assert.equal(ingestDebuggingResult(b, "", t, "a".repeat(64), [], 1), b);
  assert.equal(
    ingestDebuggingResult(
      { ...b, sampleProvenance: {} },
      "qa",
      t,
      "a".repeat(64),
      gradeDebugging(t, run(t, fixed[0])),
      1,
    ).struggle,
    undefined,
  );
});
