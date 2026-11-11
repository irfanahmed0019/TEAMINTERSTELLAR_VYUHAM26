/**
 * Study topic library for the Learn page.
 * Each topic carries simple-English notes, a code example, reference links,
 * verified YouTube lessons and one basic practice exercise per language.
 * Exercises are graded for real: the code runs on the Judge0 sandbox through
 * /api/mentor/run and the output is compared with the expected result.
 */

export type TopicLanguage = "c" | "python";

export type TopicVideo = {
  id: string;
  title: string;
  channel: string;
  minutes: number;
};
export type TopicDocLink = { label: string; url: string };

export type TopicTest = {
  name: string;
  stdin: string;
  expected: string;
  hidden?: boolean;
};

export type TopicExercise = {
  title: string;
  task: string;
  instructions: string[];
  starterCode: string;
  expectedOutput: string;
  tests: TopicTest[];
  hint: string;
  explain: string;
};

export type StudyTopic = {
  id: string;
  title: string;
  emoji: string;
  summary: string;
  /** Lowercase words matched against the learner's mission skills. */
  keywords: string[];
  notes: Record<
    TopicLanguage,
    { points: string[]; codeTitle: string; code: string }
  >;
  docs: Record<TopicLanguage, TopicDocLink[]>;
  videos: Record<TopicLanguage, TopicVideo[]>;
  exercise: Record<TopicLanguage, TopicExercise>;
};

export const STUDY_TOPICS: StudyTopic[] = [
  {
    id: "first-program",
    title: "Your First Program",
    emoji: "🖨️",
    summary:
      "Printing text on the screen - the first thing every programmer learns.",
    keywords: [
      "print",
      "printf",
      "output",
      "hello world",
      "first program",
      "printing",
    ],
    notes: {
      c: {
        points: [
          "A program is a list of instructions the computer follows, one by one.",
          "`printf` is the C command that shows text on the screen.",
          "Text must sit inside double quotes, and every line of code ends with a semicolon `;`.",
          '`\\n` means "jump to a new line", like pressing Enter.',
        ],
        codeTitle: "Print your name",
        code: `#include <stdio.h>\n\nint main(void) {\n    printf("Hello, my name is Irfan!\\n");\n    return 0;\n}`,
      },
      python: {
        points: [
          "A program is a list of instructions the computer follows, one by one.",
          "`print()` is the Python command that shows text on the screen.",
          "Text sits inside quotes. Python does not need a semicolon at the end.",
          "Each `print()` starts a new line automatically.",
        ],
        codeTitle: "Print your name",
        code: `print("Hello, my name is Irfan!")`,
      },
    },
    docs: {
      c: [
        {
          label: "Learn-C.org: Hello, World! (interactive)",
          url: "https://www.learn-c.org/en/Hello%2C_World%21",
        },
      ],
      python: [
        {
          label: "Official Python tutorial: first steps",
          url: "https://docs.python.org/3/tutorial/introduction.html",
        },
      ],
    },
    videos: {
      c: [
        {
          id: "nrbBmoINqtk",
          title: "C tutorial for beginners",
          channel: "Bro Code",
          minutes: 13,
        },
      ],
      python: [
        {
          id: "Sg4GMVMdOPo",
          title: "Start coding with PYTHON in 5 minutes!",
          channel: "Bro Code",
          minutes: 6,
        },
      ],
    },
    exercise: {
      c: {
        title: "Print Hello World",
        task: "Make the computer say Hello, world!",
        instructions: [
          "Find the `printf` line in the code.",
          "Change the text so it prints exactly `Hello, world!`.",
          "Click Run to see the output, then Submit Task.",
        ],
        starterCode: `#include <stdio.h>\n\nint main(void) {\n    printf("Hello, world!\\n");\n    return 0;\n}`,
        expectedOutput: "Hello, world!",
        tests: [
          {
            name: "Prints Hello, world!",
            stdin: "",
            expected: "Hello, world!",
          },
        ],
        hint: "The text inside the double quotes is exactly what appears on screen.",
        explain:
          "printf prints whatever sits inside the double quotes. The \\n at the end moves to a new line.",
      },
      python: {
        title: "Print Hello World",
        task: "Make the computer say Hello, world!",
        instructions: [
          "Find the `print()` line in the code.",
          "Change the text so it prints exactly `Hello, world!`.",
          "Click Run to see the output, then Submit Task.",
        ],
        starterCode: `print("Hello, world!")`,
        expectedOutput: "Hello, world!",
        tests: [
          {
            name: "Prints Hello, world!",
            stdin: "",
            expected: "Hello, world!",
          },
        ],
        hint: "The text inside the quotes is exactly what appears on screen.",
        explain:
          "print() shows whatever sits inside the brackets, and starts a new line after it.",
      },
    },
  },
  {
    id: "variables",
    title: "Variables & Data Types",
    emoji: "📦",
    summary:
      "Named boxes that store numbers and text so your program can remember things.",
    keywords: [
      "variables",
      "variable",
      "data types",
      "int",
      "float",
      "char",
      "string",
      "types",
    ],
    notes: {
      c: {
        points: [
          "A variable is a labeled box in memory. The label is the name, the value is what is inside.",
          "`int` stores whole numbers like 10. `float` stores decimals like 3.5. `char` stores one letter.",
          "You create a variable by saying its type, then its name: `int score = 10;`.",
          "You can change what is inside the box later: `score = 25;`.",
        ],
        codeTitle: "Store and print a number",
        code: `#include <stdio.h>\n\nint main(void) {\n    int score = 10;\n    score = 25;\n    printf("Score: %d\\n", score);\n    return 0;\n}`,
      },
      python: {
        points: [
          "A variable is a labeled box in memory. The label is the name, the value is what is inside.",
          'Python figures out the type for you: `score = 10` is a whole number, `name = "Irfan"` is text.',
          "You can change what is inside the box later: `score = 25`.",
          "Use commas inside `print()` to show text and variables together.",
        ],
        codeTitle: "Store and print a number",
        code: `score = 10\nscore = 25\nprint("Score:", score)`,
      },
    },
    docs: {
      c: [
        {
          label: "Learn-C.org: Variables and Types (interactive)",
          url: "https://www.learn-c.org/en/Variables_and_Types",
        },
      ],
      python: [
        {
          label: "Official Python tutorial: numbers and strings",
          url: "https://docs.python.org/3/tutorial/introduction.html",
        },
      ],
    },
    videos: {
      c: [
        {
          id: "WrFEtUzVcnw",
          title: "Learn C programming variables easy!",
          channel: "Bro Code",
          minutes: 20,
        },
      ],
      python: [
        {
          id: "LKFrQXaoSMQ",
          title: "Python variables for beginners",
          channel: "Bro Code",
          minutes: 14,
        },
      ],
    },
    exercise: {
      c: {
        title: "Add two variables",
        task: "Store 5 and 7 in two variables and print their sum.",
        instructions: [
          "`a` already stores 5 and `b` stores 7.",
          "Create `int sum = a + b;`.",
          'Print sum with `printf("%d\\n", sum);` so the output is exactly `12`.',
        ],
        starterCode: `#include <stdio.h>\n\nint main(void) {\n    int a = 5;\n    int b = 7;\n    // create sum and print it\n    return 0;\n}`,
        expectedOutput: "12",
        tests: [{ name: "Prints the sum 12", stdin: "", expected: "12" }],
        hint: "`%d` inside printf is a placeholder that gets replaced by the int variable after the comma.",
        explain:
          "You stored numbers in boxes called a and b, added the boxes into a new box called sum, and printed it.",
      },
      python: {
        title: "Add two variables",
        task: "Store 5 and 7 in two variables and print their sum.",
        instructions: [
          "`a` already stores 5 and `b` stores 7.",
          "Create `total = a + b`.",
          "Print total so the output is exactly `12`.",
        ],
        starterCode: `a = 5\nb = 7\n# create total and print it`,
        expectedOutput: "12",
        tests: [{ name: "Prints the sum 12", stdin: "", expected: "12" }],
        hint: "Write `total = a + b` on one line, then `print(total)` on the next.",
        explain:
          "You stored numbers in boxes called a and b, added them into a new box called total, and printed it.",
      },
    },
  },
  {
    id: "input",
    title: "User Input",
    emoji: "⌨️",
    summary: "Let the person using your program type values in while it runs.",
    keywords: ["input", "scanf", "user input", "read", "keyboard", "type"],
    notes: {
      c: {
        points: [
          "`scanf` pauses the program and waits for the user to type something.",
          '`%d` means "read a whole number". The `&` before the variable name tells C where to save it.',
          "Always print a question first, so the user knows what to type.",
          'Example: `scanf("%d", &age);` saves the typed number into `age`.',
        ],
        codeTitle: "Ask for a number and use it",
        code: `#include <stdio.h>\n\nint main(void) {\n    int age;\n    printf("Enter your age: ");\n    scanf("%d", &age);\n    printf("Next year you will be %d\\n", age + 1);\n    return 0;\n}`,
      },
      python: {
        points: [
          "`input()` pauses the program and waits for the user to type something.",
          "Whatever the user types comes back as text, even if it looks like a number.",
          "Use `int()` to turn the text into a whole number: `age = int(input())`.",
          'Always put a question inside `input("...")` so the user knows what to type.',
        ],
        codeTitle: "Ask for a number and use it",
        code: `age = int(input("Enter your age: "))\nprint("Next year you will be", age + 1)`,
      },
    },
    docs: {
      c: [
        {
          label: "C reference (cppreference): scanf",
          url: "https://en.cppreference.com/w/c/io/fscanf",
        },
      ],
      python: [
        {
          label: "Official Python docs: input()",
          url: "https://docs.python.org/3/library/functions.html#input",
        },
      ],
    },
    videos: {
      c: [
        {
          id: "Ws-mVAJDFAw",
          title: "C user input",
          channel: "Bro Code",
          minutes: 7,
        },
      ],
      python: [
        {
          id: "DB9Cq6TSTuQ",
          title: "Python user input",
          channel: "Bro Code",
          minutes: 7,
        },
      ],
    },
    exercise: {
      c: {
        title: "Double the number",
        task: "Read a number from the user and print double it.",
        instructions: [
          "The code already reads one number into `n`.",
          'Print `n * 2` with `printf("%d\\n", n * 2);`.',
          "Run it: the test types 21, so the answer must be `42`.",
        ],
        starterCode: `#include <stdio.h>\n\nint main(void) {\n    int n;\n    scanf("%d", &n);\n    // print double of n\n    return 0;\n}`,
        expectedOutput: "42",
        tests: [
          { name: "Typing 21 prints 42", stdin: "21\n", expected: "42" },
          {
            name: "Typing 5 prints 10",
            stdin: "5\n",
            expected: "10",
            hidden: true,
          },
        ],
        hint: 'You can multiply right inside printf: `printf("%d\\n", n * 2);`.',
        explain:
          "scanf saved the typed number into n, and you printed n times 2. The program works for any number the user types.",
      },
      python: {
        title: "Double the number",
        task: "Read a number from the user and print double it.",
        instructions: [
          "The code already reads one number into `n`.",
          "Print `n * 2`.",
          "Run it: the test types 21, so the answer must be `42`.",
        ],
        starterCode: `n = int(input())\n# print double of n`,
        expectedOutput: "42",
        tests: [
          { name: "Typing 21 prints 42", stdin: "21\n", expected: "42" },
          {
            name: "Typing 5 prints 10",
            stdin: "5\n",
            expected: "10",
            hidden: true,
          },
        ],
        hint: "Write `print(n * 2)` below the input line.",
        explain:
          "input() saved the typed number into n, and you printed n times 2. The program works for any number the user types.",
      },
    },
  },
  {
    id: "math",
    title: "Math & Operators",
    emoji: "➕",
    summary:
      "Add, subtract, multiply, divide and get remainders inside your program.",
    keywords: [
      "math",
      "operators",
      "arithmetic",
      "add",
      "subtract",
      "multiply",
      "divide",
      "modulus",
      "remainder",
    ],
    notes: {
      c: {
        points: [
          "`+` adds, `-` subtracts, `*` multiplies, `/` divides.",
          "`%` gives the remainder after division: `17 % 5` is 2, because 17 = 3 x 5 + 2.",
          "Dividing two `int` values drops the decimal part: `7 / 2` gives 3, not 3.5.",
          "Use brackets to control the order, just like in school math: `(a + b) * 2`.",
        ],
        codeTitle: "Remainder with %",
        code: `#include <stdio.h>\n\nint main(void) {\n    int left = 17 % 5;\n    printf("Remainder: %d\\n", left);\n    return 0;\n}`,
      },
      python: {
        points: [
          "`+` adds, `-` subtracts, `*` multiplies, `/` divides.",
          "`%` gives the remainder after division: `17 % 5` is 2, because 17 = 3 x 5 + 2.",
          "`//` divides and drops the decimal part: `7 // 2` gives 3.",
          "Use brackets to control the order, just like in school math: `(a + b) * 2`.",
        ],
        codeTitle: "Remainder with %",
        code: `left = 17 % 5\nprint("Remainder:", left)`,
      },
    },
    docs: {
      c: [
        {
          label: "C reference (cppreference): arithmetic operators",
          url: "https://en.cppreference.com/w/c/language/operator_arithmetic",
        },
      ],
      python: [
        {
          label: "Official Python docs: numeric types",
          url: "https://docs.python.org/3/library/stdtypes.html#numeric-types-int-float-complex",
        },
      ],
    },
    videos: {
      c: [
        {
          id: "9E3I1URu6fc",
          title: "C arithmetic operators",
          channel: "Bro Code",
          minutes: 4,
        },
      ],
      python: [
        {
          id: "jc7TBgMS_kw",
          title: "Math in Python is easy!",
          channel: "Bro Code",
          minutes: 14,
        },
      ],
    },
    exercise: {
      c: {
        title: "Find the remainder",
        task: "Print the remainder when 17 is divided by 5.",
        instructions: [
          "`%` is the remainder operator in C.",
          'Print `17 % 5` with `printf("%d\\n", 17 % 5);`.',
          "The correct output is `2`.",
        ],
        starterCode: `#include <stdio.h>\n\nint main(void) {\n    // print the remainder of 17 divided by 5\n    return 0;\n}`,
        expectedOutput: "2",
        tests: [{ name: "Prints the remainder 2", stdin: "", expected: "2" }],
        hint: 'Type `printf("%d\\n", 17 % 5);` inside main.',
        explain:
          "17 = 3 x 5 + 2, so the remainder is 2. The % operator is how programs find leftovers.",
      },
      python: {
        title: "Find the remainder",
        task: "Print the remainder when 17 is divided by 5.",
        instructions: [
          "`%` is the remainder operator in Python.",
          "Print `17 % 5`.",
          "The correct output is `2`.",
        ],
        starterCode: `# print the remainder of 17 divided by 5`,
        expectedOutput: "2",
        tests: [{ name: "Prints the remainder 2", stdin: "", expected: "2" }],
        hint: "Write `print(17 % 5)`.",
        explain:
          "17 = 3 x 5 + 2, so the remainder is 2. The % operator is how programs find leftovers.",
      },
    },
  },
  {
    id: "conditions",
    title: "if / else Conditions",
    emoji: "🔀",
    summary:
      "Teach your program to make decisions: do this if true, otherwise do that.",
    keywords: [
      "if",
      "else",
      "conditions",
      "condition",
      "comparison",
      "decision",
      "elif",
    ],
    notes: {
      c: {
        points: [
          "`if` checks a question. If the answer is true, its block runs.",
          "`else` runs only when the `if` question was false.",
          '`==` asks "are these equal?" A single `=` only stores a value, it does not compare.',
          "`>` `<` `>=` `<=` `!=` compare numbers: bigger, smaller, not equal.",
        ],
        codeTitle: "Guard against division by zero",
        code: `#include <stdio.h>\n\nint main(void) {\n    int b = 0;\n    if (b == 0) {\n        printf("Cannot divide by zero!\\n");\n    } else {\n        printf("Result: %d\\n", 10 / b);\n    }\n    return 0;\n}`,
      },
      python: {
        points: [
          "`if` checks a question. If the answer is true, its block runs.",
          "`else` runs only when the `if` question was false. `elif` adds one more question in between.",
          '`==` asks "are these equal?" A single `=` only stores a value, it does not compare.',
          "Python uses indentation (spaces) to know which lines belong to the if block.",
        ],
        codeTitle: "Guard against division by zero",
        code: `b = 0\nif b == 0:\n    print("Cannot divide by zero!")\nelse:\n    print("Result:", 10 / b)`,
      },
    },
    docs: {
      c: [
        {
          label: "Learn-C.org: Conditions (interactive)",
          url: "https://www.learn-c.org/en/Conditions",
        },
      ],
      python: [
        {
          label: "Official Python tutorial: if statements",
          url: "https://docs.python.org/3/tutorial/controlflow.html#if-statements",
        },
      ],
    },
    videos: {
      c: [
        {
          id: "xyQrVEFz9kw",
          title: "C if statements",
          channel: "Bro Code",
          minutes: 4,
        },
      ],
      python: [
        {
          id: "FvMPfrgGeKs",
          title: "If statements in Python are easy (if, elif, else)",
          channel: "Bro Code",
          minutes: 8,
        },
      ],
    },
    exercise: {
      c: {
        title: "Positive or not",
        task: "Read a number and print `positive` if it is above zero, otherwise print `not positive`.",
        instructions: [
          "The code reads one number into `n`.",
          "Write `if (n > 0)` and print `positive` inside it.",
          "Add `else` and print `not positive` inside it.",
        ],
        starterCode: `#include <stdio.h>\n\nint main(void) {\n    int n;\n    scanf("%d", &n);\n    // print "positive" when n is above 0, else print "not positive"\n    return 0;\n}`,
        expectedOutput: "positive",
        tests: [
          {
            name: "Typing 8 prints positive",
            stdin: "8\n",
            expected: "positive",
          },
          {
            name: "Typing -3 prints not positive",
            stdin: "-3\n",
            expected: "not positive",
            hidden: true,
          },
        ],
        hint: '`if (n > 0) { printf("positive\\n"); } else { printf("not positive\\n"); }`',
        explain:
          "The if checked n > 0. When it was true the first block ran, otherwise the else block ran. That is a decision.",
      },
      python: {
        title: "Positive or not",
        task: "Read a number and print `positive` if it is above zero, otherwise print `not positive`.",
        instructions: [
          "The code reads one number into `n`.",
          "Write `if n > 0:` and print `positive` under it (indented).",
          "Add `else:` and print `not positive` under it.",
        ],
        starterCode: `n = int(input())\n# print "positive" when n is above 0, else print "not positive"`,
        expectedOutput: "positive",
        tests: [
          {
            name: "Typing 8 prints positive",
            stdin: "8\n",
            expected: "positive",
          },
          {
            name: "Typing -3 prints not positive",
            stdin: "-3\n",
            expected: "not positive",
            hidden: true,
          },
        ],
        hint: 'if n > 0:\n    print("positive")\nelse:\n    print("not positive")',
        explain:
          "The if checked n > 0. When it was true the first block ran, otherwise the else block ran. That is a decision.",
      },
    },
  },
  {
    id: "loops",
    title: "Loops",
    emoji: "🔁",
    summary: "Repeat work without copying the same line again and again.",
    keywords: ["loop", "loops", "while", "for", "iteration", "repeat"],
    notes: {
      c: {
        points: [
          "A loop repeats its block while a condition stays true.",
          "`while (choice != 0) { ... }` keeps going until the user types 0.",
          "`for (int i = 1; i <= 5; i++)` counts: start at 1, stop after 5, add 1 each time.",
          "Be careful: if the condition never becomes false, the loop runs forever.",
        ],
        codeTitle: "Count from 1 to 5",
        code: `#include <stdio.h>\n\nint main(void) {\n    for (int i = 1; i <= 5; i++) {\n        printf("%d\\n", i);\n    }\n    return 0;\n}`,
      },
      python: {
        points: [
          "A loop repeats its block again and again.",
          "`for i in range(1, 6):` counts i through 1, 2, 3, 4, 5.",
          "`while` repeats as long as its condition stays true.",
          "Be careful: if a while condition never becomes false, the loop runs forever.",
        ],
        codeTitle: "Count from 1 to 5",
        code: `for i in range(1, 6):\n    print(i)`,
      },
    },
    docs: {
      c: [
        {
          label: "Learn-C.org: For loops (interactive)",
          url: "https://www.learn-c.org/en/For_loops",
        },
        {
          label: "Learn-C.org: While loops (interactive)",
          url: "https://www.learn-c.org/en/While_loops",
        },
      ],
      python: [
        {
          label: "Official Python tutorial: for and while",
          url: "https://docs.python.org/3/tutorial/controlflow.html#for-statements",
        },
      ],
    },
    videos: {
      c: [
        {
          id: "6YNYuJ_jiu0",
          title: "While loops in C are easy!",
          channel: "Bro Code",
          minutes: 11,
        },
        {
          id: "b4DPj0XAfSg",
          title: "C for loops in 3 minutes!",
          channel: "Bro Code",
          minutes: 3,
        },
      ],
      python: [
        {
          id: "rRTjPnVooxE",
          title: "While loops in Python are easy!",
          channel: "Bro Code",
          minutes: 7,
        },
        {
          id: "KWgYha0clzw",
          title: "Learn Python for loops in 5 minutes!",
          channel: "Bro Code",
          minutes: 5,
        },
      ],
    },
    exercise: {
      c: {
        title: "Count with a loop",
        task: "Use a loop to print the numbers 1 to 5, each on its own line.",
        instructions: [
          "Write `for (int i = 1; i <= 5; i++)`.",
          'Inside the loop, print `i` with `printf("%d\\n", i);`.',
          "The output must be 1, 2, 3, 4, 5 - one per line.",
        ],
        starterCode: `#include <stdio.h>\n\nint main(void) {\n    // use a for loop to print 1 to 5, one per line\n    return 0;\n}`,
        expectedOutput: "1\n2\n3\n4\n5",
        tests: [
          {
            name: "Prints 1 to 5, one per line",
            stdin: "",
            expected: "1\n2\n3\n4\n5",
          },
        ],
        hint: 'for (int i = 1; i <= 5; i++) { printf("%d\\n", i); }',
        explain:
          "The loop started i at 1, printed it, added 1, and repeated until i passed 5. Five lines from one printf.",
      },
      python: {
        title: "Count with a loop",
        task: "Use a loop to print the numbers 1 to 5, each on its own line.",
        instructions: [
          "Write `for i in range(1, 6):`.",
          "Inside the loop, print `i`.",
          "The output must be 1, 2, 3, 4, 5 - one per line.",
        ],
        starterCode: `# use a for loop to print 1 to 5, one per line`,
        expectedOutput: "1\n2\n3\n4\n5",
        tests: [
          {
            name: "Prints 1 to 5, one per line",
            stdin: "",
            expected: "1\n2\n3\n4\n5",
          },
        ],
        hint: "for i in range(1, 6):\n    print(i)",
        explain:
          "range(1, 6) gives 1 to 5, and the loop printed each one. Five lines from one print.",
      },
    },
  },
  {
    id: "functions",
    title: "Functions",
    emoji: "📞",
    summary:
      "Give a name to a block of code so you can call it whenever you need it.",
    keywords: ["function", "functions", "def", "parameter", "return", "call"],
    notes: {
      c: {
        points: [
          "A function is a mini-program with a name. You call its name to run it.",
          "`int add(int a, int b)` takes two numbers in and gives one number back.",
          "`return` sends the answer back to whoever called the function.",
          "Functions keep code tidy: write the logic once, use it many times.",
        ],
        codeTitle: "A function that adds",
        code: `#include <stdio.h>\n\nint add(int a, int b) {\n    return a + b;\n}\n\nint main(void) {\n    printf("%d\\n", add(3, 4));\n    return 0;\n}`,
      },
      python: {
        points: [
          "A function is a mini-program with a name. You call its name to run it.",
          "`def add(a, b):` creates a function that takes two values.",
          "`return` sends the answer back to whoever called the function.",
          "Functions keep code tidy: write the logic once, use it many times.",
        ],
        codeTitle: "A function that adds",
        code: `def add(a, b):\n    return a + b\n\nprint(add(3, 4))`,
      },
    },
    docs: {
      c: [
        {
          label: "Learn-C.org: Functions (interactive)",
          url: "https://www.learn-c.org/en/Functions",
        },
      ],
      python: [
        {
          label: "Official Python tutorial: defining functions",
          url: "https://docs.python.org/3/tutorial/controlflow.html#defining-functions",
        },
      ],
    },
    videos: {
      c: [
        {
          id: "ou_G7_zodR4",
          title: "C functions",
          channel: "Bro Code",
          minutes: 3,
        },
      ],
      python: [
        {
          id: "89cGQjB5R4M",
          title: "Functions in Python are easy",
          channel: "Bro Code",
          minutes: 11,
        },
      ],
    },
    exercise: {
      c: {
        title: "Write a square function",
        task: "Write a function `square` that returns a number times itself, and print `square(6)`.",
        instructions: [
          "Above main, write `int square(int n) { return n * n; }`.",
          'Inside main, print it: `printf("%d\\n", square(6));`.',
          "The correct output is `36`.",
        ],
        starterCode: `#include <stdio.h>\n\n// write int square(int n) here\n\nint main(void) {\n    // print square(6)\n    return 0;\n}`,
        expectedOutput: "36",
        tests: [{ name: "Prints square(6) = 36", stdin: "", expected: "36" }],
        hint: 'int square(int n) { return n * n; } then printf("%d\\n", square(6));',
        explain:
          "You named a block of code square. Calling square(6) ran that block with n = 6 and returned 36.",
      },
      python: {
        title: "Write a square function",
        task: "Write a function `square` that returns a number times itself, and print `square(6)`.",
        instructions: [
          "Write `def square(n):` with `return n * n` inside it.",
          "Print it: `print(square(6))`.",
          "The correct output is `36`.",
        ],
        starterCode: `# write def square(n): here\n\n# print square(6)`,
        expectedOutput: "36",
        tests: [{ name: "Prints square(6) = 36", stdin: "", expected: "36" }],
        hint: "def square(n):\n    return n * n\n\nprint(square(6))",
        explain:
          "You named a block of code square. Calling square(6) ran that block with n = 6 and returned 36.",
      },
    },
  },
  {
    id: "recursion",
    title: "Recursion",
    emoji: "♾️",
    summary:
      "A function that calls itself to solve a big problem in small steps.",
    keywords: ["recursion", "recursive", "factorial", "fibonacci", "base case"],
    notes: {
      c: {
        points: [
          "Recursion means a function calls itself with a smaller piece of the problem.",
          "Every recursive function needs a base case: the point where it stops calling itself.",
          "Factorial is the classic example: 5! = 5 x 4 x 3 x 2 x 1 = 120.",
          "Without a base case the function calls itself forever and the program crashes.",
        ],
        codeTitle: "Factorial with recursion",
        code: `#include <stdio.h>\n\nint factorial(int n) {\n    if (n <= 1) return 1;\n    return n * factorial(n - 1);\n}\n\nint main(void) {\n    printf("%d\\n", factorial(5));\n    return 0;\n}`,
      },
      python: {
        points: [
          "Recursion means a function calls itself with a smaller piece of the problem.",
          "Every recursive function needs a base case: the point where it stops calling itself.",
          "Factorial is the classic example: 5! = 5 x 4 x 3 x 2 x 1 = 120.",
          "Without a base case the function calls itself forever and Python stops it with an error.",
        ],
        codeTitle: "Factorial with recursion",
        code: `def factorial(n):\n    if n <= 1:\n        return 1\n    return n * factorial(n - 1)\n\nprint(factorial(5))`,
      },
    },
    docs: {
      c: [
        {
          label: "Learn-C.org: Recursion (interactive)",
          url: "https://www.learn-c.org/en/Recursion",
        },
      ],
      python: [
        {
          label: "Official Python tutorial: defining functions",
          url: "https://docs.python.org/3/tutorial/controlflow.html#defining-functions",
        },
      ],
    },
    videos: {
      c: [
        {
          id: "kepBmgvWNDw",
          title: "Recursion in C",
          channel: "Neso Academy",
          minutes: 11,
        },
      ],
      python: [
        {
          id: "ivl5-snqul8",
          title: "Learn RECURSION in 5 minutes!",
          channel: "Bro Code",
          minutes: 6,
        },
      ],
    },
    exercise: {
      c: {
        title: "Recursive factorial",
        task: "Finish the recursive `factorial` function so `factorial(5)` prints `120`.",
        instructions: [
          "The base case is done: if n is 1 or less, return 1.",
          "Otherwise return `n * factorial(n - 1)`.",
          "Run it: factorial(5) must print `120`.",
        ],
        starterCode: `#include <stdio.h>\n\nint factorial(int n) {\n    if (n <= 1) return 1;\n    // return n times factorial of (n - 1)\n}\n\nint main(void) {\n    printf("%d\\n", factorial(5));\n    return 0;\n}`,
        expectedOutput: "120",
        tests: [
          { name: "factorial(5) prints 120", stdin: "", expected: "120" },
        ],
        hint: "Write `return n * factorial(n - 1);` after the if.",
        explain:
          "factorial(5) asked factorial(4), which asked factorial(3), down to 1 - then the answers multiplied back up to 120.",
      },
      python: {
        title: "Recursive factorial",
        task: "Finish the recursive `factorial` function so `factorial(5)` prints `120`.",
        instructions: [
          "The base case is done: if n is 1 or less, return 1.",
          "Otherwise return `n * factorial(n - 1)`.",
          "Run it: factorial(5) must print `120`.",
        ],
        starterCode: `def factorial(n):\n    if n <= 1:\n        return 1\n    # return n times factorial of (n - 1)\n\nprint(factorial(5))`,
        expectedOutput: "120",
        tests: [
          { name: "factorial(5) prints 120", stdin: "", expected: "120" },
        ],
        hint: "Write `return n * factorial(n - 1)` at the same indent as the if.",
        explain:
          "factorial(5) asked factorial(4), which asked factorial(3), down to 1 - then the answers multiplied back up to 120.",
      },
    },
  },
  {
    id: "arrays-lists",
    title: "Arrays & Lists",
    emoji: "🗃️",
    summary: "Store many values in one place and work through them one by one.",
    keywords: ["array", "arrays", "list", "lists", "index"],
    notes: {
      c: {
        points: [
          "An array is a row of boxes of the same type, stored under one name.",
          "`int marks[3] = {4, 8, 15};` makes three boxes. The first box is `marks[0]` - counting starts at 0!",
          "Use a loop to walk through every box: `for (int i = 0; i < 3; i++)`.",
          "Asking for a box that does not exist (like `marks[5]`) is a classic bug.",
        ],
        codeTitle: "Total of an array",
        code: `#include <stdio.h>\n\nint main(void) {\n    int marks[3] = {4, 8, 15};\n    int total = 0;\n    for (int i = 0; i < 3; i++) {\n        total = total + marks[i];\n    }\n    printf("Total: %d\\n", total);\n    return 0;\n}`,
      },
      python: {
        points: [
          "A list is a row of boxes stored under one name: `marks = [4, 8, 15]`.",
          "The first box is `marks[0]` - counting starts at 0!",
          "`len(marks)` tells you how many boxes there are.",
          "Use a loop to visit every item: `for m in marks:`.",
        ],
        codeTitle: "Total of a list",
        code: `marks = [4, 8, 15]\ntotal = 0\nfor m in marks:\n    total = total + m\nprint("Total:", total)`,
      },
    },
    docs: {
      c: [
        {
          label: "Learn-C.org: Arrays (interactive)",
          url: "https://www.learn-c.org/en/Arrays",
        },
      ],
      python: [
        {
          label: "Official Python tutorial: lists and data structures",
          url: "https://docs.python.org/3/tutorial/datastructures.html",
        },
      ],
    },
    videos: {
      c: [
        {
          id: "eE9MnoS0lc0",
          title: "C arrays",
          channel: "Bro Code",
          minutes: 5,
        },
      ],
      python: [
        {
          id: "gOMW_n2-2Mw",
          title: "Python lists, sets, and tuples explained",
          channel: "Bro Code",
          minutes: 15,
        },
      ],
    },
    exercise: {
      c: {
        title: "Sum the array",
        task: "Add up all three numbers in the array and print the total.",
        instructions: [
          "The array holds 4, 8 and 15.",
          "Loop with `for (int i = 0; i < 3; i++)` and add each `marks[i]` into total.",
          "Print total - the answer must be `27`.",
        ],
        starterCode: `#include <stdio.h>\n\nint main(void) {\n    int marks[3] = {4, 8, 15};\n    int total = 0;\n    // add every marks[i] into total\n    printf("%d\\n", total);\n    return 0;\n}`,
        expectedOutput: "27",
        tests: [{ name: "Prints the total 27", stdin: "", expected: "27" }],
        hint: "for (int i = 0; i < 3; i++) { total = total + marks[i]; }",
        explain:
          "The loop visited marks[0], marks[1] and marks[2], adding each one: 4 + 8 + 15 = 27.",
      },
      python: {
        title: "Sum the list",
        task: "Add up all three numbers in the list and print the total.",
        instructions: [
          "The list holds 4, 8 and 15.",
          "Loop with `for m in marks:` and add each m into total.",
          "Print total - the answer must be `27`.",
        ],
        starterCode: `marks = [4, 8, 15]\ntotal = 0\n# add every m in marks into total\nprint(total)`,
        expectedOutput: "27",
        tests: [{ name: "Prints the total 27", stdin: "", expected: "27" }],
        hint: "for m in marks:\n    total = total + m",
        explain:
          "The loop visited each item in the list, adding them up: 4 + 8 + 15 = 27.",
      },
    },
  },
  {
    id: "strings",
    title: "Strings",
    emoji: "🔤",
    summary: "Work with text: names, words and sentences inside your program.",
    keywords: ["string", "strings", "text", "char", "characters"],
    notes: {
      c: {
        points: [
          "A string in C is an array of characters ending with a hidden `\\0` marker.",
          '`char name[] = "Irfan";` stores the word plus that hidden end marker.',
          "`strlen(name)` from `<string.h>` tells you how many letters are in it.",
          "You cannot compare strings with `==` - use `strcmp(a, b) == 0` instead.",
        ],
        codeTitle: "How long is the word?",
        code: `#include <stdio.h>\n#include <string.h>\n\nint main(void) {\n    char word[] = "logic";\n    printf("Letters: %zu\\n", strlen(word));\n    return 0;\n}`,
      },
      python: {
        points: [
          'A string is text inside quotes: `word = "logic"`.',
          "`len(word)` tells you how many letters are in it.",
          'Strings join with `+`: `"Hello " + "there"`.',
          "Methods like `word.upper()` and `word.lower()` change the letters.",
        ],
        codeTitle: "How long is the word?",
        code: `word = "logic"\nprint("Letters:", len(word))`,
      },
    },
    docs: {
      c: [
        {
          label: "Learn-C.org: Strings (interactive)",
          url: "https://www.learn-c.org/en/Strings",
        },
      ],
      python: [
        {
          label: "Official Python docs: text (str)",
          url: "https://docs.python.org/3/library/stdtypes.html#text-sequence-type-str",
        },
      ],
    },
    videos: {
      c: [
        {
          id: "60OI5tzmkCw",
          title: "String Basics | C Programming Tutorial",
          channel: "Portfolio Courses",
          minutes: 8,
        },
      ],
      python: [
        {
          id: "tb6EYiHtcXU",
          title: "String methods in Python are easy!",
          channel: "Bro Code",
          minutes: 12,
        },
      ],
    },
    exercise: {
      c: {
        title: "Count the letters",
        task: "Print how many letters are in the word `logic`.",
        instructions: [
          "`strlen` from `<string.h>` counts the letters.",
          'Print `strlen(word)` with `printf("%zu\\n", strlen(word));`.',
          "The correct output is `5`.",
        ],
        starterCode: `#include <stdio.h>\n#include <string.h>\n\nint main(void) {\n    char word[] = "logic";\n    // print the length of word\n    return 0;\n}`,
        expectedOutput: "5",
        tests: [{ name: "Prints the length 5", stdin: "", expected: "5" }],
        hint: 'printf("%zu\\n", strlen(word));',
        explain:
          "strlen walked along the string until the hidden end marker and counted 5 letters.",
      },
      python: {
        title: "Count the letters",
        task: "Print how many letters are in the word `logic`.",
        instructions: [
          "`len()` counts the letters in a string.",
          "Print `len(word)`.",
          "The correct output is `5`.",
        ],
        starterCode: `word = "logic"\n# print the length of word`,
        expectedOutput: "5",
        tests: [{ name: "Prints the length 5", stdin: "", expected: "5" }],
        hint: "print(len(word))",
        explain: "len() counted the 5 letters in the word.",
      },
    },
  },
];

/** Match topics against the learner's mission skills so their syllabus shows first. */
export function topicMatchesSkills(
  topic: StudyTopic,
  skills: string[],
): boolean {
  const hay = skills.map((s) => s.toLowerCase());
  return topic.keywords.some((k) =>
    hay.some((s) => s.includes(k) || k.includes(s)),
  );
}

export function topicById(id: string): StudyTopic | undefined {
  return STUDY_TOPICS.find((t) => t.id === id);
}
