// Section checkpoint questions grounded in timestamped YouTube transcript panel captions.
// Each entry is keyed by `${videoId}:${sectionIndex}` with a ZERO-BASED section index and
// 120-second sections. `quote` is an exact substring of one auto-generated caption line that
// starts at `startSeconds` and ends at `endSeconds` (the next caption's start), and that
// caption-start interval lies inside the section window. Caption ends are not supplied by YouTube; the next caption start is an alignment boundary, not an audio-verified end. Captions were read on 2026-11-16 from
// https://www.youtube.com/watch?v=<videoId> (transcript panel, English auto-generated).
// Sections with no instructional caption (outro only) or any unknown video return null.
import { PYTHON_COURSE_ENTRIES } from "./video-section-questions-python-course.ts";
export type CaptionKind = "auto" | "manual";
export type SectionQuestion = {
  prompt: string;
  options: string[];
  answer: number;
  explanation: string;
  provenance: {
    sourceUrl: string;
    quote: string;
    startSeconds: number;
    endSeconds: number;
    captionKind: CaptionKind;
  };
};
type Entry = {
  prompt: string;
  options: string[];
  answer: number;
  explanation: string;
  quote: string;
  startSeconds: number;
  endSeconds: number;
};
export const SECTION_SECONDS = 120;
const ENTRIES: Record<string, Entry> = {
  ...PYTHON_COURSE_ENTRIES,
  [`60OI5tzmkCw:0`]: {
    prompt: "What does the null terminator do in a C string?",
    options: [
      "Marks the end of the string",
      "Sets the string's length",
      "Makes the string uppercase",
      "Prints a new line",
    ],
    answer: 0,
    explanation:
      "The null terminator is a special character that signifies the end of the string.",
    quote:
      "a special character called the null terminator that signifies the end of the string",
    startSeconds: 9,
    endSeconds: 15,
  },
  [`60OI5tzmkCw:1`]: {
    prompt:
      "When a char array is initialized from a string literal with no size, how does C choose its size?",
    options: [
      "It always uses 50",
      "Enough room for the characters and null terminator",
      "It uses the size of an int",
      "It must be typed by hand",
    ],
    answer: 1,
    explanation:
      "C infers enough space for the literal characters plus the terminating null character.",
    quote:
      "big of an array to make test two based on the length of this string literal",
    startSeconds: 200,
    endSeconds: 207,
  },
  [`60OI5tzmkCw:2`]: {
    prompt: "Does strlen count the null terminator?",
    options: ["Yes, always", "Only for empty strings", "No", "Only in loops"],
    answer: 2,
    explanation:
      "strlen gives the length of the string not including the null terminator.",
    quote:
      "length gives us the length of the string not including the null terminator",
    startSeconds: 293,
    endSeconds: 300,
  },
  [`60OI5tzmkCw:3`]: {
    prompt: "What does the string copy function do with strcpy(s2, s1)?",
    options: [
      "Copies s2 into s1",
      "Copies s1 into s2",
      "Compares the two strings",
      "Counts the characters",
    ],
    answer: 1,
    explanation:
      "The function copies s1 into s2, so printing s2 shows the copied text.",
    quote: "copy s1 into s2",
    startSeconds: 450,
    endSeconds: 459,
  },
  [`6YNYuJ_jiu0:0`]: {
    prompt: "Why does a while loop need a way to escape?",
    options: [
      "So the program can continue with the rest of the code",
      "So printf works",
      "So variables are declared",
      "So it runs faster",
    ],
    answer: 0,
    explanation:
      "Without an exit, the loop never ends and the program cannot continue.",
    quote: "some way to escape a while loop",
    startSeconds: 75,
    endSeconds: 84,
  },
  [`6YNYuJ_jiu0:1`]: {
    prompt:
      "If the condition of a normal while loop is false at the start, what happens?",
    options: [
      "The loop runs once",
      "The loop is skipped",
      "An error occurs",
      "The loop runs forever",
    ],
    answer: 1,
    explanation:
      "The condition must be true to enter the loop; otherwise the loop is skipped.",
    quote: "must be true to begin with in order for you to enter it",
    startSeconds: 179,
    endSeconds: 188,
  },
  [`6YNYuJ_jiu0:2`]: {
    prompt: "How does a do while loop differ from a while loop?",
    options: [
      "It checks the condition at the end",
      "It has no condition",
      "It never repeats",
      "It checks the condition twice",
    ],
    answer: 0,
    explanation:
      "A do while loop runs the code once and then checks the condition at the end.",
    quote: "you check the condition at the end rather than the beginning",
    startSeconds: 252,
    endSeconds: 260,
  },
  [`6YNYuJ_jiu0:3`]: {
    prompt:
      "With a Boolean variable named is running, how can the while condition be written?",
    options: [
      "while (is_running == 0)",
      "while (is_running)",
      "while (is_running = true;)",
      "while (not)",
    ],
    answer: 1,
    explanation:
      "A Boolean is already true or false, so you can just use the variable as the condition.",
    quote: "you don't need to say is equal to true",
    startSeconds: 471,
    endSeconds: 479,
  },
  [`6YNYuJ_jiu0:4`]: {
    prompt: "Which symbol pair means not equal in C, as used in the video?",
    options: ["!=", "=!", "<>", "=/="],
    answer: 0,
    explanation: "Not equal is an exclamation point followed by an equal sign.",
    quote: "for not equal you can use an exclamation point",
    startSeconds: 564,
    endSeconds: 572,
  },
  [`6YNYuJ_jiu0:5`]: {
    prompt:
      "Which operator joins response != 'Y' and response != 'y' so the combined condition is true only when the response is neither letter?",
    options: ["or", "xor", "and", "not"],
    answer: 2,
    explanation:
      "Logical AND makes both not-equal comparisons necessary. This is a neither-Y-nor-y condition, not the positive condition for continuing on either letter.",
    quote:
      "logical operator and our response does not equal a character of lowercase y",
    startSeconds: 626,
    endSeconds: 635,
  },
  [`89cGQjB5R4M:0`]: {
    prompt: "How does the video describe a function?",
    options: [
      "A block of reusable code",
      "A kind of variable",
      "A loop",
      "A data type",
    ],
    answer: 0,
    explanation:
      "The speaker says to think of a function as a block of reusable code.",
    quote: "think of a function as a block of reusable code",
    startSeconds: 0,
    endSeconds: 7,
  },
  [`89cGQjB5R4M:1`]: {
    prompt: "What is a parameter, according to the video?",
    options: [
      "The value you pass in",
      "A temporary variable used within a function",
      "A function's return value",
      "A comment",
    ],
    answer: 1,
    explanation:
      "A parameter is kind of like a temporary variable used within the function.",
    quote:
      "a parameter is kind of like a temporary variable that's used within a function",
    startSeconds: 137,
    endSeconds: 144,
  },
  [`89cGQjB5R4M:2`]: {
    prompt:
      "When the parameters age and name were switched, what did the video show?",
    options: [
      "Nothing changed",
      "The order of arguments and parameters matters",
      "Python reordered them",
      "An import error occurred",
    ],
    answer: 1,
    explanation:
      "Switching them printed the wrong values, so position matters for parameters and arguments.",
    quote: "so the position of the parameters",
    startSeconds: 245,
    endSeconds: 254,
  },
  [`89cGQjB5R4M:3`]: {
    prompt: "What does the return statement do?",
    options: [
      "Prints a value",
      "Ends a function and sends a result back to the caller",
      "Starts a loop",
      "Defines a parameter",
    ],
    answer: 1,
    explanation:
      "return ends the function and sends a result back to the caller.",
    quote:
      "statement that is used to end a function and send a result back to the caller",
    startSeconds: 375,
    endSeconds: 384,
  },
  [`89cGQjB5R4M:4`]: {
    prompt:
      "After a function that returns a value finishes, what does the call expression become?",
    options: ["Nothing", "The function name", "The returned value", "An error"],
    answer: 2,
    explanation: "The call becomes whatever value the function returns.",
    quote:
      "just imagine that after we finish this function this function becomes whatever is returned",
    startSeconds: 490,
    endSeconds: 500,
  },
  [`89cGQjB5R4M:5`]: {
    prompt: "How do you call a function in Python, per the summary?",
    options: [
      "Type its name followed by parentheses",
      "Type def before its name",
      "Type return after its name",
      "Type its name in quotes",
    ],
    answer: 0,
    explanation:
      "To call a function, type its name and add a set of parentheses.",
    quote:
      "to call a function you type the function's name add a set of parentheses",
    startSeconds: 612,
    endSeconds: 619,
  },
  [`9E3I1URu6fc:0`]: {
    prompt:
      "In C, 5 divided by 2 stored in an int gives which result, as shown in the video?",
    options: ["2", "2.5", "3", "0.5"],
    answer: 0,
    explanation:
      "With integers only whole numbers are stored, so the decimal part is truncated and the result is 2.",
    quote: "it's 2 because we're storing the results",
    startSeconds: 43,
    endSeconds: 52,
  },
  [`9E3I1URu6fc:1`]: {
    prompt: "What does 5 modulus 2 give?",
    options: ["0", "2", "2.5", "1"],
    answer: 3,
    explanation:
      "Modulus gives the remainder of a division; 5 divided by 2 leaves a remainder of 1.",
    quote: "the remainder of five divided by two is one",
    startSeconds: 140,
    endSeconds: 148,
  },
  [`DB9Cq6TSTuQ:0`]: {
    prompt: "What data type does the value from Python's input() have?",
    options: ["int", "float", "string", "bool"],
    answer: 2,
    explanation:
      "The speaker says user input is always of the string data type.",
    quote: "it is always of the string data type",
    startSeconds: 101,
    endSeconds: 110,
  },
  [`DB9Cq6TSTuQ:1`]: {
    prompt: "Before doing math on a value from input(), what should you do?",
    options: [
      "Convert it to an integer or float",
      "Print it twice",
      "Wrap it in extra quotes",
      "Nothing, it already works",
    ],
    answer: 0,
    explanation:
      "Strings cannot be used for math, so the video casts the input to the integer or float data type.",
    quote: "we'll want to cast it to the integer or",
    startSeconds: 161,
    endSeconds: 168,
  },
  [`DB9Cq6TSTuQ:2`]: {
    prompt:
      "What happens when the user types 21.5 and the code casts it with int()?",
    options: [
      "It rounds to 22",
      "It becomes 21 without an error",
      "A ValueError occurs because int needs a whole number",
      "It becomes a float automatically",
    ],
    answer: 2,
    explanation:
      "The video shows a ValueError because int() only accepts a whole number; float is used for decimals.",
    quote: "if we cast a string as an integer it can only be a whole number",
    startSeconds: 281,
    endSeconds: 290,
  },
  [`DB9Cq6TSTuQ:3`]: {
    prompt:
      "What does the closing summary say to do if you need input for math?",
    options: [
      "Use print instead",
      "Cast it to the integer or float data type",
      "Delete the prompt",
      "Use only strings",
    ],
    answer: 1,
    explanation:
      "Input is normally a string, so you cast it to an integer or float for math.",
    quote: "it will give you a value of the string data type",
    startSeconds: 382,
    endSeconds: 391,
  },
  [`FvMPfrgGeKs:0`]: {
    prompt: "How should the code under an if statement be written?",
    options: [
      "Indented",
      "On the same line without a colon",
      "In quotes",
      "Inside curly braces",
    ],
    answer: 0,
    explanation:
      "The speaker says code under the if statement must be indented.",
    quote: "any code underneath the if statement should be indented",
    startSeconds: 54,
    endSeconds: 62,
  },
  [`FvMPfrgGeKs:1`]: {
    prompt:
      "In the video, why was a 111-year-old told 'you are now signed up'?",
    options: [
      "Python ignores elif",
      "The age >= 18 check came first and was still true",
      "Age cannot exceed 100",
      "The else block ran first",
    ],
    answer: 1,
    explanation:
      "The earlier condition was still true, so order matters; the speaker moves the age >= 100 check to the beginning.",
    quote: "condition is still technically true",
    startSeconds: 218,
    endSeconds: 225,
  },
  [`FvMPfrgGeKs:2`]: {
    prompt: "Which operator compares two values for equality in Python?",
    options: ["=", "=>", "==", "=:"],
    answer: 2,
    explanation:
      "The double equals sign is the comparison operator; a single equals is assignment.",
    quote: "the doubles equal sign is the comparison operator",
    startSeconds: 304,
    endSeconds: 313,
  },
  [`FvMPfrgGeKs:3`]: {
    prompt:
      "Can an if statement use a Boolean variable directly as the condition?",
    options: [
      "No, it needs == True",
      "Yes, a Boolean can stand in for the condition",
      "Only inside a loop",
      "Only with else",
    ],
    answer: 1,
    explanation:
      "A condition evaluates to true or false, so a Boolean variable can be used directly.",
    quote: "you can just use the Boolean variable in place of a condition",
    startSeconds: 408,
    endSeconds: 415,
  },
  [`FvMPfrgGeKs:4`]: {
    prompt: "According to the summary, when does an if statement run its code?",
    options: [
      "Always",
      "Never",
      "Only if its condition is true",
      "Only after else",
    ],
    answer: 2,
    explanation:
      "The summary says if statements do some code only if some condition is true.",
    quote: "do some code only if some condition is true",
    startSeconds: 482,
    endSeconds: 491,
  },
  [`KWgYha0clzw:0`]: {
    prompt:
      "In the Python for loop example, which numbers does range(1, 11) produce?",
    options: ["1 through 10", "1 through 11", "2 through 11", "1 through 9"],
    answer: 0,
    explanation:
      "The second number is exclusive, so writing 11 counts up to 10.",
    quote:
      "the second number is exclusive so really we're going to write 11 if we want to count to 10",
    startSeconds: 47,
    endSeconds: 57,
  },
  [`KWgYha0clzw:1`]: {
    prompt: "What do you add to range() to count by twos?",
    options: [
      "A second loop",
      "A step value such as , 2",
      "The continue keyword",
      "A string",
    ],
    answer: 1,
    explanation:
      "The extra parameter is the step; adding comma two counts by twos.",
    quote: "if you would like to count by twos you would add comma two",
    startSeconds: 136,
    endSeconds: 144,
  },
  [`KWgYha0clzw:2`]: {
    prompt: "Which keyword exits a loop entirely, as shown in the video?",
    options: ["continue", "pass", "break", "else"],
    answer: 2,
    explanation:
      "The video contrasts continue, which skips one iteration, with break, which leaves the loop entirely.",
    quote: "the break keyword we will break out of this Loop entirely",
    startSeconds: 255,
    endSeconds: 264,
  },
  [`LKFrQXaoSMQ:0`]: {
    prompt: "How does the video describe a variable?",
    options: [
      "A reusable container for storing a value",
      "A fixed constant that never changes",
      "A function that returns text",
      "A loop counter only",
    ],
    answer: 0,
    explanation:
      "The speaker defines a variable as a reusable container for storing a value.",
    quote: "a variable is a reusable container for storing a value",
    startSeconds: 15,
    endSeconds: 23,
  },
  [`LKFrQXaoSMQ:1`]: {
    prompt: "In a Python f-string, what do the curly braces do?",
    options: [
      "End the string",
      "Mark a comment",
      "Act as a placeholder for a value or variable",
      "Convert text to a number",
    ],
    answer: 2,
    explanation:
      "Curly braces in an f-string hold a placeholder where the variable's value is inserted.",
    quote:
      "the curly braces are acting as a placeholder for a value or variable",
    startSeconds: 216,
    endSeconds: 224,
  },
  [`LKFrQXaoSMQ:2`]: {
    prompt: "Which four basic data types does the video list for beginners?",
    options: [
      "Integers, floats, strings and booleans",
      "Arrays, lists, tuples and sets",
      "Loops, functions, classes and modules",
      "Chars, bytes, words and bits",
    ],
    answer: 0,
    explanation: "The video names integers, floats, strings and booleans.",
    quote: "we have integers floats strings and booleans",
    startSeconds: 249,
    endSeconds: 257,
  },
  [`LKFrQXaoSMQ:3`]: {
    prompt:
      "Is a number written with a decimal point and a zero, such as 5.0, an integer or a float?",
    options: ["An integer", "A string", "A boolean", "A float"],
    answer: 3,
    explanation:
      "A number with a decimal portion is a float even if the decimal is point zero.",
    quote:
      "even if the decimal had point zero it would still be considered a float",
    startSeconds: 428,
    endSeconds: 437,
  },
  [`LKFrQXaoSMQ:4`]: {
    prompt: "How many states can a Boolean variable have?",
    options: [
      "Two: true or false",
      "Three",
      "Any whole number",
      "As many as it is assigned",
    ],
    answer: 0,
    explanation: "A Boolean is binary, like a light switch: true or false.",
    quote: "a Boolean variable can have only one of two states true or false",
    startSeconds: 530,
    endSeconds: 539,
  },
  [`LKFrQXaoSMQ:5`]: {
    prompt: "What is a Boolean value written within quotes in Python?",
    options: ["Still a Boolean", "A float", "A string", "An integer"],
    answer: 2,
    explanation:
      "Within quotes it is technically a string, which the speaker calls a common mistake.",
    quote: "this is technically a string",
    startSeconds: 668,
    endSeconds: 676,
  },
  [`LKFrQXaoSMQ:6`]: {
    prompt: "What does x = y = z = 0 do, as shown in the video?",
    options: [
      "Compares x, y and z to zero",
      "Sets x, y and z all to zero",
      "Sets only z to zero",
      "Raises an error",
    ],
    answer: 1,
    explanation:
      "Chained assignment sets multiple variables to the same value.",
    quote: "x equals y equals z equals zero",
    startSeconds: 740,
    endSeconds: 750,
  },
  [`Sg4GMVMdOPo:0`]: {
    prompt:
      "On Windows, which option does the video ask you to check while installing Python?",
    options: [
      "Add python.exe to PATH",
      "Disable Python",
      "Delete the interpreter",
      "Install only a browser",
    ],
    answer: 0,
    explanation:
      "The installation walkthrough asks Windows users to check Add python.exe to PATH. This lets the shell find the Python command.",
    quote: "exe to path and we will install now",
    startSeconds: 74,
    endSeconds: 84,
  },
  [`Sg4GMVMdOPo:1`]: {
    prompt: "What file extension do Python files end with?",
    options: [".pyt", ".python", ".py", ".exe"],
    answer: 2,
    explanation:
      "The speaker says Python files end with the py file extension.",
    quote: "python files end with the py file extension",
    startSeconds: 223,
    endSeconds: 231,
  },
  [`Sg4GMVMdOPo:2`]: {
    prompt: "How do you write a comment in Python, according to the video?",
    options: [
      "With a pound sign (hashtag)",
      "With double slashes",
      "With the word note",
      "With angle brackets",
    ],
    answer: 0,
    explanation:
      "A comment starts with a pound sign, and the interpreter does not output it.",
    quote:
      "the python interpreter doesn't output comments to write a comment you use a pound sign",
    startSeconds: 310,
    endSeconds: 318,
  },
  [`WrFEtUzVcnw:0`]: {
    prompt: "Which format specifier displays an int in printf?",
    options: ["%f", "%c", "%d", "%s"],
    answer: 2,
    explanation: "A percent sign with d (decimal) displays an integer.",
    quote: "to use a percent sign for a format specifier to display an INT",
    startSeconds: 71,
    endSeconds: 78,
  },
  [`WrFEtUzVcnw:1`]: {
    prompt: "Which data type suits the quantity of products bought?",
    options: ["int", "float", "char", "Boolean"],
    answer: 0,
    explanation: "Quantities are whole numbers, so an integer fits.",
    quote: "quantities would be whole numbers typically",
    startSeconds: 184,
    endSeconds: 192,
  },
  [`WrFEtUzVcnw:2`]: {
    prompt: "Which format specifier displays a float in printf?",
    options: ["%d", "%c", "%s", "%f"],
    answer: 3,
    explanation: "A percent sign with f displays a floating point number.",
    quote: "we're going to type f for floating Point number",
    startSeconds: 283,
    endSeconds: 290,
  },
  [`WrFEtUzVcnw:3`]: {
    prompt:
      "Which data type does the video suggest when you need more precision than a float?",
    options: ["int", "double", "char", "Boolean"],
    answer: 1,
    explanation: "A double has more precision and can store 15 to 16 digits.",
    quote: "you can use a different data type known as a double",
    startSeconds: 457,
    endSeconds: 469,
  },
  [`WrFEtUzVcnw:4`]: {
    prompt: "Which format specifier displays a double in the video?",
    options: ["%lf", "%d", "%c", "%s"],
    answer: 0,
    explanation:
      "The video uses %lf. In printf, %f also formats a double and the l modifier has no effect. %Lf is for long double; calling lf long float is inaccurate.",
    quote: "a format specifier then type LF meaning long float",
    startSeconds: 492,
    endSeconds: 500,
  },
  [`WrFEtUzVcnw:5`]: {
    prompt: "How does C represent a string, according to the video?",
    options: [
      "With a string data type",
      "With an int",
      "With an array of characters",
      "With a double",
    ],
    answer: 2,
    explanation:
      "C has no string type; an array of characters represents a string.",
    quote: "we use an array of characters to represent a string",
    startSeconds: 707,
    endSeconds: 715,
  },
  [`WrFEtUzVcnw:6`]: {
    prompt:
      "What quotes does the video use for an array of characters (string) value?",
    options: ["Single quotes", "Backticks", "No quotes", "Double quotes"],
    answer: 3,
    explanation:
      "Strings in C go within double quotes; single characters use single quotes.",
    quote: "they do have to be within double quotes",
    startSeconds: 776,
    endSeconds: 783,
  },
  [`WrFEtUzVcnw:7`]: {
    prompt:
      "Which header file does the video include to work with Booleans in C?",
    options: ["stdbool.h", "stdio.h", "string.h", "math.h"],
    answer: 0,
    explanation: "The speaker includes stdbool.h, meaning standard Boolean.",
    quote: "meaning standard Boolean and this is a header file",
    startSeconds: 896,
    endSeconds: 904,
  },
  [`WrFEtUzVcnw:8`]: {
    prompt:
      "What number does a true Boolean display as with %d, according to the video?",
    options: ["0", "1", "2", "-1"],
    answer: 1,
    explanation: "True corresponds to one and false to zero.",
    quote: "one also means true",
    startSeconds: 962,
    endSeconds: 969,
  },
  [`WrFEtUzVcnw:9`]: {
    prompt: "How much memory does a char use, according to the summary?",
    options: ["One byte", "Four bytes", "Eight bytes", "Sixteen bytes"],
    answer: 0,
    explanation:
      "The summary says a char is a single character that uses one byte.",
    quote: "a Char is a single character they use up one bite",
    startSeconds: 1158,
    endSeconds: 1166,
  },
  [`Ws-mVAJDFAw:0`]: {
    prompt: "In the C user input video, which function reads input?",
    options: ["scanf", "printf", "main", "return"],
    answer: 0,
    explanation: "printf displays output; scanf reads input.",
    quote: "scanf is used to read input",
    startSeconds: 75,
    endSeconds: 82,
  },
  [`Ws-mVAJDFAw:1`]: {
    prompt:
      "What does the speaker say happens if input goes over the character array's size limit?",
    options: [
      "The array grows",
      "The compiler fixes it",
      "Nothing",
      "A buffer overflow",
    ],
    answer: 3,
    explanation: "Going over the array limit causes a buffer overflow.",
    quote: "cause a buffer overflow",
    startSeconds: 173,
    endSeconds: 182,
  },
  [`Ws-mVAJDFAw:2`]: {
    prompt:
      "Which function does the video use to read input that includes white spaces?",
    options: ["scanf with %d", "fgets", "printf", "strlen"],
    answer: 1,
    explanation: "scanf stops at white space, so the video switches to fgets.",
    quote: "function and that is the f gets function",
    startSeconds: 256,
    endSeconds: 263,
  },
  [`Ws-mVAJDFAw:3`]: {
    prompt: "Why use fgets instead of scanf for a first and last name?",
    options: [
      "scanf is slower",
      "scanf stops at white space",
      "fgets removes the need for arrays",
      "scanf cannot read numbers",
    ],
    answer: 1,
    explanation:
      "scanf cannot read past white space, so it would drop the last name.",
    quote: "scanf can't read those white spaces",
    startSeconds: 376,
    endSeconds: 384,
  },
  [`b4DPj0XAfSg:0`]: {
    prompt: "In the for loop, what does the third statement i++ do?",
    options: [
      "Declares the counter",
      "Increases the counter by one after each iteration",
      "Checks whether to keep looping",
      "Prints the counter",
    ],
    answer: 1,
    explanation:
      "The speaker says the third statement increments the counter by one after each iteration.",
    quote: "increment it by one after each iteration by using i plus plus",
    startSeconds: 81,
    endSeconds: 92,
  },
  [`b4DPj0XAfSg:1`]: {
    prompt:
      "To count from 10 down to 1, which condition and update does the speaker use?",
    options: [
      "i <= 1 with i++",
      "i >= 10 with i++",
      "i >= 1 with i--",
      "i == 1 with i--",
    ],
    answer: 2,
    explanation:
      "The loop starts at 10, continues while i is greater than or equal to 1, and decrements with i--.",
    quote: "is greater than or equal to 1 and we will decrement i minus minus",
    startSeconds: 149,
    endSeconds: 156,
  },
  [`eE9MnoS0lc0:0`]: {
    prompt: "What is each spot within an array called?",
    options: ["A bucket", "An element", "A key", "A frame"],
    answer: 1,
    explanation:
      "Each spot within an array is known as an element, accessed by an index number.",
    quote: "known as an element so we have five elements within our array",
    startSeconds: 111,
    endSeconds: 118,
  },
  [`eE9MnoS0lc0:1`]: {
    prompt: "Can an array's size change after the program is compiled and run?",
    options: [
      "Yes, it grows automatically",
      "No, the size is fixed",
      "Only when it is empty",
      "Only for char arrays",
    ],
    answer: 1,
    explanation:
      "The video states that arrays have a fixed size that cannot change after compiling and running.",
    quote: "arrays they have a fixed size",
    startSeconds: 150,
    endSeconds: 158,
  },
  [`eE9MnoS0lc0:2`]: {
    prompt: "How do you access a value in an array?",
    options: [
      "Type the index number before the type",
      "Type only the array's size",
      "Type the array name followed by an index number",
      "Type the array name followed by a semicolon",
    ],
    answer: 2,
    explanation:
      "The speaker says to type the array name followed by an index number, like a parking spot number.",
    quote: "type the array name followed by an index number",
    startSeconds: 251,
    endSeconds: 259,
  },
  [`gOMW_n2-2Mw:0`]: {
    prompt:
      "Which collection is created by the comma-separated expression ('apple', 'orange')?",
    options: ["A list", "A set", "A dictionary", "A tuple"],
    answer: 3,
    explanation:
      "The comma-separated expression creates a tuple. Parentheses alone around a single value do not create a tuple.",
    quote: "braces for a set or parentheses for a tuple",
    startSeconds: 46,
    endSeconds: 55,
  },
  [`gOMW_n2-2Mw:1`]: {
    prompt: "What happens when a Python list index is beyond the last element?",
    options: [
      "It returns None",
      "An index error occurs",
      "The list grows",
      "It returns zero",
    ],
    answer: 1,
    explanation:
      "Accessing a list index beyond its last element raises IndexError. A membership check is different and does not raise this error.",
    quote: "you'll run into an index error",
    startSeconds: 134,
    endSeconds: 141,
  },
  [`gOMW_n2-2Mw:2`]: {
    prompt: "Which operator tests whether a value is within a collection?",
    options: ["in", "is", "has", "find"],
    answer: 0,
    explanation:
      "The in operator returns a Boolean showing whether the value is in the collection.",
    quote:
      "using the in operator we can find if a value is within a collection",
    startSeconds: 330,
    endSeconds: 337,
  },
  [`gOMW_n2-2Mw:3`]: {
    prompt: "Can the values in a list be changed after the list is created?",
    options: [
      "No, lists are unchangeable",
      "Yes, a list's values can be changed",
      "Only the first value",
      "Only by creating a new tuple",
    ],
    answer: 1,
    explanation:
      "Lists are ordered and changeable, so a value can be reassigned by index.",
    quote: "we can change one of these values after we create our list",
    startSeconds: 367,
    endSeconds: 374,
  },
  [`gOMW_n2-2Mw:4`]: {
    prompt: "Which method removes all elements from a list?",
    options: ["remove", "pop", "clear", "sort"],
    answer: 2,
    explanation:
      "The clear method empties a list: fruits.clear() leaves no elements.",
    quote: "to clear a list use the clear method",
    startSeconds: 501,
    endSeconds: 510,
  },
  [`gOMW_n2-2Mw:5`]: {
    prompt: "Why can't you use the index operator on a set?",
    options: [
      "Sets are unordered",
      "Sets are too short",
      "Sets can't hold strings",
      "Sets are changeable",
    ],
    answer: 0,
    explanation: "Indexing a set gives an error because sets are unordered.",
    quote: "we're not able to use indexing on a set because they're unordered",
    startSeconds: 667,
    endSeconds: 675,
  },
  [`gOMW_n2-2Mw:6`]: {
    prompt: "What benefit of a tuple over a list does the video mention?",
    options: [
      "Tuples are faster than lists",
      "Tuples can be changed",
      "Tuples have more methods",
      "Tuples allow no duplicates",
    ],
    answer: 0,
    explanation:
      "The video makes a tuple-speed claim. Actual performance depends on the operation and implementation; choose tuple for immutable sequence semantics, not a universal speed guarantee.",
    quote: "tuples are faster than lists",
    startSeconds: 773,
    endSeconds: 781,
  },
  [`gOMW_n2-2Mw:7`]: {
    prompt:
      "According to the section summary, are Python lists ordered and changeable?",
    options: [
      "Yes, both",
      "Ordered but not changeable",
      "Changeable but unordered",
      "Neither",
    ],
    answer: 0,
    explanation:
      "Lists preserve order and are mutable. They may contain duplicate values. Unlike the video's mistaken set wording, sets are also mutable, but do not allow duplicate elements.",
    quote: "lists are ordered and changeable duplicates are okay",
    startSeconds: 878,
    endSeconds: 886,
  },
  [`ivl5-snqul8:0`]: {
    prompt: "How does the video describe recursion?",
    options: [
      "A function that calls itself from within",
      "A loop with a counter",
      "A way to import modules",
      "A type of variable",
    ],
    answer: 0,
    explanation:
      "The speaker says to think of recursion as just a function that calls itself from within.",
    quote:
      "think of recursion as just a function that calls itself from within",
    startSeconds: 0,
    endSeconds: 9,
  },
  [`ivl5-snqul8:1`]: {
    prompt: "Why does the recursive walk function need a base condition?",
    options: [
      "To define its parameters",
      "To decide when to stop",
      "To print each step",
      "To loop forever",
    ],
    answer: 1,
    explanation:
      "Without a base condition the function recursed below zero; the base condition says when to stop.",
    quote: "we need what is known as a base condition",
    startSeconds: 124,
    endSeconds: 132,
  },
  [`ivl5-snqul8:2`]: {
    prompt:
      "What is the base condition of the recursive factorial in the video?",
    options: [
      "x equals 10",
      "x equals 0 returns 0",
      "x equals one returns one",
      "x is greater than one",
    ],
    answer: 2,
    explanation:
      "The recursive factorial stops when x is equal to one by returning one.",
    quote: "if x is equal to one then we will return one",
    startSeconds: 301,
    endSeconds: 308,
  },
  [`jc7TBgMS_kw:0`]: {
    prompt: "What is friends += 1 called in the video?",
    options: [
      "A comparison operator",
      "An augmented assignment operator",
      "A logical operator",
      "A string method",
    ],
    answer: 1,
    explanation:
      "The speaker names += an augmented assignment operator, a shorter form of friends = friends + 1.",
    quote: "this is known as an augmented assignment operator",
    startSeconds: 62,
    endSeconds: 71,
  },
  [`jc7TBgMS_kw:1`]: {
    prompt: "What does the modulus operator (%) give you?",
    options: [
      "The remainder of a division",
      "The quotient",
      "The square root",
      "The absolute value",
    ],
    answer: 0,
    explanation: "The modulus operator gives the remainder of any division.",
    quote: "it will give us the remainder of any Division",
    startSeconds: 204,
    endSeconds: 211,
  },
  [`jc7TBgMS_kw:2`]: {
    prompt: "What does abs(y) return when y is -4?",
    options: ["-4", "0", "16", "4"],
    answer: 3,
    explanation:
      "The absolute value is the distance from zero, so the absolute value of negative 4 is 4.",
    quote: "the absolute value of negative 4 is 4",
    startSeconds: 323,
    endSeconds: 336,
  },
  [`jc7TBgMS_kw:3`]: {
    prompt: "With x = 3.14, y = 4 and z = 5, what does max(x, y, z) return?",
    options: ["3.14", "4", "5", "12.14"],
    answer: 2,
    explanation: "max returns the largest value, which is five here.",
    quote: "well the maximum value is five",
    startSeconds: 381,
    endSeconds: 390,
  },
  [`jc7TBgMS_kw:4`]: {
    prompt: "What does math.ceil(9.1) return, as shown in the video?",
    options: ["9", "9.1", "10", "9.9"],
    answer: 2,
    explanation:
      "ceil always rounds a floating point number up, so 9.1 becomes 10.",
    quote: "so 9.1 rounded up is 10",
    startSeconds: 495,
    endSeconds: 505,
  },
  [`jc7TBgMS_kw:5`]: {
    prompt: "Which formula does the video use for the area of a circle?",
    options: [
      "2 times pi times radius",
      "Pi times radius squared",
      "Radius times radius times two",
      "Pi plus radius",
    ],
    answer: 1,
    explanation:
      "The area is pi times radius squared; the circumference uses 2 times pi times r.",
    quote: "pi times radius squared",
    startSeconds: 660,
    endSeconds: 671,
  },
  [`jc7TBgMS_kw:6`]: {
    prompt:
      "Which formula does the video use for the hypotenuse c of a right triangle?",
    options: [
      "a plus b",
      "The square root of a squared plus b squared",
      "a times b",
      "a squared minus b squared",
    ],
    answer: 1,
    explanation:
      "The video calculates c as the square root of a squared plus b squared.",
    quote: "the square root of a squared plus b squared",
    startSeconds: 728,
    endSeconds: 737,
  },
  [`kepBmgvWNDw:0`]: {
    prompt: "How does the video define recursion?",
    options: [
      "A function that never returns",
      "A loop that uses a counter",
      "A process in which a function calls itself, directly or indirectly",
      "A variable that stores a function",
    ],
    answer: 2,
    explanation:
      "The definition given: recursion is a process in which a function calls itself directly or indirectly.",
    quote: "recursion is a process in which a function calls itself directly",
    startSeconds: 25,
    endSeconds: 34,
  },
  [`kepBmgvWNDw:1`]: {
    prompt:
      "In the video's example, why is the else part evaluated when n is 3?",
    options: [
      "Because n equals 1 is false for n = 3",
      "Because n is odd",
      "Because main calls fun twice",
      "Because the stack is empty",
    ],
    answer: 0,
    explanation:
      "The check n equals 1 is false for 3, so the else branch with the recursive call runs.",
    quote: "as 3 equals to 1 is false this will not get evaluated",
    startSeconds: 199,
    endSeconds: 208,
  },
  [`kepBmgvWNDw:2`]: {
    prompt: "What happens to a function's activation record when it returns?",
    options: [
      "It is copied twice",
      "It is popped out of the stack",
      "It is moved to the top",
      "It stays forever",
    ],
    answer: 1,
    explanation:
      "Returning pops the activation record out of the stack and goes back to where the caller left off.",
    quote:
      "return means you are simply popping this activation record out of the stack",
    startSeconds: 333,
    endSeconds: 342,
  },
  [`kepBmgvWNDw:3`]: {
    prompt: "What is the output of the fun(3) example in the video?",
    options: ["1", "2", "6", "3"],
    answer: 3,
    explanation:
      "fun(3) returns 1 + fun(2), which returns 1 + fun(1) = 2, so the program prints three.",
    quote: "particular program is three",
    startSeconds: 417,
    endSeconds: 424,
  },
  [`kepBmgvWNDw:4`]: {
    prompt: "Why does fun(1) stop making further calls in the video's example?",
    options: [
      "Its condition n equals 1 is true, so it returns 1",
      "It runs out of memory",
      "It calls main",
      "Its n is negative",
    ],
    answer: 0,
    explanation:
      "For n equal to 1 the condition is true, so the function returns 1 instead of calling itself again.",
    quote: "n is equals to 1 and 1 is equals to 1 which means true",
    startSeconds: 548,
    endSeconds: 556,
  },
  [`kepBmgvWNDw:5`]: {
    prompt: "In the shortcut method, when do you start returning values back?",
    options: [
      "At the first line of main",
      "When you reach a return statement that does not call the function again",
      "Only when n is 0",
      "After printing",
    ],
    answer: 1,
    explanation:
      "Once you find a return statement with a plain value, you return back from that point on.",
    quote: "does not consist of calling the function once again",
    startSeconds: 614,
    endSeconds: 621,
  },
  [`nrbBmoINqtk:0`]: {
    prompt: "How does the video classify C?",
    options: [
      "A low-level machine language only",
      "A middle level language",
      "A markup language",
      "A database language",
    ],
    answer: 1,
    explanation:
      "The speaker calls C a middle level language that originated in the 1970s.",
    quote: "is a middle level language that originated in the 1970s",
    startSeconds: 23,
    endSeconds: 31,
  },
  [`nrbBmoINqtk:1`]: {
    prompt: "What does the GNU compiler collection (gcc) do?",
    options: [
      "Edits text",
      "Converts C code to machine code",
      "Draws the user interface",
      "Saves files online",
    ],
    answer: 1,
    explanation:
      "gcc compiles C code into machine code that the computer can read.",
    quote: "this compiles or otherwise converts c code to machine code",
    startSeconds: 162,
    endSeconds: 169,
  },
  [`nrbBmoINqtk:2`]: {
    prompt: "What file extension does the C source file use in the video?",
    options: [".py", ".txt", ".exe", ".c"],
    answer: 3,
    explanation:
      "The file is named hello world dot c, ending with the c extension.",
    quote: "the c extension hello world dot c",
    startSeconds: 265,
    endSeconds: 273,
  },
  [`nrbBmoINqtk:3`]: {
    prompt: "What does 'configure default build task' create?",
    options: [
      "A JSON file telling VS Code how to compile",
      "A C source file",
      "A new folder",
      "An extension",
    ],
    answer: 0,
    explanation:
      "It creates a JSON file that tells VS Code how to compile the program.",
    quote:
      "this creates a json file that tells vs code how to compile the program",
    startSeconds: 465,
    endSeconds: 473,
  },
  [`nrbBmoINqtk:4`]: {
    prompt: "In main, what does return 0 signal, according to the video?",
    options: [
      "That the program ran successfully with no errors",
      "That an error occurred",
      "That the file is empty",
      "That printf was skipped",
    ],
    answer: 0,
    explanation:
      "Returning zero means the program ran successfully; one means an error.",
    quote: "if our program runs successfully with no errors",
    startSeconds: 570,
    endSeconds: 579,
  },
  [`nrbBmoINqtk:5`]: {
    prompt: "What does adding backslash n at the end of a printf string do?",
    options: [
      "Ends the program",
      "Adds a new line",
      "Adds a tab",
      "Deletes the text",
    ],
    answer: 1,
    explanation: "Backslash n is the escape sequence for a new line character.",
    quote: "an escape sequence for a new line character",
    startSeconds: 652,
    endSeconds: 660,
  },
  [`ou_G7_zodR4:0`]: {
    prompt: "Why does the speaker move the birthday verse into a function?",
    options: [
      "To write the code once and reuse it",
      "To make the program run faster",
      "Because main cannot print text",
      "To avoid using printf",
    ],
    answer: 0,
    explanation:
      "Repeating code is called poor practice; a function lets you write it once and call it as often as needed.",
    quote:
      "wouldn't it be better if we write this code once and then simply reuse it",
    startSeconds: 51,
    endSeconds: 59,
  },
  [`ou_G7_zodR4:1`]: {
    prompt: "What happens when you invoke (call) a function?",
    options: [
      "The program stops",
      "The function is renamed",
      "Its code is executed",
      "Its code is deleted",
    ],
    answer: 2,
    explanation:
      "A function is a section of code that is executed whenever you invoke it.",
    quote: "some subsection of code that is executed whenever you invoke it",
    startSeconds: 125,
    endSeconds: 133,
  },
  [`rRTjPnVooxE:0`]: {
    prompt: "What does a while loop do?",
    options: [
      "Runs code once",
      "Runs code while its condition remains true",
      "Runs code only if it is false",
      "Declares a variable",
    ],
    answer: 1,
    explanation:
      "The speaker says: while this condition remains true, execute this code.",
    quote: "while this condition remains true execute this code",
    startSeconds: 88,
    endSeconds: 96,
  },
  [`rRTjPnVooxE:1`]: {
    prompt: "Why did the speaker's loop run forever?",
    options: [
      "It had no way to make the condition false",
      "It ran only once",
      "print cannot be used in a loop",
      "The condition was a number",
    ],
    answer: 0,
    explanation:
      "The loop had no exit strategy, so the user could not escape it.",
    quote:
      "actually escape this Loop we didn't give ourselves an exit strategy",
    startSeconds: 129,
    endSeconds: 136,
  },
  [`rRTjPnVooxE:2`]: {
    prompt:
      "Which logical operator lets the loop continue while the food is not q?",
    options: ["or", "and", "not", "is"],
    answer: 2,
    explanation:
      "The speaker writes while not food equals q so the loop exits when the user types q.",
    quote: "so you could say while not food",
    startSeconds: 249,
    endSeconds: 258,
  },
  [`rRTjPnVooxE:3`]: {
    prompt: "According to the summary, what are while loops useful for?",
    options: [
      "Importing modules",
      "Verifying user input by re-prompting",
      "Declaring variables",
      "Compiling code",
    ],
    answer: 1,
    explanation:
      "The video says while loops are useful for verifying user input and re-prompting when it is invalid.",
    quote: "it's fairly useful for verifying user input",
    startSeconds: 397,
    endSeconds: 405,
  },
  [`tb6EYiHtcXU:0`]: {
    prompt: "What does the length function (len) give you for a string?",
    options: [
      "How many characters it has",
      "Its first character",
      "Its uppercase version",
      "Its last position",
    ],
    answer: 0,
    explanation:
      "The length function gives the number of characters in the string, including spaces.",
    quote: "the length function will give us the length of a string",
    startSeconds: 27,
    endSeconds: 36,
  },
  [`tb6EYiHtcXU:1`]: {
    prompt: "What does the find method return if the character is not found?",
    options: ["0", "Negative one", "True", "An empty string"],
    answer: 1,
    explanation: "If Python cannot find the character it returns negative one.",
    quote: "character it will return negative one",
    startSeconds: 159,
    endSeconds: 170,
  },
  [`tb6EYiHtcXU:2`]: {
    prompt:
      "What does isdigit() return for a string mixing letters and numbers?",
    options: ["True", "An integer", "A new string", "False"],
    answer: 3,
    explanation:
      "isdigit returns true only if the string contains only digits.",
    quote: "this method will still return false",
    startSeconds: 271,
    endSeconds: 278,
  },
  [`tb6EYiHtcXU:3`]: {
    prompt: "How does the video remove all dashes from a phone number?",
    options: [
      "Replace them with an empty string",
      "Count them",
      "Use upper",
      "Use find",
    ],
    answer: 0,
    explanation:
      "The replace method with an empty string removes the dashes completely.",
    quote:
      "the dashes completely by replacing the dashes or another character with an empty string",
    startSeconds: 437,
    endSeconds: 445,
  },
  [`tb6EYiHtcXU:4`]: {
    prompt:
      "Which function does the username exercise use to check the 12-character limit?",
    options: [
      "The find method",
      "The length function",
      "The count method",
      "The upper method",
    ],
    answer: 1,
    explanation:
      "The length function returns an integer that is compared with 12.",
    quote:
      "input is more than 12 characters long we can do that using the length function",
    startSeconds: 522,
    endSeconds: 532,
  },
  [`tb6EYiHtcXU:5`]: {
    prompt:
      "Which method does the exercise use to reject digits in a username?",
    options: ["isalpha", "isdigit", "replace", "count"],
    answer: 0,
    explanation:
      "isalpha returns a Boolean for whether a string only contains alphabetical characters.",
    quote:
      "strings the is Alpha method returns a Boolean if a string only contains alphabetical characters",
    startSeconds: 661,
    endSeconds: 669,
  },
  [`xyQrVEFz9kw:0`]: {
    prompt: "In C, which operator compares two values for equality?",
    options: ["=", "==", "=>", "!="],
    answer: 1,
    explanation:
      "The speaker says double equal signs compare values and a single equal sign is the assignment operator.",
    quote: "if you use just one this is the assignment operator",
    startSeconds: 50,
    endSeconds: 57,
  },
  [`xyQrVEFz9kw:1`]: {
    prompt:
      "When a condition in an if / else if chain is true, what happens to the later branches?",
    options: [
      "They all run too",
      "They are skipped",
      "Only the else block runs",
      "The program restarts",
    ],
    answer: 1,
    explanation:
      "Once one condition is true, the statements that come after it in the chain are skipped.",
    quote: "true we will skip all of these statements that come after",
    startSeconds: 211,
    endSeconds: 219,
  },
};
export function sectionQuestion(
  videoId: string,
  section: number,
): SectionQuestion | null {
  if (!Number.isInteger(section) || section < 0) return null;
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) return null;
  const e = Object.prototype.hasOwnProperty.call(
    ENTRIES,
    `${videoId}:${section}`,
  )
    ? ENTRIES[`${videoId}:${section}`]
    : undefined;
  if (!e) return null;
  return {
    prompt: e.prompt,
    options: [...e.options],
    answer: e.answer,
    explanation: e.explanation,
    provenance: {
      sourceUrl: `https://www.youtube.com/watch?v=${videoId}`,
      quote: e.quote,
      startSeconds: e.startSeconds,
      endSeconds: e.endSeconds,
      captionKind: "auto",
    },
  };
}
/** Sections that have grounded questions for a video (zero-based, ascending). */
export function groundedSections(videoId: string): number[] {
  const prefix = `${videoId}:`;
  return Object.keys(ENTRIES)
    .filter((k) => k.startsWith(prefix))
    .map((k) => Number(k.slice(prefix.length)))
    .sort((a, b) => a - b);
}
