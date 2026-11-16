import type { LoopState } from "./loop-types";
import {
  emptyStruggleState,
  recordPracticeAttempt,
} from "./struggle-engine.ts";
export const DEBUGGING_TASKS = [
  {
    id: "debug-boundary-v1",
    title: "Fix the age boundary",
    task: "This program rejects someone aged exactly 18. Fix it: print eligible for ages at least 18, otherwise underage.",
    starter:
      "age = int(input())\nif age > 18:\n    print('eligible')\nelse:\n    print('underage')",
    hint: "Check the comparison at exactly 18.",
    tests: [
      { stdin: "0", expected: "underage" },
      { stdin: "17", expected: "underage" },
      { stdin: "18", expected: "eligible" },
      { stdin: "70", expected: "eligible" },
    ],
  },
  {
    id: "debug-loop-v1",
    title: "Fix the missing last number",
    task: "This program misses n when adding 1 through n. Fix it and print the sum. n is a nonnegative integer.",
    starter:
      "n = int(input())\ntotal = 0\nfor i in range(1, n):\n    total += i\nprint(total)",
    hint: "Python range stops before its second argument.",
    tests: [
      { stdin: "0", expected: "0" },
      { stdin: "1", expected: "1" },
      { stdin: "4", expected: "10" },
      { stdin: "7", expected: "28" },
    ],
  },
  {
    id: "debug-return-v1",
    title: "Fix the missing return",
    task: "double(n) should return twice n, but this program prints None. Fix the function and print its returned value.",
    starter:
      "def double(n):\n    result = n * 2\n\nn = int(input())\nprint(double(n))",
    hint: "Calculating result does not return it to the caller.",
    tests: [
      { stdin: "-3", expected: "-6" },
      { stdin: "0", expected: "0" },
      { stdin: "2", expected: "4" },
      { stdin: "9", expected: "18" },
    ],
  },
] as const;
export type DebuggingTask = (typeof DEBUGGING_TASKS)[number];
export type DebugRunItem = {
  statusId: number;
  status: string;
  stdout: string;
  stderr: string;
  compileOutput: string;
};
export function gradeDebugging(task: DebuggingTask, items: unknown) {
  if (!Array.isArray(items) || items.length !== task.tests.length)
    throw Error("Incomplete execution response. No evidence recorded.");
  return task.tests.map((t, i) => {
    const r = items[i] as DebugRunItem;
    if (
      !r ||
      ![3, 4, 5, 6, 7, 8, 9, 10, 11, 12].includes(r.statusId) ||
      typeof r.stdout !== "string" ||
      typeof r.stderr !== "string" ||
      typeof r.compileOutput !== "string" ||
      typeof r.status !== "string"
    )
      throw Error("Execution was not completed. No evidence recorded.");
    return {
      name: `Input ${t.stdin}`,
      hidden: false,
      expected: t.expected,
      actual: r.stdout.trim(),
      passed: r.statusId === 3 && r.stdout.trim() === t.expected,
      status: r.status,
      stderr: r.stderr || r.compileOutput,
    };
  });
}
/** Only client grading of returned sandbox output. No mastery, project or server-attestation claim. */
export function ingestDebuggingResult(
  prev: LoopState,
  owner: string,
  task: DebuggingTask,
  digest: string,
  graded: ReturnType<typeof gradeDebugging>,
  at: number,
  hintUsed = false,
) {
  if (
    prev.sampleProvenance ||
    !owner ||
    !DEBUGGING_TASKS.some((t) => t.id === task.id) ||
    !/^[a-f0-9]{64}$/.test(digest) ||
    graded.length !== task.tests.length
  )
    return prev;
  const id = `debugging:${owner}:${task.id}:${digest}`;
  if (prev.debuggingReceipts?.[id]) return prev;
  const recorded = recordPracticeAttempt(prev.struggle ?? emptyStruggleState, {
    topicId: "debugging",
    topicTitle: "Debugging",
    language: "python",
    exerciseTitle: task.title,
    exerciseHint: task.hint,
    graded,
    source: "practice",
    at,
    performance: { timingQuality: "unavailable", hintsUsed: hintUsed ? 1 : 0 },
  });
  return {
    ...prev,
    debuggingReceipts: { ...prev.debuggingReceipts, [id]: true as const },
    struggle: {
      ...recorded.state,
      attempts: recorded.state.attempts.map((a) =>
        a.id === recorded.outcome.attempt.id ? { ...a, id } : a,
      ),
    },
    activity: [
      {
        at,
        kind: "skill" as const,
        text: `Debugging: ${graded.filter((g) => g.passed).length}/${graded.length} finite checks. Client-graded sandbox output, not general mastery.`,
      },
      ...prev.activity,
    ].slice(0, 40),
  };
}
