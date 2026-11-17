/** Explicit standalone practice. Finite cases do not establish general skill. */
export const PRACTICE_TASKS = [
  {
    id: "python-loops-fibonacci-v1",
    concept: "loops",
    title: "Loop practice",
    question:
      "In your Python file, use a loop to print the first 10 Fibonacci numbers, starting 0, 1.\nSeparate the numbers with spaces.",
    cases: 1,
  },
  {
    id: "python-conditions-sign-v1",
    concept: "conditions",
    title: "Conditions practice",
    question:
      "In your Python file, read one integer. Use if/else to print negative, zero or positive.\nPrint only that word in lowercase.",
    cases: 3,
  },
  {
    id: "python-functions-double-v1",
    concept: "functions",
    title: "Functions practice",
    question:
      "In your Python file, write double(n) to return n * 2. Read one integer and call double.\nPrint the returned number.",
    cases: 3,
  },
  {
    id: "python-strings-vowels-v1",
    concept: "strings",
    title: "Strings practice",
    question:
      "In your Python file, read one lowercase word. Use a loop to count a, e, i, o and u.\nPrint the count.",
    cases: 3,
  },
  {
    id: "python-loops-triangular-v1",
    concept: "loops",
    title: "Sum from 1 to n",
    question:
      "Read a nonnegative integer n. Use a loop to sum 1 through n.\nPrint the total.",
    cases: 4,
  },
  {
    id: "python-loops-multiples3-v1",
    concept: "loops",
    title: "Count multiples of 3",
    question:
      "Read a nonnegative integer n. Use a loop to count multiples of 3 from 1 through n.\nPrint the count.",
    cases: 4,
  },
  {
    id: "python-conditions-vote-v1",
    concept: "conditions",
    title: "Voting age",
    question:
      "Read an age from 0 through 120. Use if/else: at least 18 means eligible, otherwise underage.\nPrint only that word.",
    cases: 4,
  },
  {
    id: "python-conditions-pass-v1",
    concept: "conditions",
    title: "Pass or retry",
    question:
      "Read a score from 0 through 100. Use if/else: at least 50 means pass, otherwise retry.\nPrint only that word.",
    cases: 4,
  },
  {
    id: "python-functions-square-v1",
    concept: "functions",
    title: "Square a number",
    question:
      "Define square(n) returning n * n. Read one integer and call square.\nPrint its result.",
    cases: 4,
  },
  {
    id: "python-functions-negate-v1",
    concept: "functions",
    title: "Negate a number",
    question:
      "Define negate(n) returning -n. Read one integer and call negate.\nPrint its result.",
    cases: 4,
  },
  {
    id: "python-strings-uppercase-v1",
    concept: "strings",
    title: "Count uppercase letters",
    question:
      "Read a complete line, possibly empty. Use a loop to count ASCII uppercase letters A through Z.\nPrint the count.",
    cases: 4,
  },
  {
    id: "python-strings-consonants-v1",
    concept: "strings",
    title: "Count consonants",
    question:
      "Read a lowercase word, possibly empty. Use a loop to count letters other than a, e, i, o, u.\nPrint the count.",
    cases: 4,
  },
  {
    id: "python-arithmetic-add-v1",
    concept: "arithmetic",
    title: "Add two numbers",
    question:
      "Read two integers, one on each line. Store them in variables and add them.\nPrint only their sum.",
    cases: 4,
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

/** Least-recent authored variant in this session; no immediate repeats. */
export function nextPracticeTaskId(
  concept: string,
  history: readonly string[] = [],
): PracticeTaskId | null {
  const tasks = PRACTICE_TASKS.filter((t) => t.concept === concept);
  if (!tasks.length) return null;
  const current = history.at(-1);
  const candidates = tasks.filter((t) => t.id !== current);
  return (candidates.length ? candidates : tasks)
    .slice()
    .sort((a, b) => history.lastIndexOf(a.id) - history.lastIndexOf(b.id))[0]!
    .id;
}

/** Current task's real failed attempts only. Completed/passed tasks never prompt. */
export function beginnerPracticeOffer(
  session:
    | {
        surprise_test?: { enabled: true };
        challenge_id?: string;
        status?: string;
        attempt_history?: Array<{
          attempt: number;
          passed: number;
          total: number;
        }>;
      }
    | null
    | undefined,
) {
  if (
    !session ||
    session.surprise_test?.enabled ||
    !PRACTICE_TASKS.some((t) => t.id === session.challenge_id) ||
    session.challenge_id === "python-arithmetic-add-v1" ||
    ["completed", "expired"].includes(session.status ?? "")
  )
    return false;
  const seen = new Set<number>();
  let failures = 0;
  for (const a of [...(session.attempt_history ?? [])].sort(
    (a, b) => b.attempt - a.attempt,
  )) {
    if (
      !Number.isInteger(a.attempt) ||
      a.attempt < 1 ||
      seen.has(a.attempt) ||
      !Number.isInteger(a.total) ||
      a.total < 1 ||
      !Number.isInteger(a.passed) ||
      a.passed < 0 ||
      a.passed > a.total
    )
      continue;
    seen.add(a.attempt);
    if (a.passed === a.total) break;
    failures++;
  }
  return failures >= 3;
}

/** Repeat the learner's own earlier loop/conditions task, never invent a topic. */
export function harderPracticeRestart(
  session:
    | {
        challenge_id?: string;
        practice_history?: Array<{ challenge_id: string; title: string }>;
      }
    | null
    | undefined,
) {
  if (session?.challenge_id !== "python-arithmetic-add-v1") return null;
  const previous = [...(session.practice_history ?? [])]
    .reverse()
    .find(
      (h) =>
        /^python-(loops|conditions)-/.test(h.challenge_id) &&
        PRACTICE_TASKS.some((t) => t.id === h.challenge_id),
    );
  return previous
    ? (PRACTICE_TASKS.find((t) => t.id === previous.challenge_id) ?? null)
    : null;
}
