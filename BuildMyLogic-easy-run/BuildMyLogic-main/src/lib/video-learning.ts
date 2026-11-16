export type VideoQuestion = {
  prompt: string;
  options: string[];
  answer: number;
  explanation: string;
};
/** Authored topic checks, not timestamp-aligned claims about a video's unseen transcript. */
const banks: Record<string, VideoQuestion[]> = {
  "first-program": [
    {
      prompt: "What does printing Hello World demonstrate?",
      options: [
        "Text output",
        "Reading user input",
        "A loop",
        "A network request",
      ],
      answer: 0,
      explanation:
        "Printing sends text to output. It does not by itself read input or repeat code.",
    },
  ],
  variables: [
    {
      prompt: "After x = 3, then x = x + 2, what value is stored in x?",
      options: ["2", "3", "5", "32"],
      answer: 2,
      explanation:
        "The right side uses the previous value 3. The assignment stores 5.",
    },
  ],
  input: [
    {
      prompt: "Why validate a value read from a user?",
      options: [
        "All input is trusted",
        "Input can be missing or invalid",
        "Validation makes every program faster",
        "Input is always a number",
      ],
      answer: 1,
      explanation:
        "A program must handle input that does not meet its requirements.",
    },
  ],
  math: [
    {
      prompt: "What is the remainder when 17 is divided by 5?",
      options: ["0", "2", "3", "5"],
      answer: 1,
      explanation: "17 = 3 × 5 + 2, so the remainder is 2.",
    },
  ],
  conditions: [
    {
      prompt: "If x is 4, is the condition x > 5 true?",
      options: ["Yes", "No", "Only in a loop", "It changes x to 5"],
      answer: 1,
      explanation:
        "4 is not greater than 5. Testing this condition does not assign a value.",
    },
  ],
  loops: [
    {
      prompt:
        "A loop starts at i = 0, repeats while i < 3, and increments i by 1 after each iteration. How many iterations run?",
      options: ["2", "3", "4", "Infinite"],
      answer: 1,
      explanation: "The body runs for i = 0, 1, 2. The condition fails at 3.",
    },
  ],
  functions: [
    {
      prompt:
        "A function returns its input plus 2. What does calling it with 5 return?",
      options: ["2", "5", "7", "Nothing"],
      answer: 2,
      explanation: "The input is 5, so returning input + 2 produces 7.",
    },
  ],
  recursion: [
    {
      prompt: "Why does a recursive function need a reachable base case?",
      options: [
        "To repeat forever",
        "To stop making recursive calls",
        "To avoid all parameters",
        "To remove every loop",
      ],
      answer: 1,
      explanation:
        "A base case stops recursion. Calls must make progress toward it.",
    },
  ],
  "arrays-lists": [
    {
      prompt:
        "In a zero-indexed sequence [10, 20, 30], which value is at index 1?",
      options: ["10", "20", "30", "No value"],
      answer: 1,
      explanation: "Index 0 is 10, index 1 is 20, and index 2 is 30.",
    },
  ],
  strings: [
    {
      prompt: 'How many characters are in the text "code"?',
      options: ["3", "4", "5", "0"],
      answer: 1,
      explanation:
        "c, o, d and e are four characters. A C terminator is not part of the text length.",
    },
  ],
};
export function videoQuestion(topicId: string, section: number): VideoQuestion {
  const bank = banks[topicId] ?? Object.values(banks).flat();
  const base = bank[Math.max(0, Math.floor(section)) % bank.length]!;
  // Rotate positions without changing the authored answer. Repeated topic checks are labeled as such.
  const shift = Math.max(0, Math.floor(section)) % base.options.length;
  return {
    ...base,
    options: base.options.slice(shift).concat(base.options.slice(0, shift)),
    answer: (base.answer - shift + base.options.length) % base.options.length,
  };
}
export type SavedVideoProgress = {
  ownerId: string;
  completed: number[];
  results: Array<{
    section: number;
    correct: boolean;
    at: number;
    mode: "camera" | "self_reported";
  }>;
  updatedAt: number;
};
export function completedCheckpoint(
  saved: Pick<SavedVideoProgress, "completed"> | undefined,
): number {
  let end = 0;
  for (const value of [...(saved?.completed ?? [])]
    .filter(Number.isFinite)
    .sort((a, b) => a - b)) {
    if (value === end + 1) end = value;
  }
  return end;
}
export function checkpointEnd(section: number, duration: number): number {
  return Math.min((section + 1) * 120, duration);
}
