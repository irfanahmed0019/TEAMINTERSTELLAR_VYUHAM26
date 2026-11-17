import { PRACTICE_TASKS } from "./practice-task.ts";
import type { Reassessment } from "./struggle-engine";
/** Fixed, source-aware changed contracts. Two tasks prove this checkpoint only. */
export function newPracticeReassessment(
  source: string | undefined,
  stage: 1 | 2,
  at: number,
): Reassessment | null {
  if (stage !== 1 && stage !== 2) return null;
  const concept = PRACTICE_TASKS.find((t) => t.id === source)?.concept;
  if (!concept || concept === "arithmetic") return null;
  const catalog = {
    conditions: [
      {
        title: "Even or odd",
        task: "Read one integer. Use if/else to print even if divisible by 2, otherwise odd.",
        cases: [
          ["-3\n", "odd"],
          ["0\n", "even"],
          ["14\n", "even"],
          ["9\n", "odd"],
        ],
        regex: "\\bif\\b",
      },
      {
        title: "Temperature bands",
        task: "Read one integer. Print cold below 0, warm from 0 through 30, or hot above 30. Use conditions.",
        cases: [
          ["-1\n", "cold"],
          ["0\n", "warm"],
          ["30\n", "warm"],
          ["31\n", "hot"],
        ],
        regex: "\\bif\\b",
      },
    ],
    loops: [
      {
        title: "Sum even numbers",
        task: "Read a nonnegative integer n. Use a loop to sum even integers from 0 through n, then print the sum.",
        cases: [
          ["0\n", "0"],
          ["2\n", "2"],
          ["7\n", "12"],
          ["10\n", "30"],
        ],
        regex: "\\b(for|while)\\b",
      },
      {
        title: "Count odd numbers",
        task: "Read a nonnegative integer n. Use a loop to count odd integers from 1 through n, then print the count.",
        cases: [
          ["0\n", "0"],
          ["1\n", "1"],
          ["6\n", "3"],
          ["9\n", "5"],
        ],
        regex: "\\b(for|while)\\b",
      },
    ],
    functions: [
      {
        title: "Cube through a function",
        task: "Define cube(n) returning n * n * n. Read an integer, call cube and print its result.",
        cases: [
          ["-2\n", "-8"],
          ["0\n", "0"],
          ["3\n", "27"],
          ["4\n", "64"],
        ],
        regex: "def\\s+cube\\s*\\(",
      },
      {
        title: "Distance from zero",
        task: "Define distance(n) returning the nonnegative distance from zero. Read an integer, call distance and print its result.",
        cases: [
          ["-7\n", "7"],
          ["0\n", "0"],
          ["4\n", "4"],
          ["-1\n", "1"],
        ],
        regex: "def\\s+distance\\s*\\(",
      },
    ],
    strings: [
      {
        title: "Count spaces",
        task: "Read one complete line, possibly empty. Use a loop to count literal spaces. Print the count, excluding the input newline.",
        cases: [
          [" a  b \n", "4"],
          ["abc\n", "0"],
          ["\n", "0"],
          ["a b\n", "1"],
        ],
        regex: "\\b(for|while)\\b",
      },
      {
        title: "Count digits",
        task: "Read one complete line. Use a loop to count ASCII digits 0 through 9. Print the count.",
        cases: [
          ["a1b2\n", "2"],
          ["abc\n", "0"],
          ["\n", "0"],
          ["90 8x\n", "3"],
        ],
        regex: "\\b(for|while)\\b",
      },
    ],
  };
  const item = catalog[concept][stage - 1]!;
  return {
    version: "practice-transfer-v1",
    practiceStage: stage,
    practiceSource: source,
    title: item.title,
    task: item.task,
    tests: item.cases.map(([stdin, expected], i) => ({
      name: `Practice ${stage} check ${i + 1}`,
      stdin: stdin!,
      expected: expected!,
      unseen: true,
    })),
    createdAt: at,
    attempts: 0,
    constructRegex: item.regex,
    constructSelfCall: concept === "functions",
    constructLabel:
      "the requested Python construct. Finite checks are not proof of independence",
  };
}
