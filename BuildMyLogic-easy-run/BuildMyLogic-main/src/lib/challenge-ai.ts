export type ReviewChallenge = {
  id: string;
  title: string;
  concept: string;
  brief: string;
  claim: string;
  code: string;
  inputLabel: string;
  placeholder: string;
  example: string;
  hint: string;
  parse: (raw: string) => number | number[];
  candidate: (input: number | number[]) => number;
  reference: (input: number | number[]) => number;
  reasons: string[];
  correctReason: number;
  explanation: string;
};

function integer(raw: string): number {
  if (!/^\d{1,3}$/.test(raw.trim()))
    throw new Error("Use one whole number from 0 to 120.");
  const n = Number(raw.trim());
  if (n > 120) throw new Error("Use one whole number from 0 to 120.");
  return n;
}
function list(raw: string): number[] {
  let values: unknown;
  try {
    values = JSON.parse(raw);
  } catch {
    throw new Error("Use a JSON list, such as [2, 5, 2].");
  }
  if (
    !Array.isArray(values) ||
    values.length < 1 ||
    values.length > 12 ||
    values.some(
      (v) => typeof v !== "number" || !Number.isInteger(v) || Math.abs(v) > 100,
    )
  )
    throw new Error("Use 1 to 12 whole numbers, each from -100 to 100.");
  return values as number[];
}

export const REVIEW_CHALLENGES: ReviewChallenge[] = [
  {
    id: "boundary",
    title: "The boundary trap",
    concept: "Conditions",
    brief:
      "Return 1 if a visitor is at least 18 years old; otherwise return 0. Ages are whole numbers from 0 to 120.",
    claim: "It works for age 20. Ready to ship?",
    code: "function check(age) {\n  return age > 18 ? 1 : 0;\n}",
    inputLabel: "Visitor age",
    placeholder: "One whole number",
    example: "20",
    hint: "At least includes the exact boundary. Test the point where the rule changes.",
    parse: integer,
    candidate: (input) => ((input as number) > 18 ? 1 : 0),
    reference: (input) => ((input as number) >= 18 ? 1 : 0),
    reasons: [
      "The comparison excludes a value the specification includes.",
      "JavaScript cannot compare whole numbers.",
      "Every visitor should be accepted.",
    ],
    correctReason: 0,
    explanation:
      "At age 18, > returns false but at least 18 requires true. Testing an ordinary value like 20 cannot distinguish > from >=. Your boundary test can.",
  },
  {
    id: "maximum",
    title: "The invisible assumption",
    concept: "Loops & initialization",
    brief:
      "Return the largest number in a non-empty list of 1 to 12 whole numbers. Each value is between -100 and 100, including negatives.",
    claim: "It returns 9 for [3, 9, 2]. All good?",
    code: "function check(values) {\n  let best = 0;\n  for (const value of values) {\n    if (value > best) best = value;\n  }\n  return best;\n}",
    inputLabel: "Number list",
    placeholder: "[3, 9, 2]",
    example: "[3, 9, 2]",
    hint: "The initial value is not necessarily in the list. What if every valid value is smaller?",
    parse: list,
    candidate: (input) => {
      let best = 0;
      for (const value of input as number[]) if (value > best) best = value;
      return best;
    },
    reference: (input) => Math.max(...(input as number[])),
    reasons: [
      "The loop skips the final value.",
      "Starting at zero assumes the maximum cannot be negative.",
      "A list can never contain negative numbers.",
    ],
    correctReason: 1,
    explanation:
      "If every number is negative, none replaces zero. The function then returns a number absent from the list. Initialize from the first element, not an unsupported assumption.",
  },
  {
    id: "duplicates",
    title: "The happy-path illusion",
    concept: "Arrays & assumptions",
    brief:
      "Count distinct values in a non-empty list of 1 to 12 whole numbers from -100 to 100. The list can be in any order.",
    claim: "It counts 2 distinct values in [2, 2, 7]. Looks correct?",
    code: "function check(values) {\n  let count = 1;\n  for (let i = 1; i < values.length; i++) {\n    if (values[i] !== values[i - 1]) count++;\n  }\n  return count;\n}",
    inputLabel: "Number list",
    placeholder: "[2, 2, 7]",
    example: "[2, 2, 7]",
    hint: "It notices neighbors. Must equal values always be next to each other?",
    parse: list,
    candidate: (input) => {
      const values = input as number[];
      let count = 1;
      for (let i = 1; i < values.length; i++)
        if (values[i] !== values[i - 1]) count++;
      return count;
    },
    reference: (input) => new Set(input as number[]).size,
    reasons: [
      "It counts changes between neighbors, not distinct values in any order.",
      "It should return the length for every list.",
      "Comparing adjacent values always sorts a list.",
    ],
    correctReason: 0,
    explanation:
      "Equal values can be separated by another value. This code counts runs, which equals the distinct count only when each value stays in one block. A Set tracks values regardless of order.",
  },
];

export function reviewTest(
  challenge: ReviewChallenge,
  raw: string,
  prediction: string,
) {
  const input = challenge.parse(raw);
  if (!/^-?\d{1,4}$/.test(prediction.trim()))
    throw new Error(
      "Predict one whole-number output before running your test.",
    );
  const expected = challenge.reference(input);
  const actual = challenge.candidate(input);
  return {
    input,
    predicted: Number(prediction),
    expected,
    actual,
    breaks: actual !== expected,
    predictedCorrectly: Number(prediction) === expected,
  };
}
