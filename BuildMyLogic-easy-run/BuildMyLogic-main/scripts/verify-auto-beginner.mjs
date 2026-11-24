import { readFileSync, writeFileSync, rmSync } from "node:fs";
// All persistence and surprise routing below are isolated fixtures, never live data.
import assert from "node:assert/strict";
const root = process.cwd(),
  file = root + "/src/lib/auto-beginner.testable.tmp.ts";
let source = readFileSync(root + "/src/lib/learning-sessions.server.ts", "utf8")
  .replace(
    'import { sarvamJson } from "./sarvam.server";',
    'const sarvamJson=async()=>{throw Error("No AI");};',
  )
  .replace(
    'import { claimNextSurprise } from "./surprise-slot.server.ts";',
    "const claimNextSurprise=async()=>false;",
  );
writeFileSync(file, source);
process.on("exit", () => rmSync(file, { force: true }));
process.env.SUPABASE_SERVICE_ROLE_KEY = "qa";
process.env.VITE_SUPABASE_URL = "https://qa.supabase.co";
delete process.env.NODE_ENV;
let row;
globalThis.fetch = async (url, options = {}) => {
  if ((options.method ?? "GET") === "GET")
    return Response.json(row ? [row] : []);
  const data = JSON.parse(options.body);
  row = { ...row, ...data };
  return Response.json([{ session_id: row.session_id }]);
};
const m = await import(file);
const { practiceTaskBody } = await import(root + "/src/lib/practice-task.ts");
for (const id of ["python-loops-triangular-v1", "python-conditions-sign-v1"]) {
  row = undefined;
  const s = await m.startLearningSession({ ...practiceTaskBody(id) });
  for (let n = 1; n <= 3; n++) {
    const r = await m.recordPracticeTestResult(s, {
      passed: 0,
      total: 1,
      status: "failed",
      checkpoint_results: [
        {
          index: 0,
          passed: false,
          output: "Wrong output",
          evidence_kind: "assertion",
          evaluator_id: id,
        },
      ],
    });
    assert.equal(r.challenge_id, n < 3 ? id : "python-arithmetic-add-v1");
  }
  assert.equal(s.practiceHistory[0].state.attempts, 3);
  assert.equal(s.practiceHistory[0].state.test_score.passed, 0);
  assert.equal(s.attempts, 0);
}
console.log(
  "PASS automatic server3real test events for loops and conditions, archives3failed attempts, resets arithmetic without fake pass",
);
