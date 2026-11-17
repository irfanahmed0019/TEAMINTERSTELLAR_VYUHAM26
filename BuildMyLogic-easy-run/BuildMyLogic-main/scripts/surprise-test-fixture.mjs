import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { practiceTaskBody } from "../src/lib/practice-task.ts";
const temp = new URL("../src/lib/surprise-fixture.tmp.ts", import.meta.url);
writeFileSync(
  temp,
  readFileSync(
    new URL("../src/lib/learning-sessions.server.ts", import.meta.url),
    "utf8",
  ).replace(
    'import { sarvamJson } from "./sarvam.server";',
    'const sarvamJson = async () => { throw new Error("No AI permitted"); };',
  ),
);
writeFileSync(
  temp,
  readFileSync(temp, "utf8").replace(
    'import { claimNextSurprise } from "./surprise-slot.server.ts";',
    'const slots=new Map(); const claimNextSurprise=async(s)=>{const b=[s.sessionId,s.challengeId,s.taskGeneration??0].join(":");if(!slots.has(s.userId))slots.set(s.userId,b);return slots.get(s.userId)===b;};',
  ),
);
try {
  const { startLearningSession, assignPracticeTask, recordEvent, stateOf } =
    await import(temp.href);
  const owner = "123e4567-e89b-42d3-a456-426614174000";
  const s = await startLearningSession({
    ...practiceTaskBody("python-conditions-sign-v1"),
    user_id: owner,
  });
  await assignPracticeTask(
    s,
    s.challengeId,
    { challenge: s.challengeId, generation: 0 },
    "conditions",
  );
  const pending = { ...stateOf(s), verified_owner_id: owner };
  for (const [input, expected] of [
    ["0", "underage"],
    ["17", "underage"],
    ["18", "eligible"],
    ["120", "eligible"],
  ]) {
    const output = execFileSync(
      "python3",
      [
        "-I",
        "-c",
        'n=int(input()); print("eligible" if n >= 18 else "underage")',
      ],
      { input, encoding: "utf8" },
    ).trim();
    if (output !== expected) throw new Error("Actual finite Python failed");
  }
  const c = s.checkpoints[0];
  recordEvent(s, "test_result", {
    checkpoint_results: [
      {
        index: 0,
        passed: true,
        evidence_kind: "assertion",
        evaluator_id: c.evaluator.id,
        output:
          c.evaluator.expectedOutputIncludes.join("\n") +
          "\n4/4 actual isolated Python cases passed",
      },
    ],
  });
  console.log(
    JSON.stringify({
      pending,
      completed: { ...stateOf(s), verified_owner_id: owner },
    }),
  );
} finally {
  rmSync(temp, { force: true });
}
