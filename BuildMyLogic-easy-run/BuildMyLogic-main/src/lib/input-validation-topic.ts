import type { StudyTopic } from "./topic-library";
const tests = [
  { name: "Positive integer", stdin: "42\n", expected: "42" },
  { name: "Negative integer", stdin: "-7\n", expected: "-7", hidden: true },
  { name: "Explicit plus", stdin: "+9\n", expected: "9", hidden: true },
  {
    name: "Decimal rejected",
    stdin: "3.5\n",
    expected: "INVALID",
    hidden: true,
  },
  {
    name: "Letters rejected",
    stdin: "12abc\n",
    expected: "INVALID",
    hidden: true,
  },
  {
    name: "Sign alone rejected",
    stdin: "+\n",
    expected: "INVALID",
    hidden: true,
  },
];
const python = `import re
text = input()
if re.fullmatch(r"[+-]?[0-9]+", text):
    print(int(text))
else:
    print("INVALID")`;
const c = `#include <stdio.h>
#include <stdlib.h>
#include <string.h>
int main(void) {
 char text[128];
 if (!fgets(text, sizeof text, stdin)) return 1;
 text[strcspn(text, "\\r\\n")] = 0;
 int i = (text[0] == '+' || text[0] == '-') ? 1 : 0;
 int ok = text[i] != 0;
 for (; text[i]; i++) if (text[i] < '0' || text[i] > '9') ok = 0;
 if (ok) printf("%ld\\n", strtol(text, NULL, 10));
 else puts("INVALID");
 return 0;
}`;
export const INPUT_VALIDATION_TOPIC: StudyTopic = {
  id: "input-validation",
  title: "Input Validation & Edge Cases",
  emoji: "🧪",
  summary:
    "Define accepted input, reject invalid types or text, and test boundary cases before converting.",
  keywords: ["input validation", "edge cases", "decimal validation"],
  notes: {
    python: {
      points: [
        "State the contract before changing behavior. int() accepts more inputs than a strict decimal parser may permit.",
        "Check types and format separately. In Python bool is a subclass of int, so a type contract must handle it deliberately.",
        "A passing finite suite supports only the cases checked. Use fresh values for reassessment.",
      ],
      codeTitle: "Strict decimal text, not every numeric input",
      code: python,
    },
    c: {
      points: [
        "Validate the entire string, not just a prefix converted by strtol.",
        "Handle an optional sign and require at least one digit.",
        "This exercise uses small values. Production conversion must also handle range and buffer overflow.",
      ],
      codeTitle: "Check every character before conversion",
      code: c,
    },
  },
  docs: {
    python: [
      {
        label: "Official Python input documentation",
        url: "https://docs.python.org/3/library/functions.html#input",
      },
    ],
    c: [
      {
        label: "C input reference",
        url: "https://en.cppreference.com/w/c/io/fscanf",
      },
    ],
  },
  videos: {
    python: [
      {
        id: "DB9Cq6TSTuQ",
        title: "Python user input (background, not a validation walkthrough)",
        channel: "Bro Code",
        minutes: 7,
      },
    ],
    c: [
      {
        id: "Ws-mVAJDFAw",
        title: "C user input (background, not a validation walkthrough)",
        channel: "Bro Code",
        minutes: 7,
      },
    ],
  },
  exercise: {
    python: {
      title: "Validate decimal text",
      task: "Read one line. Accept an optional + or - followed by ASCII digits, with no spaces. Print its integer value, or INVALID for any other text. Inputs are small; range overflow is outside this exercise.",
      instructions: [
        "Define your accepted format before conversion.",
        "Try positive, negative, sign-only, decimal and letter-containing text.",
        "Do not print prompts or extra labels.",
      ],
      starterCode:
        "text = input()\n# Validate the complete text before int(text)",
      expectedOutput: "42",
      tests,
      solution: python,
      hint: "Check the entire input, not just the first character. A sign must be followed by digits.",
      explain:
        "A full-string format check separates accepted decimal text from invalid values. Finite tests do not establish every possible production edge case.",
    },
    c: {
      title: "Validate decimal text",
      task: "Read one line. Accept an optional + or - followed by ASCII digits, with no spaces. Print its integer value, or INVALID. Inputs are small and shorter than100 characters; range/buffer overflow is outside this exercise.",
      instructions: [
        "Use fgets and remove the newline.",
        "Require a digit after an optional sign.",
        "Check every remaining character before conversion.",
      ],
      starterCode:
        "#include <stdio.h>\nint main(void) {\n  char text[128];\n  fgets(text, sizeof text, stdin);\n  /* Validate all characters before conversion. */\n  return 0;\n}",
      expectedOutput: "42",
      tests,
      solution: c,
      hint: "Remove the newline; then walk the full string, allowing a sign only at the start.",
      explain:
        "Checking every character avoids treating an invalid numeric prefix as a fully valid input.",
    },
  },
};
