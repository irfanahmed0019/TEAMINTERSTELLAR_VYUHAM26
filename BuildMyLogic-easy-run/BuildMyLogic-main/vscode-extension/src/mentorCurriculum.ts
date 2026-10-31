/**
 * Bundled snapshot of the AI Mentor curriculum metadata, generated from
 * src/lib/mentor/curriculum.ts at commit 233731d (regenerate if the web
 * curriculum changes). Used ONLY to render lessons, the current task and test
 * inputs; all grading, hints counting and state live on the server. When the
 * web worker ships GET /api/mentor/lessons the client prefers that live data.
 */
export type MentorTestMeta = { name: string; stdin: string; expected: string; hidden: boolean };
export type MentorExerciseMeta = { id: string; title: string; prompt: string; starter: string; hints: string[]; skill: string; tests: MentorTestMeta[] };
export type MentorLessonMeta = { id: string; order: number; title: string; objective: string; skill: string; prerequisites: string[]; concepts: string[]; explanation: string[]; example: { code: string; output: string; stdin?: string }; keyPoints: string[]; resources: { label: string; url: string }[]; practice: MentorExerciseMeta };

export const MENTOR_SKILLS: Record<string, string> = {
  "output": "Program structure and output",
  "input": "Input and variables",
  "addition": "Arithmetic operators",
  "subtraction_multiplication": "Subtraction and multiplication",
  "division_modulus": "Division and modulus",
  "conditionals": "Conditional statements",
  "calculator": "Combining operations",
  "project": "Building a complete program"
};

export const MENTOR_LESSONS: MentorLessonMeta[] = [
  {
    "id": "l1-print",
    "order": 1,
    "title": "Print a statement",
    "objective": "Write a complete C program that prints a line of text.",
    "skill": "output",
    "prerequisites": [],
    "concepts": [
      "Statements",
      "printf()",
      "stdio.h",
      "main()",
      "return 0"
    ],
    "explanation": [
      "A C program is a list of statements. Each statement ends with a semicolon. The computer runs them from top to bottom.",
      "printf() prints text to the screen. It lives in a library header called stdio.h, so every program that prints starts with #include <stdio.h>.",
      "Execution always starts in main(). The code between the curly braces is what runs. return 0; tells the system the program finished without errors."
    ],
    "example": {
      "code": "#include <stdio.h>\n\nint main(void) {\n    printf(\"Hello, C!\\n\");\n    return 0;\n}\n",
      "output": "Hello, C!"
    },
    "keyPoints": [
      "End every statement with ;",
      "\\n moves to a new line",
      "main() is where the program starts"
    ],
    "resources": [
      {
        "label": "printf reference",
        "url": "https://en.cppreference.com/w/c/io/fprintf"
      }
    ],
    "practice": {
      "id": "ex-print",
      "title": "Print a welcome message",
      "prompt": "Write a C program that prints exactly: Welcome to BuildMyLogic!",
      "starter": "#include <stdio.h>\n\nint main(void) {\n    // your code here\n    return 0;\n}\n",
      "hints": [
        "Use printf with the text inside double quotes.",
        "The call looks like printf(\"...\"); and the text must match exactly, including capital letters and the exclamation mark.",
        "Put your printf line between the braces of main(), before return 0;"
      ],
      "skill": "output",
      "tests": [
        {
          "name": "Prints the welcome line",
          "stdin": "",
          "expected": "Welcome to BuildMyLogic!",
          "hidden": false
        }
      ]
    }
  },
  {
    "id": "l2-io",
    "order": 2,
    "title": "Input and output",
    "objective": "Read a value with scanf() into a variable and print it.",
    "skill": "input",
    "prerequisites": [
      "l1-print"
    ],
    "concepts": [
      "Variables",
      "Data types",
      "scanf()",
      "Format specifiers"
    ],
    "explanation": [
      "A variable is a named box that holds a value. int holds whole numbers, float and double hold decimals, char holds one character.",
      "scanf() reads input. The format string says what to expect (%d for int) and the variable gets an & in front so scanf knows where to store the value.",
      "printf uses the same format specifiers. printf(\"%d\", n) prints the value of n."
    ],
    "example": {
      "code": "#include <stdio.h>\n\nint main(void) {\n    int n;\n    scanf(\"%d\", &n);\n    printf(\"Double: %d\\n\", n * 2);\n    return 0;\n}\n",
      "output": "Double: 14",
      "stdin": "7"
    },
    "keyPoints": [
      "%d is int, %f is float, %lf is double (in scanf)",
      "scanf needs &variable",
      "Declare a variable before using it"
    ],
    "resources": [
      {
        "label": "scanf reference",
        "url": "https://en.cppreference.com/w/c/io/fscanf"
      }
    ],
    "practice": {
      "id": "ex-io",
      "title": "Echo a number",
      "prompt": "Read one integer and print: You entered: <number>",
      "starter": "#include <stdio.h>\n\nint main(void) {\n    int n;\n    // read n, then print it\n    return 0;\n}\n",
      "hints": [
        "Read with scanf(\"%d\", &n);",
        "Print with printf(\"You entered: %d\\n\", n);",
        "Check that the text before the number matches exactly, including the colon and space."
      ],
      "skill": "input",
      "tests": [
        {
          "name": "Positive",
          "stdin": "7",
          "expected": "You entered: 7",
          "hidden": false
        },
        {
          "name": "Negative",
          "stdin": "-3",
          "expected": "You entered: -3",
          "hidden": false
        },
        {
          "name": "Larger",
          "stdin": "42",
          "expected": "You entered: 42",
          "hidden": true
        }
      ]
    }
  },
  {
    "id": "l3-sum",
    "order": 3,
    "title": "Sum of two numbers",
    "objective": "Combine input, variables and the + operator.",
    "skill": "addition",
    "prerequisites": [
      "l2-io"
    ],
    "concepts": [
      "Integer variables",
      "Arithmetic operators",
      "User input",
      "Output formatting"
    ],
    "explanation": [
      "Arithmetic operators are + - * / and %. You can store a result in a new variable or compute it directly inside printf.",
      "scanf can read several values at once: scanf(\"%d %d\", &a, &b); reads two integers separated by whitespace."
    ],
    "example": {
      "code": "#include <stdio.h>\n\nint main(void) {\n    int a, b;\n    scanf(\"%d %d\", &a, &b);\n    int sum = a + b;\n    printf(\"%d\\n\", sum);\n    return 0;\n}\n",
      "output": "7",
      "stdin": "3 4"
    },
    "keyPoints": [
      "One scanf can read two values",
      "Use a variable to hold the result",
      "Negative numbers work too"
    ],
    "resources": [
      {
        "label": "C operators",
        "url": "https://en.cppreference.com/w/c/language/operator_arithmetic"
      }
    ],
    "practice": {
      "id": "ex-sum",
      "title": "Add two numbers",
      "prompt": "Read two integers and print their sum on one line (only the number).",
      "starter": "#include <stdio.h>\n\nint main(void) {\n    int a, b;\n    // read a and b, print a + b\n    return 0;\n}\n",
      "hints": [
        "scanf(\"%d %d\", &a, &b);",
        "printf(\"%d\\n\", a + b);",
        "Print only the number, no extra words."
      ],
      "skill": "addition",
      "tests": [
        {
          "name": "Small numbers",
          "stdin": "3 4",
          "expected": "7",
          "hidden": false
        },
        {
          "name": "Negative",
          "stdin": "-5 2",
          "expected": "-3",
          "hidden": false
        },
        {
          "name": "Zeros",
          "stdin": "0 0",
          "expected": "0",
          "hidden": false
        },
        {
          "name": "Larger",
          "stdin": "100 250",
          "expected": "350",
          "hidden": true
        }
      ]
    }
  },
  {
    "id": "l4-submul",
    "order": 4,
    "title": "Subtraction and multiplication",
    "objective": "Use - and * and print more than one result.",
    "skill": "subtraction_multiplication",
    "prerequisites": [
      "l3-sum"
    ],
    "concepts": [
      "- operator",
      "* operator",
      "Multiple printf lines",
      "Operator precedence"
    ],
    "explanation": [
      "- subtracts and * multiplies. Multiplication happens before addition and subtraction, like in maths. Use brackets to be explicit.",
      "You can print several lines with several printf calls. Each \\n ends a line."
    ],
    "example": {
      "code": "#include <stdio.h>\n\nint main(void) {\n    int a = 6, b = 4;\n    printf(\"Difference: %d\\n\", a - b);\n    printf(\"Product: %d\\n\", a * b);\n    return 0;\n}\n",
      "output": "Difference: 2\nProduct: 24"
    },
    "keyPoints": [
      "a - b is not the same as b - a",
      "* before + and -",
      "Labels must match the expected text"
    ],
    "resources": [
      {
        "label": "Operator precedence",
        "url": "https://en.cppreference.com/w/c/language/operator_precedence"
      }
    ],
    "practice": {
      "id": "ex-submul",
      "title": "Difference and product",
      "prompt": "Read two integers a and b. Print two lines:\nDifference: <a - b>\nProduct: <a * b>",
      "starter": "#include <stdio.h>\n\nint main(void) {\n    int a, b;\n    return 0;\n}\n",
      "hints": [
        "Two printf calls, one per line.",
        "Difference is a - b, in that order.",
        "printf(\"Product: %d\\n\", a * b);"
      ],
      "skill": "subtraction_multiplication",
      "tests": [
        {
          "name": "Positive",
          "stdin": "9 4",
          "expected": "Difference: 5\nProduct: 36",
          "hidden": false
        },
        {
          "name": "Negative result",
          "stdin": "2 8",
          "expected": "Difference: -6\nProduct: 16",
          "hidden": false
        },
        {
          "name": "With zero",
          "stdin": "0 5",
          "expected": "Difference: -5\nProduct: 0",
          "hidden": false
        },
        {
          "name": "Both negative",
          "stdin": "-3 -4",
          "expected": "Difference: 1\nProduct: 12",
          "hidden": true
        }
      ]
    }
  },
  {
    "id": "l5-divmod",
    "order": 5,
    "title": "Division and modulus",
    "objective": "Divide correctly, get remainders and protect against dividing by zero.",
    "skill": "division_modulus",
    "prerequisites": [
      "l4-submul"
    ],
    "concepts": [
      "Division",
      "Modulus",
      "Integer vs floating-point division",
      "Division-by-zero protection"
    ],
    "explanation": [
      "/ divides and % gives the remainder. With two ints, / drops the fraction: 7 / 2 is 3 and 7 % 2 is 1.",
      "To keep the decimal part, make at least one side a double: (double)a / b gives 3.5. Print it with %.2f for two decimals.",
      "Dividing by zero crashes the program, so check if (b == 0) first and print a message."
    ],
    "example": {
      "code": "#include <stdio.h>\n\nint main(void) {\n    int a = 7, b = 2;\n    printf(\"%.2f\\n\", (double)a / b);\n    printf(\"%d\\n\", a % b);\n    return 0;\n}\n",
      "output": "3.50\n1"
    },
    "keyPoints": [
      "int / int is an int",
      "(double)a / b keeps decimals",
      "Check b == 0 before / or %"
    ],
    "resources": [
      {
        "label": "Integer division",
        "url": "https://en.cppreference.com/w/c/language/operator_arithmetic"
      }
    ],
    "practice": {
      "id": "ex-divmod",
      "title": "Quotient and remainder",
      "prompt": "Read two integers a and b.\nIf b is 0, print: Cannot divide by zero\nOtherwise print two lines:\nQuotient: <a / b with 2 decimals>\nRemainder: <a % b>",
      "starter": "#include <stdio.h>\n\nint main(void) {\n    int a, b;\n    scanf(\"%d %d\", &a, &b);\n    // handle b == 0, then print quotient and remainder\n    return 0;\n}\n",
      "hints": [
        "Look at the failing test: does your quotient keep its decimals?",
        "Use (double)a / b and the format %.2f.",
        "Write if (b == 0) { ... } before the division so the program never divides by zero."
      ],
      "skill": "division_modulus",
      "tests": [
        {
          "name": "Decimal quotient",
          "stdin": "7 2",
          "expected": "Quotient: 3.50\nRemainder: 1",
          "hidden": false
        },
        {
          "name": "Exact division",
          "stdin": "10 5",
          "expected": "Quotient: 2.00\nRemainder: 0",
          "hidden": false
        },
        {
          "name": "Zero divisor",
          "stdin": "9 0",
          "expected": "Cannot divide by zero",
          "hidden": false
        },
        {
          "name": "Fraction below one",
          "stdin": "1 4",
          "expected": "Quotient: 0.25\nRemainder: 1",
          "hidden": true
        }
      ]
    }
  },
  {
    "id": "l6-ifelse",
    "order": 6,
    "title": "If-else statements",
    "objective": "Choose between actions with if, else if and else.",
    "skill": "conditionals",
    "prerequisites": [
      "l5-divmod"
    ],
    "concepts": [
      "if / else",
      "Comparison operators",
      "== versus ="
    ],
    "explanation": [
      "if (condition) { ... } runs the block only when the condition is true. else covers the other case and else if adds more branches.",
      "Comparison operators are == != < > <= >=. Use == to compare. A single = assigns and is a common bug."
    ],
    "example": {
      "code": "#include <stdio.h>\n\nint main(void) {\n    int n;\n    scanf(\"%d\", &n);\n    if (n % 2 == 0) printf(\"Even\\n\");\n    else printf(\"Odd\\n\");\n    return 0;\n}\n",
      "output": "Even",
      "stdin": "10"
    },
    "keyPoints": [
      "== compares, = assigns",
      "Only one branch of an if/else-if chain runs",
      "Order your conditions carefully"
    ],
    "resources": [
      {
        "label": "if statement",
        "url": "https://en.cppreference.com/w/c/language/if"
      }
    ],
    "practice": {
      "id": "ex-if",
      "title": "Sign of a number",
      "prompt": "Read an integer. Print Positive if it is above 0, Negative if below 0, or Zero if it is 0.",
      "starter": "#include <stdio.h>\n\nint main(void) {\n    int n;\n    scanf(\"%d\", &n);\n    return 0;\n}\n",
      "hints": [
        "Start with if (n > 0).",
        "Use else if (n < 0) and finish with else.",
        "Compare with ==, never a single =."
      ],
      "skill": "conditionals",
      "tests": [
        {
          "name": "Positive",
          "stdin": "8",
          "expected": "Positive",
          "hidden": false
        },
        {
          "name": "Negative",
          "stdin": "-2",
          "expected": "Negative",
          "hidden": false
        },
        {
          "name": "Zero",
          "stdin": "0",
          "expected": "Zero",
          "hidden": false
        },
        {
          "name": "Large negative",
          "stdin": "-100",
          "expected": "Negative",
          "hidden": true
        }
      ]
    }
  },
  {
    "id": "l7-calc",
    "order": 7,
    "title": "Mini calculator",
    "objective": "Combine input, operators and conditions into one working calculator.",
    "skill": "calculator",
    "prerequisites": [
      "l6-ifelse"
    ],
    "concepts": [
      "Reading a char operator",
      "switch or if-else chain",
      "Reusing earlier concepts"
    ],
    "explanation": [
      "Read two numbers and an operator character: scanf(\"%d %c %d\", &a, &op, &b). Use a space before %c when mixing numbers and characters.",
      "Choose the action with if/else if or switch (op). Division should keep decimals and refuse to divide by zero."
    ],
    "example": {
      "code": "#include <stdio.h>\n\nint main(void) {\n    int a, b; char op;\n    scanf(\"%d %c %d\", &a, &op, &b);\n    if (op == '+') printf(\"%.2f\\n\", (double)a + b);\n    return 0;\n}\n",
      "output": "5.00",
      "stdin": "2 + 3"
    },
    "keyPoints": [
      "Characters use single quotes: '+'",
      "Space before %c skips whitespace",
      "Print results with %.2f"
    ],
    "resources": [
      {
        "label": "switch statement",
        "url": "https://en.cppreference.com/w/c/language/switch"
      }
    ],
    "practice": {
      "id": "ex-calc",
      "title": "One-line calculator",
      "prompt": "Read: a op b (for example 8 / 2). Print the result with 2 decimals for + - * /.\nFor / with b = 0 print: Error: division by zero\nFor any other operator print: Error: unknown operator",
      "starter": "#include <stdio.h>\n\nint main(void) {\n    int a, b;\n    char op;\n    return 0;\n}\n",
      "hints": [
        "Read with scanf(\"%d %c %d\", &a, &op, &b);",
        "Use (double) so 7 / 2 gives 3.50.",
        "Handle op == '/' and b == 0 before dividing."
      ],
      "skill": "calculator",
      "tests": [
        {
          "name": "Addition",
          "stdin": "2 + 3",
          "expected": "5.00",
          "hidden": false
        },
        {
          "name": "Subtraction",
          "stdin": "10 - 4",
          "expected": "6.00",
          "hidden": false
        },
        {
          "name": "Multiplication",
          "stdin": "6 * 7",
          "expected": "42.00",
          "hidden": false
        },
        {
          "name": "Division keeps decimals",
          "stdin": "7 / 2",
          "expected": "3.50",
          "hidden": false
        },
        {
          "name": "Divide by zero",
          "stdin": "5 / 0",
          "expected": "Error: division by zero",
          "hidden": false
        },
        {
          "name": "Unknown operator",
          "stdin": "5 ^ 2",
          "expected": "Error: unknown operator",
          "hidden": true
        }
      ]
    }
  },
  {
    "id": "l8-final",
    "order": 8,
    "title": "Final project: arithmetic calculator",
    "objective": "Build a working calculator that handles several calculations in one run.",
    "skill": "project",
    "prerequisites": [
      "l7-calc"
    ],
    "concepts": [
      "Loops",
      "Combining every earlier concept",
      "Testing your own program"
    ],
    "explanation": [
      "Read n, the number of calculations. A for loop repeats the calculator n times. Each line has the form: a op b.",
      "This is your lesson 7 program inside a loop. Test it with several inputs, including division by zero, before you submit."
    ],
    "example": {
      "code": "#include <stdio.h>\n\nint main(void) {\n    int n;\n    scanf(\"%d\", &n);\n    for (int i = 0; i < n; i++) {\n        printf(\"round %d\\n\", i + 1);\n    }\n    return 0;\n}\n",
      "output": "round 1\nround 2",
      "stdin": "2"
    },
    "keyPoints": [
      "for (init; condition; step) repeats code",
      "Reuse working code instead of rewriting",
      "Always test edge cases"
    ],
    "resources": [
      {
        "label": "for loop",
        "url": "https://en.cppreference.com/w/c/language/for"
      }
    ],
    "practice": {
      "id": "ex-final",
      "title": "Multi-operation calculator",
      "prompt": "First read n. Then read n lines of the form: a op b.\nFor each line print the result with 2 decimals using + - * /.\nFor / with b = 0 print: Error: division by zero\nFor an unknown operator print: Error: unknown operator",
      "starter": "#include <stdio.h>\n\nint main(void) {\n    int n;\n    scanf(\"%d\", &n);\n    return 0;\n}\n",
      "hints": [
        "Wrap your lesson 7 logic in a for loop.",
        "Use scanf(\" %d %c %d\", &a, &op, &b); inside the loop.",
        "Keep the division-by-zero check inside the loop."
      ],
      "skill": "project",
      "tests": [
        {
          "name": "Three calculations",
          "stdin": "3\n2 + 3\n9 - 4\n7 / 2",
          "expected": "5.00\n5.00\n3.50",
          "hidden": false
        },
        {
          "name": "Edge cases",
          "stdin": "2\n5 / 0\n4 * 4",
          "expected": "Error: division by zero\n16.00",
          "hidden": false
        },
        {
          "name": "Single calculation",
          "stdin": "1\n8 / 2",
          "expected": "4.00",
          "hidden": false
        },
        {
          "name": "Unknown operator",
          "stdin": "2\n1 ? 1\n3 - 5",
          "expected": "Error: unknown operator\n-2.00",
          "hidden": true
        }
      ]
    }
  }
];

export const MENTOR_REMEDIALS: Record<string, MentorExerciseMeta & { remedialFor: string }> = {
  "missing_stdio": {
    "id": "rem-missing_stdio",
    "title": "Targeted practice: include the right header",
    "prompt": "Write a complete program that prints: Hello, C!\nStart it with the correct #include line.",
    "starter": "int main(void) {\n    return 0;\n}\n",
    "hints": [
      "Which header declares printf?",
      "Add #include <stdio.h> on the first line."
    ],
    "skill": "output",
    "tests": [
      {
        "name": "Prints greeting",
        "stdin": "",
        "expected": "Hello, C!",
        "hidden": false
      }
    ],
    "remedialFor": "missing_stdio"
  },
  "scanf_missing_address": {
    "id": "rem-scanf_missing_address",
    "title": "Targeted practice: scanf needs the address",
    "prompt": "Read your age as an integer and print: Age: <age>",
    "starter": "#include <stdio.h>\n\nint main(void) {\n    int age;\n    return 0;\n}\n",
    "hints": [
      "scanf stores into a variable, so it needs where that variable lives.",
      "Write scanf(\"%d\", &age);"
    ],
    "skill": "input",
    "tests": [
      {
        "name": "Age 19",
        "stdin": "19",
        "expected": "Age: 19",
        "hidden": false
      },
      {
        "name": "Age 30",
        "stdin": "30",
        "expected": "Age: 30",
        "hidden": false
      },
      {
        "name": "Age 7",
        "stdin": "7",
        "expected": "Age: 7",
        "hidden": true
      }
    ],
    "remedialFor": "scanf_missing_address"
  },
  "wrong_format_specifier": {
    "id": "rem-wrong_format_specifier",
    "title": "Targeted practice: match the specifier to the type",
    "prompt": "Read one decimal number (double) and print: Value: <number with 2 decimals>",
    "starter": "#include <stdio.h>\n\nint main(void) {\n    double x;\n    return 0;\n}\n",
    "hints": [
      "scanf uses %lf for double.",
      "printf(\"Value: %.2f\\n\", x);"
    ],
    "skill": "input",
    "tests": [
      {
        "name": "2.5",
        "stdin": "2.5",
        "expected": "Value: 2.50",
        "hidden": false
      },
      {
        "name": "10",
        "stdin": "10",
        "expected": "Value: 10.00",
        "hidden": false
      },
      {
        "name": "0.125",
        "stdin": "0.125",
        "expected": "Value: 0.13",
        "hidden": true
      }
    ],
    "remedialFor": "wrong_format_specifier"
  },
  "integer_division": {
    "id": "rem-integer_division",
    "title": "Targeted practice: average with decimals",
    "prompt": "Read two integers a and b. Print their average with 2 decimals (for example 7 and 2 give 4.50).",
    "starter": "#include <stdio.h>\n\nint main(void) {\n    int a, b;\n    return 0;\n}\n",
    "hints": [
      "(a + b) / 2 is integer division when a and b are ints.",
      "Write (a + b) / 2.0 or (double)(a + b) / 2.",
      "Print with printf(\"%.2f\\n\", ...);"
    ],
    "skill": "division_modulus",
    "tests": [
      {
        "name": "Odd sum",
        "stdin": "7 2",
        "expected": "4.50",
        "hidden": false
      },
      {
        "name": "Even sum",
        "stdin": "10 4",
        "expected": "7.00",
        "hidden": false
      },
      {
        "name": "Small numbers",
        "stdin": "1 2",
        "expected": "1.50",
        "hidden": false
      },
      {
        "name": "Negative",
        "stdin": "-3 0",
        "expected": "-1.50",
        "hidden": true
      }
    ],
    "remedialFor": "integer_division"
  },
  "division_by_zero": {
    "id": "rem-division_by_zero",
    "title": "Targeted practice: safe modulus",
    "prompt": "Read two integers a and b. If b is 0 print: Undefined\nOtherwise print a % b.",
    "starter": "#include <stdio.h>\n\nint main(void) {\n    int a, b;\n    return 0;\n}\n",
    "hints": [
      "Check b first.",
      "if (b == 0) { printf(\"Undefined\\n\"); } else { ... }"
    ],
    "skill": "division_modulus",
    "tests": [
      {
        "name": "Normal",
        "stdin": "9 4",
        "expected": "1",
        "hidden": false
      },
      {
        "name": "Zero divisor",
        "stdin": "5 0",
        "expected": "Undefined",
        "hidden": false
      },
      {
        "name": "Exact",
        "stdin": "8 2",
        "expected": "0",
        "hidden": false
      },
      {
        "name": "Zero numerator",
        "stdin": "0 3",
        "expected": "0",
        "hidden": true
      }
    ],
    "remedialFor": "division_by_zero"
  },
  "modulus_confusion": {
    "id": "rem-modulus_confusion",
    "title": "Targeted practice: remainders",
    "prompt": "Read two positive integers a and b (b is not 0). Print the remainder of a divided by b.",
    "starter": "#include <stdio.h>\n\nint main(void) {\n    int a, b;\n    return 0;\n}\n",
    "hints": [
      "% gives the remainder.",
      "printf(\"%d\\n\", a % b);"
    ],
    "skill": "division_modulus",
    "tests": [
      {
        "name": "17 5",
        "stdin": "17 5",
        "expected": "2",
        "hidden": false
      },
      {
        "name": "20 4",
        "stdin": "20 4",
        "expected": "0",
        "hidden": false
      },
      {
        "name": "3 7",
        "stdin": "3 7",
        "expected": "3",
        "hidden": false
      },
      {
        "name": "100 9",
        "stdin": "100 9",
        "expected": "1",
        "hidden": true
      }
    ],
    "remedialFor": "modulus_confusion"
  },
  "assignment_in_condition": {
    "id": "rem-assignment_in_condition",
    "title": "Targeted practice: compare with ==",
    "prompt": "Read two integers. Print Equal if they are the same, otherwise print Different.",
    "starter": "#include <stdio.h>\n\nint main(void) {\n    int a, b;\n    return 0;\n}\n",
    "hints": [
      "Use == inside the if.",
      "if (a == b) printf(\"Equal\\n\"); else printf(\"Different\\n\");"
    ],
    "skill": "conditionals",
    "tests": [
      {
        "name": "Same",
        "stdin": "4 4",
        "expected": "Equal",
        "hidden": false
      },
      {
        "name": "Different",
        "stdin": "4 5",
        "expected": "Different",
        "hidden": false
      },
      {
        "name": "Zeros",
        "stdin": "0 0",
        "expected": "Equal",
        "hidden": false
      },
      {
        "name": "Negative",
        "stdin": "-1 1",
        "expected": "Different",
        "hidden": true
      }
    ],
    "remedialFor": "assignment_in_condition"
  },
  "char_whitespace": {
    "id": "rem-char_whitespace",
    "title": "Targeted practice: reading a character",
    "prompt": "Read an integer then a single letter (for example: 5 x). Print: <letter> repeated <number> times on one line, like xxxxx.",
    "starter": "#include <stdio.h>\n\nint main(void) {\n    int n; char c;\n    return 0;\n}\n",
    "hints": [
      "Use scanf(\"%d %c\", &n, &c); with a space before %c.",
      "Loop n times and print c."
    ],
    "skill": "calculator",
    "tests": [
      {
        "name": "5 x",
        "stdin": "5 x",
        "expected": "xxxxx",
        "hidden": false
      },
      {
        "name": "3 a",
        "stdin": "3 a",
        "expected": "aaa",
        "hidden": false
      },
      {
        "name": "1 z",
        "stdin": "1 z",
        "expected": "z",
        "hidden": true
      }
    ],
    "remedialFor": "char_whitespace"
  }
};

export function mentorExerciseMeta(id: string): (MentorExerciseMeta & { remedialFor?: string }) | undefined {
  for (const lesson of MENTOR_LESSONS) if (lesson.practice.id === id) return lesson.practice;
  // MENTOR_REMEDIALS is keyed by misconception id (integer_division) while the
  // exercise id is rem-integer_division: match by exercise id first, then by
  // key for callers that hold the misconception id.
  return Object.values(MENTOR_REMEDIALS).find((e) => e.id === id) ?? MENTOR_REMEDIALS[id];
}
