/** Explicit standalone practice, never a project-specific assessment or mastery claim. */
export const FIBONACCI_PRACTICE_ID = "python-loops-fibonacci-v1";
export function practiceTaskBody(value: unknown) {
  if (value !== FIBONACCI_PRACTICE_ID) return null;
  return {
    challenge_id: FIBONACCI_PRACTICE_ID,
    title: "Loop practice",
    language: "Python",
    concept: "loops",
    instructions:
      "In main.py, use a loop to print the first 10 Fibonacci numbers, starting 0, 1.\nSeparate the numbers with spaces.",
    expected_skills: ["loops"],
    expected_duration_ms: 300000,
    test_command: "buildmylogic:" + FIBONACCI_PRACTICE_ID,
    checkpoints: [
      {
        title: "Print 10 Fibonacci numbers using a loop",
        detail:
          "Standalone practice. One finite output check, not proof of general skill.",
        evaluator: {
          id: FIBONACCI_PRACTICE_ID,
          command: "buildmylogic:" + FIBONACCI_PRACTICE_ID,
          expectedOutputIncludes: [
            "BML_PRACTICE_PASS:" + FIBONACCI_PRACTICE_ID,
          ],
        },
      },
    ],
  };
}
