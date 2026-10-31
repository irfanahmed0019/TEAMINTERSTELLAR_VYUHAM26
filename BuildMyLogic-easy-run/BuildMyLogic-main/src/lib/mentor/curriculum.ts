/**
 * Curated curriculum for the one complete AI Mentor journey:
 * C Programming -> Arithmetic Operations -> Mini Calculator.
 * Lesson content, tests and misconception rules are authored data. Nothing in
 * here is a learner result; results come from real execution of student code.
 */
export type Level = "beginner" | "intermediate" | "advanced";

export type TestCase = { name: string; stdin: string; expected: string; hidden?: boolean };

export type Misconception = {
  id: string;
  concept: string;
  label: string;
  explain: string;
};

export type DetectCtx = {
  code: string;
  compileError: boolean;
  tests: { test: TestCase; stdout: string; stderr: string; statusId: number; passed: boolean }[];
};

export type Exercise = {
  id: string;
  title: string;
  prompt: string;
  starter: string;
  tests: TestCase[];
  hints: string[];
  skill: string;
  /** Returns misconception ids supported by evidence in the submission. */
  detect: (ctx: DetectCtx) => { id: string; evidence: string }[];
};

export type Lesson = {
  id: string;
  order: number;
  title: string;
  objective: string;
  skill: string;
  prerequisites: string[];
  concepts: string[];
  explanation: string[];
  simpler: string[];
  example: { code: string; output: string; stdin?: string };
  keyPoints: string[];
  resources: { label: string; url: string }[];
  practice: Exercise;
};

export const SKILLS: Record<string, string> = {
  output: "Program structure and output",
  input: "Input and variables",
  addition: "Arithmetic operators",
  subtraction_multiplication: "Subtraction and multiplication",
  division_modulus: "Division and modulus",
  conditionals: "Conditional statements",
  calculator: "Combining operations",
  project: "Building a complete program",
};

export const MISCONCEPTIONS: Record<string, Misconception> = {
  missing_stdio: {
    id: "missing_stdio",
    concept: "output",
    label: "Missing #include <stdio.h>",
    explain:
      "printf and scanf are declared in stdio.h. Without the #include line the compiler does not know them, so the program may not build or may behave unpredictably.",
  },
  scanf_missing_address: {
    id: "scanf_missing_address",
    concept: "input",
    label: "scanf without &",
    explain:
      "scanf must be told WHERE to store the value, so it needs the address of the variable: scanf(\"%d\", &n). Passing n instead of &n makes scanf write to a random place in memory.",
  },
  wrong_format_specifier: {
    id: "wrong_format_specifier",
    concept: "input",
    label: "Format specifier does not match the type",
    explain:
      "%d is for int, %f for float and %lf for double with scanf. A mismatch between the specifier and the variable type gives wrong numbers.",
  },
  integer_division: {
    id: "integer_division",
    concept: "division_modulus",
    label: "Integer division loses the decimal part",
    explain:
      "When both operands are int, C divides as integers and throws away the fraction: 7 / 2 is 3, not 3.5. Convert one side first, for example (double)a / b, and print with %.2f.",
  },
  division_by_zero: {
    id: "division_by_zero",
    concept: "division_modulus",
    label: "Division by zero is not guarded",
    explain:
      "Dividing an int by 0 crashes the program. Check if (b == 0) first and print a message instead of dividing.",
  },
  modulus_confusion: {
    id: "modulus_confusion",
    concept: "division_modulus",
    label: "Modulus (%) confused with division (/)",
    explain: "/ gives the quotient and % gives the remainder. 7 / 2 is 3 and 7 % 2 is 1.",
  },
  assignment_in_condition: {
    id: "assignment_in_condition",
    concept: "conditionals",
    label: "= used where == is needed",
    explain:
      "A single = assigns a value. To compare, use ==. if (a = b) changes a and is almost never what you want.",
  },
  char_whitespace: {
    id: "char_whitespace",
    concept: "calculator",
    label: "scanf(\"%c\") reads the leftover newline",
    explain:
      "scanf(\"%c\") takes the very next character, even a space or newline left by the previous number. Write scanf(\" %c\", &op) with a space before %c to skip whitespace.",
  },
};

const has = (code: string, re: RegExp) => re.test(code);
const stripComments = (c: string) => c.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

function baseDetect(ctx: DetectCtx): { id: string; evidence: string }[] {
  const code = stripComments(ctx.code);
  const out: { id: string; evidence: string }[] = [];
  if (has(code, /\b(printf|scanf)\s*\(/) && !has(code, /#\s*include\s*<\s*stdio\.h\s*>/))
    out.push({ id: "missing_stdio", evidence: "The code calls printf/scanf but has no #include <stdio.h>." });
  const bad = code.match(/scanf\s*\(\s*"[^"]*%[dfc][^"]*"\s*,\s*([A-Za-z_]\w*)\s*[,)]/);
  if (bad) out.push({ id: "scanf_missing_address", evidence: `scanf is given "${bad[1]}" instead of "&${bad[1]}".` });
  if (has(code, /\bif\s*\([^()=!<>]*[^=!<>]=[^=][^()]*\)/))
    out.push({ id: "assignment_in_condition", evidence: "An if condition uses = (assignment) instead of == (comparison)." });
  return out;
}

const failedWith = (ctx: DetectCtx, pred: (t: DetectCtx["tests"][number]) => boolean) =>
  ctx.tests.filter((t) => !t.passed && pred(t));

function divisionDetect(ctx: DetectCtx) {
  const out: { id: string; evidence: string }[] = [];
  const zero = failedWith(ctx, (t) => /^\s*-?\d+\s+0\s*$/.test(t.test.stdin) || /0\s*$/.test(t.test.stdin.trim().split(/\s+/)[1] ?? ""));
  if (zero.some((t) => t.statusId >= 7 || /Floating point|SIGFPE/i.test(t.stderr)))
    out.push({ id: "division_by_zero", evidence: `The program crashed on input "${zero[0]?.test.stdin.trim()}" (division by zero).` });
  const intDiv = failedWith(ctx, (t) => {
    const exp = t.test.expected.match(/Quotient:\s*(-?\d+\.\d+)/);
    const got = t.stdout.match(/Quotient:\s*(-?\d+(?:\.\d+)?)/);
    if (!exp || !got) return false;
    const e = parseFloat(exp[1]!);
    return Number.isInteger(parseFloat(got[1]!)) && !Number.isInteger(e) && Math.trunc(e) === parseFloat(got[1]!);
  });
  if (intDiv.length)
    out.push({
      id: "integer_division",
      evidence: `For input "${intDiv[0]!.test.stdin.trim()}" the quotient came out as a whole number; the decimal part was lost.`,
    });
  const mod = failedWith(ctx, (t) => {
    const exp = t.test.expected.match(/Remainder:\s*(-?\d+)/);
    const got = t.stdout.match(/Remainder:\s*(-?\d+)/);
    const q = t.stdout.match(/Quotient:\s*(-?\d+)/);
    return !!exp && !!got && !!q && exp[1] !== got[1] && got[1] === q[1];
  });
  if (mod.length) out.push({ id: "modulus_confusion", evidence: "The remainder line shows the quotient value, so / and % look swapped." });
  return out;
}

function withBase(extra: (ctx: DetectCtx) => { id: string; evidence: string }[]) {
  return (ctx: DetectCtx) => {
    const seen = new Set<string>();
    return [...baseDetect(ctx), ...extra(ctx)].filter((m) => !seen.has(m.id) && seen.add(m.id));
  };
}

const T = (name: string, stdin: string, expected: string, hidden = false): TestCase => ({ name, stdin, expected, hidden });

export const LESSONS: Lesson[] = [
  {
    id: "l1-print",
    order: 1,
    title: "Print a statement",
    objective: "Write a complete C program that prints a line of text.",
    skill: "output",
    prerequisites: [],
    concepts: ["Statements", "printf()", "stdio.h", "main()", "return 0"],
    explanation: [
      "A C program is a list of statements. Each statement ends with a semicolon. The computer runs them from top to bottom.",
      "printf() prints text to the screen. It lives in a library header called stdio.h, so every program that prints starts with #include <stdio.h>.",
      "Execution always starts in main(). The code between the curly braces is what runs. return 0; tells the system the program finished without errors.",
    ],
    simpler: [
      "Think of the program as a recipe. main() is the recipe title, the lines inside are the steps, and printf is the step that says something out loud.",
      "#include <stdio.h> is like borrowing the cookbook that explains printf. Without it, the kitchen does not know the word.",
    ],
    example: { code: '#include <stdio.h>\n\nint main(void) {\n    printf("Hello, C!\\n");\n    return 0;\n}\n', output: "Hello, C!" },
    keyPoints: ["End every statement with ;", "\\n moves to a new line", "main() is where the program starts"],
    resources: [{ label: "printf reference", url: "https://en.cppreference.com/w/c/io/fprintf" }],
    practice: {
      id: "ex-print",
      title: "Print a welcome message",
      prompt: "Write a C program that prints exactly: Welcome to BuildMyLogic!",
      starter: "#include <stdio.h>\n\nint main(void) {\n    // your code here\n    return 0;\n}\n",
      tests: [T("Prints the welcome line", "", "Welcome to BuildMyLogic!")],
      hints: [
        "Use printf with the text inside double quotes.",
        'The call looks like printf("..."); and the text must match exactly, including capital letters and the exclamation mark.',
        "Put your printf line between the braces of main(), before return 0;",
      ],
      skill: "output",
      detect: withBase(() => []),
    },
  },
  {
    id: "l2-io",
    order: 2,
    title: "Input and output",
    objective: "Read a value with scanf() into a variable and print it.",
    skill: "input",
    prerequisites: ["l1-print"],
    concepts: ["Variables", "Data types", "scanf()", "Format specifiers"],
    explanation: [
      "A variable is a named box that holds a value. int holds whole numbers, float and double hold decimals, char holds one character.",
      "scanf() reads input. The format string says what to expect (%d for int) and the variable gets an & in front so scanf knows where to store the value.",
      "printf uses the same format specifiers. printf(\"%d\", n) prints the value of n.",
    ],
    simpler: [
      "int n; creates an empty box called n. scanf(\"%d\", &n); asks the user for a number and drops it into that box. The & means 'the address of the box'.",
    ],
    example: { code: '#include <stdio.h>\n\nint main(void) {\n    int n;\n    scanf("%d", &n);\n    printf("Double: %d\\n", n * 2);\n    return 0;\n}\n', output: "Double: 14", stdin: "7" },
    keyPoints: ["%d is int, %f is float, %lf is double (in scanf)", "scanf needs &variable", "Declare a variable before using it"],
    resources: [{ label: "scanf reference", url: "https://en.cppreference.com/w/c/io/fscanf" }],
    practice: {
      id: "ex-io",
      title: "Echo a number",
      prompt: "Read one integer and print: You entered: <number>",
      starter: "#include <stdio.h>\n\nint main(void) {\n    int n;\n    // read n, then print it\n    return 0;\n}\n",
      tests: [T("Positive", "7", "You entered: 7"), T("Negative", "-3", "You entered: -3"), T("Larger", "42", "You entered: 42", true)],
      hints: ['Read with scanf("%d", &n);', 'Print with printf("You entered: %d\\n", n);', "Check that the text before the number matches exactly, including the colon and space."],
      skill: "input",
      detect: withBase((ctx) =>
        has(stripComments(ctx.code), /printf\s*\(\s*"[^"]*%f/) && !has(stripComments(ctx.code), /\b(float|double)\b/)
          ? [{ id: "wrong_format_specifier", evidence: "printf uses %f but the variable is not a float or double." }]
          : [],
      ),
    },
  },
  {
    id: "l3-sum",
    order: 3,
    title: "Sum of two numbers",
    objective: "Combine input, variables and the + operator.",
    skill: "addition",
    prerequisites: ["l2-io"],
    concepts: ["Integer variables", "Arithmetic operators", "User input", "Output formatting"],
    explanation: [
      "Arithmetic operators are + - * / and %. You can store a result in a new variable or compute it directly inside printf.",
      "scanf can read several values at once: scanf(\"%d %d\", &a, &b); reads two integers separated by whitespace.",
    ],
    simpler: ["Read two boxes a and b, make a third box sum = a + b, then print sum."],
    example: { code: '#include <stdio.h>\n\nint main(void) {\n    int a, b;\n    scanf("%d %d", &a, &b);\n    int sum = a + b;\n    printf("%d\\n", sum);\n    return 0;\n}\n', output: "7", stdin: "3 4" },
    keyPoints: ["One scanf can read two values", "Use a variable to hold the result", "Negative numbers work too"],
    resources: [{ label: "C operators", url: "https://en.cppreference.com/w/c/language/operator_arithmetic" }],
    practice: {
      id: "ex-sum",
      title: "Add two numbers",
      prompt: "Read two integers and print their sum on one line (only the number).",
      starter: '#include <stdio.h>\n\nint main(void) {\n    int a, b;\n    // read a and b, print a + b\n    return 0;\n}\n',
      tests: [T("Small numbers", "3 4", "7"), T("Negative", "-5 2", "-3"), T("Zeros", "0 0", "0"), T("Larger", "100 250", "350", true)],
      hints: ['scanf("%d %d", &a, &b);', 'printf("%d\\n", a + b);', "Print only the number, no extra words."],
      skill: "addition",
      detect: withBase(() => []),
    },
  },
  {
    id: "l4-submul",
    order: 4,
    title: "Subtraction and multiplication",
    objective: "Use - and * and print more than one result.",
    skill: "subtraction_multiplication",
    prerequisites: ["l3-sum"],
    concepts: ["- operator", "* operator", "Multiple printf lines", "Operator precedence"],
    explanation: [
      "- subtracts and * multiplies. Multiplication happens before addition and subtraction, like in maths. Use brackets to be explicit.",
      "You can print several lines with several printf calls. Each \\n ends a line.",
    ],
    simpler: ["Compute a - b in one printf and a * b in another. Print a label first so the output is readable."],
    example: { code: '#include <stdio.h>\n\nint main(void) {\n    int a = 6, b = 4;\n    printf("Difference: %d\\n", a - b);\n    printf("Product: %d\\n", a * b);\n    return 0;\n}\n', output: "Difference: 2\nProduct: 24" },
    keyPoints: ["a - b is not the same as b - a", "* before + and -", "Labels must match the expected text"],
    resources: [{ label: "Operator precedence", url: "https://en.cppreference.com/w/c/language/operator_precedence" }],
    practice: {
      id: "ex-submul",
      title: "Difference and product",
      prompt: "Read two integers a and b. Print two lines:\nDifference: <a - b>\nProduct: <a * b>",
      starter: '#include <stdio.h>\n\nint main(void) {\n    int a, b;\n    return 0;\n}\n',
      tests: [T("Positive", "9 4", "Difference: 5\nProduct: 36"), T("Negative result", "2 8", "Difference: -6\nProduct: 16"), T("With zero", "0 5", "Difference: -5\nProduct: 0"), T("Both negative", "-3 -4", "Difference: 1\nProduct: 12", true)],
      hints: ["Two printf calls, one per line.", "Difference is a - b, in that order.", 'printf("Product: %d\\n", a * b);'],
      skill: "subtraction_multiplication",
      detect: withBase(() => []),
    },
  },
  {
    id: "l5-divmod",
    order: 5,
    title: "Division and modulus",
    objective: "Divide correctly, get remainders and protect against dividing by zero.",
    skill: "division_modulus",
    prerequisites: ["l4-submul"],
    concepts: ["Division", "Modulus", "Integer vs floating-point division", "Division-by-zero protection"],
    explanation: [
      "/ divides and % gives the remainder. With two ints, / drops the fraction: 7 / 2 is 3 and 7 % 2 is 1.",
      "To keep the decimal part, make at least one side a double: (double)a / b gives 3.5. Print it with %.2f for two decimals.",
      "Dividing by zero crashes the program, so check if (b == 0) first and print a message.",
    ],
    simpler: [
      "Share 7 sweets between 2 children. Each gets 3 (that is /), and 1 is left over (that is %). If you want 3.5, tell C to use decimals with (double).",
    ],
    example: {
      code: '#include <stdio.h>\n\nint main(void) {\n    int a = 7, b = 2;\n    printf("%.2f\\n", (double)a / b);\n    printf("%d\\n", a % b);\n    return 0;\n}\n',
      output: "3.50\n1",
    },
    keyPoints: ["int / int is an int", "(double)a / b keeps decimals", "Check b == 0 before / or %"],
    resources: [{ label: "Integer division", url: "https://en.cppreference.com/w/c/language/operator_arithmetic" }],
    practice: {
      id: "ex-divmod",
      title: "Quotient and remainder",
      prompt: "Read two integers a and b.\nIf b is 0, print: Cannot divide by zero\nOtherwise print two lines:\nQuotient: <a / b with 2 decimals>\nRemainder: <a % b>",
      starter: '#include <stdio.h>\n\nint main(void) {\n    int a, b;\n    scanf("%d %d", &a, &b);\n    // handle b == 0, then print quotient and remainder\n    return 0;\n}\n',
      tests: [
        T("Decimal quotient", "7 2", "Quotient: 3.50\nRemainder: 1"),
        T("Exact division", "10 5", "Quotient: 2.00\nRemainder: 0"),
        T("Zero divisor", "9 0", "Cannot divide by zero"),
        T("Fraction below one", "1 4", "Quotient: 0.25\nRemainder: 1", true),
      ],
      hints: [
        "Look at the failing test: does your quotient keep its decimals?",
        "Use (double)a / b and the format %.2f.",
        "Write if (b == 0) { ... } before the division so the program never divides by zero.",
      ],
      skill: "division_modulus",
      detect: withBase(divisionDetect),
    },
  },
  {
    id: "l6-ifelse",
    order: 6,
    title: "If-else statements",
    objective: "Choose between actions with if, else if and else.",
    skill: "conditionals",
    prerequisites: ["l5-divmod"],
    concepts: ["if / else", "Comparison operators", "== versus ="],
    explanation: [
      "if (condition) { ... } runs the block only when the condition is true. else covers the other case and else if adds more branches.",
      "Comparison operators are == != < > <= >=. Use == to compare. A single = assigns and is a common bug.",
    ],
    simpler: ["Ask a yes/no question about the number: is it above zero? If yes do one thing. If not, ask the next question."],
    example: { code: '#include <stdio.h>\n\nint main(void) {\n    int n;\n    scanf("%d", &n);\n    if (n % 2 == 0) printf("Even\\n");\n    else printf("Odd\\n");\n    return 0;\n}\n', output: "Even", stdin: "10" },
    keyPoints: ["== compares, = assigns", "Only one branch of an if/else-if chain runs", "Order your conditions carefully"],
    resources: [{ label: "if statement", url: "https://en.cppreference.com/w/c/language/if" }],
    practice: {
      id: "ex-if",
      title: "Sign of a number",
      prompt: "Read an integer. Print Positive if it is above 0, Negative if below 0, or Zero if it is 0.",
      starter: '#include <stdio.h>\n\nint main(void) {\n    int n;\n    scanf("%d", &n);\n    return 0;\n}\n',
      tests: [T("Positive", "8", "Positive"), T("Negative", "-2", "Negative"), T("Zero", "0", "Zero"), T("Large negative", "-100", "Negative", true)],
      hints: ["Start with if (n > 0).", "Use else if (n < 0) and finish with else.", "Compare with ==, never a single =."],
      skill: "conditionals",
      detect: withBase(() => []),
    },
  },
  {
    id: "l7-calc",
    order: 7,
    title: "Mini calculator",
    objective: "Combine input, operators and conditions into one working calculator.",
    skill: "calculator",
    prerequisites: ["l6-ifelse"],
    concepts: ["Reading a char operator", "switch or if-else chain", "Reusing earlier concepts"],
    explanation: [
      "Read two numbers and an operator character: scanf(\"%d %c %d\", &a, &op, &b). Use a space before %c when mixing numbers and characters.",
      "Choose the action with if/else if or switch (op). Division should keep decimals and refuse to divide by zero.",
    ],
    simpler: ["Read 'a op b'. Look at op: + means add, - subtract, * multiply, / divide. Print the answer with two decimals."],
    example: { code: '#include <stdio.h>\n\nint main(void) {\n    int a, b; char op;\n    scanf("%d %c %d", &a, &op, &b);\n    if (op == \'+\') printf("%.2f\\n", (double)a + b);\n    return 0;\n}\n', output: "5.00", stdin: "2 + 3" },
    keyPoints: ["Characters use single quotes: '+'", "Space before %c skips whitespace", "Print results with %.2f"],
    resources: [{ label: "switch statement", url: "https://en.cppreference.com/w/c/language/switch" }],
    practice: {
      id: "ex-calc",
      title: "One-line calculator",
      prompt: "Read: a op b (for example 8 / 2). Print the result with 2 decimals for + - * /.\nFor / with b = 0 print: Error: division by zero\nFor any other operator print: Error: unknown operator",
      starter: '#include <stdio.h>\n\nint main(void) {\n    int a, b;\n    char op;\n    return 0;\n}\n',
      tests: [
        T("Addition", "2 + 3", "5.00"),
        T("Subtraction", "10 - 4", "6.00"),
        T("Multiplication", "6 * 7", "42.00"),
        T("Division keeps decimals", "7 / 2", "3.50"),
        T("Divide by zero", "5 / 0", "Error: division by zero"),
        T("Unknown operator", "5 ^ 2", "Error: unknown operator", true),
      ],
      hints: ['Read with scanf("%d %c %d", &a, &op, &b);', "Use (double) so 7 / 2 gives 3.50.", "Handle op == '/' and b == 0 before dividing."],
      skill: "calculator",
      detect: withBase((ctx) => {
        const out = divisionDetect({ ...ctx, tests: ctx.tests.map((t) => ({ ...t, stdout: t.stdout.replace(/^(-?\d+(?:\.\d+)?)$/m, "Quotient: $1") })) }).filter((m) => m.id === "integer_division");
        const code = stripComments(ctx.code);
        if (has(code, /scanf\s*\(\s*"[^"]*%d%c[^"]*"/) || has(code, /scanf\s*\(\s*"[^"]*%d\s*%c/)) {
          if (ctx.tests.some((t) => !t.passed && /unknown operator|\n/.test(t.stdout)))
            out.push({ id: "char_whitespace", evidence: 'scanf format has %c without a leading space, so it can read a whitespace character as the operator.' });
        }
        return out;
      }),
    },
  },
  {
    id: "l8-final",
    order: 8,
    title: "Final project: arithmetic calculator",
    objective: "Build a working calculator that handles several calculations in one run.",
    skill: "project",
    prerequisites: ["l7-calc"],
    concepts: ["Loops", "Combining every earlier concept", "Testing your own program"],
    explanation: [
      "Read n, the number of calculations. A for loop repeats the calculator n times. Each line has the form: a op b.",
      "This is your lesson 7 program inside a loop. Test it with several inputs, including division by zero, before you submit.",
    ],
    simpler: ["Do lesson 7 again and again: for (int i = 0; i < n; i++) { read a op b; print the answer }."],
    example: { code: '#include <stdio.h>\n\nint main(void) {\n    int n;\n    scanf("%d", &n);\n    for (int i = 0; i < n; i++) {\n        printf("round %d\\n", i + 1);\n    }\n    return 0;\n}\n', output: "round 1\nround 2", stdin: "2" },
    keyPoints: ["for (init; condition; step) repeats code", "Reuse working code instead of rewriting", "Always test edge cases"],
    resources: [{ label: "for loop", url: "https://en.cppreference.com/w/c/language/for" }],
    practice: {
      id: "ex-final",
      title: "Multi-operation calculator",
      prompt: "First read n. Then read n lines of the form: a op b.\nFor each line print the result with 2 decimals using + - * /.\nFor / with b = 0 print: Error: division by zero\nFor an unknown operator print: Error: unknown operator",
      starter: '#include <stdio.h>\n\nint main(void) {\n    int n;\n    scanf("%d", &n);\n    return 0;\n}\n',
      tests: [
        T("Three calculations", "3\n2 + 3\n9 - 4\n7 / 2", "5.00\n5.00\n3.50"),
        T("Edge cases", "2\n5 / 0\n4 * 4", "Error: division by zero\n16.00"),
        T("Single calculation", "1\n8 / 2", "4.00"),
        T("Unknown operator", "2\n1 ? 1\n3 - 5", "Error: unknown operator\n-2.00", true),
      ],
      hints: ["Wrap your lesson 7 logic in a for loop.", 'Use scanf(" %d %c %d", &a, &op, &b); inside the loop.', "Keep the division-by-zero check inside the loop."],
      skill: "project",
      detect: withBase((ctx) => divisionDetect({ ...ctx, tests: ctx.tests.map((t) => ({ ...t, stdout: t.stdout.replace(/^(-?\d+(?:\.\d+)?)$/m, "Quotient: $1") })) }).filter((m) => m.id === "integer_division")),
    },
  },
];

/** Targeted exercises served when a misconception is detected. */
export const REMEDIALS: Record<string, Exercise> = {
  missing_stdio: {
    id: "rem-missing_stdio",
    title: "Targeted practice: include the right header",
    prompt: "Write a complete program that prints: Hello, C!\nStart it with the correct #include line.",
    starter: "int main(void) {\n    return 0;\n}\n",
    tests: [T("Prints greeting", "", "Hello, C!")],
    hints: ["Which header declares printf?", "Add #include <stdio.h> on the first line."],
    skill: "output",
    detect: withBase(() => []),
  },
  scanf_missing_address: {
    id: "rem-scanf_missing_address",
    title: "Targeted practice: scanf needs the address",
    prompt: "Read your age as an integer and print: Age: <age>",
    starter: "#include <stdio.h>\n\nint main(void) {\n    int age;\n    return 0;\n}\n",
    tests: [T("Age 19", "19", "Age: 19"), T("Age 30", "30", "Age: 30"), T("Age 7", "7", "Age: 7", true)],
    hints: ["scanf stores into a variable, so it needs where that variable lives.", 'Write scanf("%d", &age);'],
    skill: "input",
    detect: withBase(() => []),
  },
  wrong_format_specifier: {
    id: "rem-wrong_format_specifier",
    title: "Targeted practice: match the specifier to the type",
    prompt: "Read one decimal number (double) and print: Value: <number with 2 decimals>",
    starter: "#include <stdio.h>\n\nint main(void) {\n    double x;\n    return 0;\n}\n",
    tests: [T("2.5", "2.5", "Value: 2.50"), T("10", "10", "Value: 10.00"), T("0.125", "0.125", "Value: 0.13", true)],
    hints: ["scanf uses %lf for double.", 'printf("Value: %.2f\\n", x);'],
    skill: "input",
    detect: withBase(() => []),
  },
  integer_division: {
    id: "rem-integer_division",
    title: "Targeted practice: average with decimals",
    prompt: "Read two integers a and b. Print their average with 2 decimals (for example 7 and 2 give 4.50).",
    starter: "#include <stdio.h>\n\nint main(void) {\n    int a, b;\n    return 0;\n}\n",
    tests: [T("Odd sum", "7 2", "4.50"), T("Even sum", "10 4", "7.00"), T("Small numbers", "1 2", "1.50"), T("Negative", "-3 0", "-1.50", true)],
    hints: ["(a + b) / 2 is integer division when a and b are ints.", "Write (a + b) / 2.0 or (double)(a + b) / 2.", 'Print with printf("%.2f\\n", ...);'],
    skill: "division_modulus",
    detect: withBase(() => []),
  },
  division_by_zero: {
    id: "rem-division_by_zero",
    title: "Targeted practice: safe modulus",
    prompt: "Read two integers a and b. If b is 0 print: Undefined\nOtherwise print a % b.",
    starter: "#include <stdio.h>\n\nint main(void) {\n    int a, b;\n    return 0;\n}\n",
    tests: [T("Normal", "9 4", "1"), T("Zero divisor", "5 0", "Undefined"), T("Exact", "8 2", "0"), T("Zero numerator", "0 3", "0", true)],
    hints: ["Check b first.", "if (b == 0) { printf(\"Undefined\\n\"); } else { ... }"],
    skill: "division_modulus",
    detect: withBase(() => []),
  },
  modulus_confusion: {
    id: "rem-modulus_confusion",
    title: "Targeted practice: remainders",
    prompt: "Read two positive integers a and b (b is not 0). Print the remainder of a divided by b.",
    starter: "#include <stdio.h>\n\nint main(void) {\n    int a, b;\n    return 0;\n}\n",
    tests: [T("17 5", "17 5", "2"), T("20 4", "20 4", "0"), T("3 7", "3 7", "3"), T("100 9", "100 9", "1", true)],
    hints: ["% gives the remainder.", 'printf("%d\\n", a % b);'],
    skill: "division_modulus",
    detect: withBase(() => []),
  },
  assignment_in_condition: {
    id: "rem-assignment_in_condition",
    title: "Targeted practice: compare with ==",
    prompt: "Read two integers. Print Equal if they are the same, otherwise print Different.",
    starter: "#include <stdio.h>\n\nint main(void) {\n    int a, b;\n    return 0;\n}\n",
    tests: [T("Same", "4 4", "Equal"), T("Different", "4 5", "Different"), T("Zeros", "0 0", "Equal"), T("Negative", "-1 1", "Different", true)],
    hints: ["Use == inside the if.", "if (a == b) printf(\"Equal\\n\"); else printf(\"Different\\n\");"],
    skill: "conditionals",
    detect: withBase(() => []),
  },
  char_whitespace: {
    id: "rem-char_whitespace",
    title: "Targeted practice: reading a character",
    prompt: "Read an integer then a single letter (for example: 5 x). Print: <letter> repeated <number> times on one line, like xxxxx.",
    starter: "#include <stdio.h>\n\nint main(void) {\n    int n; char c;\n    return 0;\n}\n",
    tests: [T("5 x", "5 x", "xxxxx"), T("3 a", "3 a", "aaa"), T("1 z", "1 z", "z", true)],
    hints: ['Use scanf("%d %c", &n, &c); with a space before %c.', "Loop n times and print c."],
    skill: "calculator",
    detect: withBase(() => []),
  },
};

export function lessonById(id: string): Lesson | undefined {
  return LESSONS.find((l) => l.id === id);
}

export function exerciseById(id: string): { exercise: Exercise; lesson?: Lesson; remedialFor?: string } | undefined {
  for (const l of LESSONS) if (l.practice.id === id) return { exercise: l.practice, lesson: l };
  for (const [mid, r] of Object.entries(REMEDIALS)) if (r.id === id) return { exercise: r, remedialFor: mid };
  return undefined;
}

export const LEVEL_RULES: Record<Level, { label: string; blurb: string; hintsAllowed: number; passScore: number; openOrder: boolean; depth: string; difficulty: string }> = {
  beginner: { label: "Beginner", blurb: "I am new to this. Teach me from the fundamentals.", hintsAllowed: 3, passScore: 100, openOrder: false, depth: "Full explanations with a simpler version on request", difficulty: "Gentle, step by step" },
  intermediate: { label: "Intermediate", blurb: "I understand the basics and want to solve practical problems.", hintsAllowed: 2, passScore: 100, openOrder: false, depth: "Concise explanations, examples first", difficulty: "Moderate, fewer hints" },
  advanced: { label: "Advanced", blurb: "I already have experience. Challenge me with complex implementations.", hintsAllowed: 1, passScore: 100, openOrder: true, depth: "Minimal explanations, any lesson order", difficulty: "Challenging, one hint only" },
};

export const CATEGORIES = [
  "Programming Fundamentals", "Web Development", "Python Programming", "Data Structures and Algorithms",
  "Database Management", "Machine Learning", "Artificial Intelligence", "Cybersecurity", "Custom Learning Goal",
] as const;

export const PROJECTS: { id: string; title: string; category: string; languages: string[]; available: boolean }[] = [
  { id: "arithmetic-c", title: "Arithmetic Operations Calculator", category: "Programming Fundamentals", languages: ["C"], available: true },
  { id: "student-mgmt", title: "Student Management System", category: "Programming Fundamentals", languages: ["C", "C++", "Java"], available: false },
  { id: "todo-app", title: "To-Do Application", category: "Web Development", languages: ["JavaScript", "TypeScript"], available: false },
  { id: "portfolio", title: "Personal Portfolio", category: "Web Development", languages: ["HTML/CSS", "JavaScript"], available: false },
  { id: "weather-app", title: "Weather Application", category: "Web Development", languages: ["JavaScript", "TypeScript"], available: false },
  { id: "library-mgmt", title: "Library Management System", category: "Database Management", languages: ["Python", "Java"], available: false },
  { id: "ecommerce", title: "E-commerce Application", category: "Web Development", languages: ["TypeScript", "JavaScript"], available: false },
];
