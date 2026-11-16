/** Explicit standalone practice. Finite cases do not establish general skill. */
export const PRACTICE_TASKS = [
  {
    id: "python-loops-fibonacci-v1",
    concept: "loops",
    title: "Loop practice",
    question:
      "In main.py, use a loop to print the first 10 Fibonacci numbers, starting 0, 1.\nSeparate the numbers with spaces.",
    cases: 1,
  },
  {
    id: "python-conditions-sign-v1",
    concept: "conditions",
    title: "Conditions practice",
    question:
      "In main.py, read one integer. Use if/else to print negative, zero or positive.\nPrint only that word in lowercase.",
    cases: 3,
  },
  {
    id: "python-functions-double-v1",
    concept: "functions",
    title: "Functions practice",
    question:
      "In main.py, write double(n) to return n * 2. Read one integer and call double.\nPrint the returned number.",
    cases: 3,
  },
  {
    id: "python-strings-vowels-v1",
    concept: "strings",
    title: "Strings practice",
    question:
      "In main.py, read one lowercase word. Use a loop to count a, e, i, o and u.\nPrint the count.",
    cases: 3,
  },
] as const;
export type PracticeTaskId = (typeof PRACTICE_TASKS)[number]["id"];
export function practiceTaskBody(value: unknown) {
  const task = PRACTICE_TASKS.find((t) => t.id === value);
  if (!task) return null;
  return {
    challenge_id: task.id,
    title: task.title,
    language: "Python",
    concept: task.concept,
    instructions: task.question,
    expected_skills: [task.concept],
    expected_duration_ms: 300000,
    test_command: "buildmylogic:" + task.id,
    checkpoints: [
      {
        title: task.title,
        detail: `Standalone Python practice: ${task.cases} authored output ${task.cases === 1 ? "case" : "cases"}. Not proof of general skill.`,
        evaluator: {
          id: task.id,
          command: "buildmylogic:" + task.id,
          expectedOutputIncludes: ["BML_PRACTICE_PASS:" + task.id],
        },
      },
    ],
  };
}
/** A relevance suggestion from what the learner said, never a diagnosis or automatic assignment. */
export function suggestedPracticeId(text: string): PracticeTaskId | null {
  if (/\b(loop|loops|iteration|iterate)\b/i.test(text))
    return "python-loops-fibonacci-v1";
  if (/\b(condition|conditions|if|else|branch|branches)\b/i.test(text))
    return "python-conditions-sign-v1";
  if (/\b(function|functions|return|parameter|parameters)\b/i.test(text))
    return "python-functions-double-v1";
  if (/\b(string|strings|word|words|vowel|vowels)\b/i.test(text))
    return "python-strings-vowels-v1";
  return null;
}
