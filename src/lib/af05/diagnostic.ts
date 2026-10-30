/**
 * Diagnostic assessment content for AF-05.
 *
 * Item types deliberately mix conceptual questions, code interpretation,
 * debugging and short written explanations (kernel section 4 step 2) - the
 * diagnostic never relies on multiple choice alone. `variantOf` items are
 * different-but-equivalent exercises used for delayed reassessment so
 * retention is measured, not memorised answers (kernel section 4 step 9).
 */
import type { SkillId } from "./types";

export type PracticalSpec = {
  instructions: string;
  starterCode: string;
  functionName: string;
  tests: { args: unknown[]; expected: unknown }[];
  hints: string[];
};

export type DiagnosticItem = {
  id: string;
  skill: SkillId;
  type: "concept" | "code_read" | "debug" | "explain" | "practical";
  concept: string;
  difficulty: 1 | 2 | 3;
  prompt: string;
  code?: string;
  choices?: {
    id: string;
    text: string;
    correct?: boolean;
    misconception?: { id: string; label: string };
  }[];
  /** Rubric keywords used by the deterministic fallback for explanations. */
  keywords?: string[];
  practical?: PracticalSpec;
  /** Set when this item is an equivalent variant of another item. */
  variantOf?: string;
};

export type GoalTrack = {
  id: string;
  label: string;
  description: string;
  skills: SkillId[];
};

export const GOAL_TRACKS: GoalTrack[] = [
  {
    id: "fullstack",
    label: "Full-Stack Developer",
    description:
      "Build complete web applications: interface, logic, backend and data.",
    skills: [
      "html",
      "css",
      "javascript",
      "react",
      "backend",
      "databases",
      "apis",
    ],
  },
  {
    id: "frontend",
    label: "Frontend Developer",
    description: "Build the part of a website people see and interact with.",
    skills: ["html", "css", "javascript", "react"],
  },
];

export const DIAGNOSTIC_ITEMS: DiagnosticItem[] = [
  // ── HTML ────────────────────────────────────────────────────────────────
  {
    id: "html-semantic",
    skill: "html",
    type: "concept",
    concept: "semantic_elements",
    difficulty: 1,
    prompt:
      "You are building a page with a header, navigation menu, main article and footer. Which approach is best practice?",
    choices: [
      {
        id: "a",
        text: "Use <div> for everything and name classes like .header and .footer",
        misconception: {
          id: "div_soup",
          label: "Unaware of semantic HTML elements",
        },
      },
      {
        id: "b",
        text: "Use <header>, <nav>, <main>/<article> and <footer>",
        correct: true,
      },
      {
        id: "c",
        text: "Use <table> rows to lay out the header, article and footer",
        misconception: {
          id: "table_layout",
          label: "Uses tables for page layout",
        },
      },
      {
        id: "d",
        text: "Semantics do not matter because CSS controls appearance",
        misconception: {
          id: "semantics_irrelevant",
          label: "Believes HTML semantics have no effect",
        },
      },
    ],
  },
  {
    id: "html-form-read",
    skill: "html",
    type: "code_read",
    concept: "forms_and_labels",
    difficulty: 2,
    prompt:
      'What happens when the user clicks the words "Email address" on the page?',
    code: `<label for="email">Email address</label>\n<input type="email" id="email" name="email" required>`,
    choices: [
      {
        id: "a",
        text: "Nothing - labels are only visual text",
        misconception: {
          id: "label_decorative",
          label: "Thinks <label> is purely decorative",
        },
      },
      {
        id: "b",
        text: "Focus moves into the email input, because the label's for attribute matches the input's id",
        correct: true,
      },
      {
        id: "c",
        text: "The form submits immediately",
        misconception: {
          id: "label_submits",
          label: "Believes clicking a label submits the form",
        },
      },
      {
        id: "d",
        text: "The browser shows a validation error",
        misconception: {
          id: "label_validates",
          label: "Confuses label association with validation",
        },
      },
    ],
  },
  {
    id: "html-semantic-v2",
    variantOf: "html-semantic",
    skill: "html",
    type: "concept",
    concept: "semantic_elements",
    difficulty: 1,
    prompt:
      "Which element should wrap the standalone main story of a news page?",
    choices: [
      { id: "a", text: "<article>", correct: true },
      {
        id: "b",
        text: '<div class="story">',
        misconception: {
          id: "div_soup",
          label: "Unaware of semantic HTML elements",
        },
      },
      {
        id: "c",
        text: "<span>",
        misconception: {
          id: "semantics_irrelevant",
          label: "Believes HTML semantics have no effect",
        },
      },
      {
        id: "d",
        text: "<table>",
        misconception: {
          id: "table_layout",
          label: "Uses tables for page layout",
        },
      },
    ],
  },

  // ── CSS ─────────────────────────────────────────────────────────────────
  {
    id: "css-specificity",
    skill: "css",
    type: "concept",
    concept: "specificity",
    difficulty: 2,
    prompt:
      "An element matches both `#title { color: red; }` and `.heading { color: blue; }`. Which colour wins and why?",
    choices: [
      {
        id: "a",
        text: "Blue, because classes always beat ids",
        misconception: {
          id: "specificity_inverted",
          label: "Believes classes outrank ids in specificity",
        },
      },
      {
        id: "b",
        text: "Red, because an id selector is more specific than a class selector",
        correct: true,
      },
      {
        id: "c",
        text: "Whichever rule appears last in the file always wins",
        misconception: {
          id: "order_only",
          label: "Thinks source order is the only cascade rule",
        },
      },
      {
        id: "d",
        text: "The browser picks one at random",
        misconception: {
          id: "cascade_random",
          label: "No model of the CSS cascade",
        },
      },
    ],
  },
  {
    id: "css-flex-debug",
    skill: "css",
    type: "debug",
    concept: "flexbox_alignment",
    difficulty: 2,
    prompt:
      "The box should be centered inside the grey area, but it sits in the top-left corner. Which change fixes it?",
    code: `.container {\n  display: flex;\n  height: 300px;\n}\n.box {\n  width: 100px;\n  height: 100px;\n}`,
    choices: [
      {
        id: "a",
        text: "Add justify-content: center and align-items: center to .container",
        correct: true,
      },
      {
        id: "b",
        text: "Add text-align: center to .box",
        misconception: {
          id: "textalign_centering",
          label: "Uses text-align to center block boxes",
        },
      },
      {
        id: "c",
        text: "Change display: flex to display: block on .container",
        misconception: {
          id: "flex_purpose",
          label: "Unclear what display:flex does",
        },
      },
      {
        id: "d",
        text: "Add float: center to .box",
        misconception: {
          id: "float_center",
          label: "Believes float:center exists",
        },
      },
    ],
  },
  {
    id: "css-specificity-v2",
    variantOf: "css-specificity",
    skill: "css",
    type: "concept",
    concept: "specificity",
    difficulty: 2,
    prompt:
      "These rules both target a paragraph: `p.intro { color: green; }` and `p { color: black; }`. What colour is the paragraph?",
    choices: [
      {
        id: "a",
        text: "Black - the simpler selector is faster",
        misconception: {
          id: "specificity_inverted",
          label: "Believes simpler selectors win",
        },
      },
      {
        id: "b",
        text: "Green - a class-qualified selector is more specific than a bare element selector",
        correct: true,
      },
      {
        id: "c",
        text: "The rules cancel out and the paragraph keeps the browser default",
        misconception: {
          id: "cascade_random",
          label: "No model of the CSS cascade",
        },
      },
      {
        id: "d",
        text: "Whichever the browser feels like",
        misconception: {
          id: "cascade_random",
          label: "No model of the CSS cascade",
        },
      },
    ],
  },

  // ── JavaScript ──────────────────────────────────────────────────────────
  {
    id: "js-array-read",
    skill: "javascript",
    type: "code_read",
    concept: "array_iteration",
    difficulty: 2,
    prompt: "What does this code print?",
    code: `const nums = [1, 2, 3, 4];\nlet total = 0;\nfor (let i = 0; i < nums.length; i++) {\n  if (nums[i] % 2 === 0) total += nums[i];\n}\nconsole.log(total);`,
    choices: [
      {
        id: "a",
        text: "10",
        misconception: {
          id: "filter_blind",
          label: "Misses the conditional inside the loop",
        },
      },
      { id: "b", text: "6", correct: true },
      {
        id: "c",
        text: "4",
        misconception: {
          id: "count_not_sum",
          label: "Counts matching items instead of summing them",
        },
      },
      {
        id: "d",
        text: "It throws an error",
        misconception: {
          id: "loop_bounds_error",
          label: "Believes i < length indexing is out of bounds",
        },
      },
    ],
  },
  {
    id: "js-loop-debug",
    skill: "javascript",
    type: "debug",
    concept: "loop_boundaries",
    difficulty: 2,
    prompt:
      "This should print every name once, but the last name comes out as undefined. Which fix is correct?",
    code: `const names = ["Asha", "Ravi", "Meera"];\nfor (let i = 0; i <= names.length; i++) {\n  console.log(names[i]);\n}`,
    choices: [
      {
        id: "a",
        text: "Change i <= names.length to i < names.length",
        correct: true,
      },
      {
        id: "b",
        text: "Start the loop at let i = 1",
        misconception: {
          id: "one_based_index",
          label: "Thinks arrays start at index 1",
        },
      },
      {
        id: "c",
        text: "Replace console.log with return",
        misconception: {
          id: "return_in_loop",
          label: "Confuses return with printing",
        },
      },
      {
        id: "d",
        text: "Add names.length + 1 as the condition",
        misconception: {
          id: "loop_bounds_error",
          label: "Off-by-one in loop boundary",
        },
      },
    ],
  },
  {
    id: "js-explain-const",
    skill: "javascript",
    type: "explain",
    concept: "variables_and_scope",
    difficulty: 2,
    prompt:
      "In your own words, explain the difference between let and const, and give one situation where const still lets you change something.",
    keywords: [
      "const",
      "let",
      "reassign",
      "cannot",
      "object",
      "array",
      "mutate",
      "reference",
      "block",
      "scope",
    ],
  },
  {
    id: "js-practical-cart",
    skill: "javascript",
    type: "practical",
    concept: "array_iteration",
    difficulty: 2,
    prompt:
      "Implement totalPrice(items). items is an array like [{ price: 10, qty: 2 }]. Return the total cost (price x qty for each line, added together). Return 0 for an empty cart.",
    practical: {
      instructions:
        "Write the function totalPrice(items) below. It is run against real tests when you submit.",
      starterCode: `function totalPrice(items) {\n  // your code here\n}\n`,
      functionName: "totalPrice",
      tests: [
        {
          args: [
            [
              [
                { price: 10, qty: 2 },
                { price: 5, qty: 1 },
              ],
            ],
          ],
          expected: 25,
        },
        { args: [[[]]], expected: 0 },
        { args: [[[{ price: 3.5, qty: 2 }]]], expected: 7 },
        {
          args: [
            [
              [
                { price: 0, qty: 5 },
                { price: 2, qty: 3 },
              ],
            ],
          ],
          expected: 6,
        },
      ],
      hints: [
        "A loop that adds price * qty to a running total is enough.",
        "Initialise the total to 0 before the loop so an empty cart returns 0.",
        "for (const item of items) { total += item.price * item.qty; }",
      ],
    },
  },
  {
    id: "js-array-read-v2",
    variantOf: "js-array-read",
    skill: "javascript",
    type: "code_read",
    concept: "array_iteration",
    difficulty: 2,
    prompt: "What does this code print?",
    code: `const words = ["red", "blue", "green"];\nlet long = 0;\nfor (const w of words) {\n  if (w.length > 3) long++;\n}\nconsole.log(long);`,
    choices: [
      {
        id: "a",
        text: "3",
        misconception: {
          id: "filter_blind",
          label: "Misses the conditional inside the loop",
        },
      },
      { id: "b", text: "2", correct: true },
      {
        id: "c",
        text: "bluegreen",
        misconception: {
          id: "count_vs_collect",
          label: "Confuses counting with concatenation",
        },
      },
      {
        id: "d",
        text: "undefined",
        misconception: {
          id: "forof_unknown",
          label: "Unfamiliar with for...of iteration",
        },
      },
    ],
  },

  // ── React ───────────────────────────────────────────────────────────────
  {
    id: "react-state",
    skill: "react",
    type: "concept",
    concept: "state_and_rerender",
    difficulty: 2,
    prompt:
      "A button should increment a counter on screen. Why does this not update the UI, and what fixes it?",
    code: `function Counter() {\n  let count = 0;\n  return (\n    <button onClick={() => { count = count + 1; }}>\n      Count: {count}\n    </button>\n  );\n}`,
    choices: [
      {
        id: "a",
        text: "It works fine - the variable changes",
        misconception: {
          id: "plain_var_state",
          label: "Believes plain variable changes trigger re-render",
        },
      },
      {
        id: "b",
        text: "Use useState: const [count, setCount] = useState(0) and call setCount(count + 1)",
        correct: true,
      },
      {
        id: "c",
        text: "Add window.refresh() after changing count",
        misconception: {
          id: "manual_refresh",
          label: "Thinks the page must be manually refreshed",
        },
      },
      {
        id: "d",
        text: "Wrap count in quotes so JSX re-reads it",
        misconception: {
          id: "jsx_strings",
          label: "Misunderstands how JSX reads values",
        },
      },
    ],
  },
  {
    id: "react-list-read",
    skill: "react",
    type: "code_read",
    concept: "lists_and_keys",
    difficulty: 2,
    prompt: "What does React warn about here, and why does it matter?",
    code: `function List({ items }) {\n  return (\n    <ul>\n      {items.map((item) => <li>{item.name}</li>)}\n    </ul>\n  );\n}`,
    choices: [
      {
        id: "a",
        text: "Nothing - this is correct React",
        misconception: {
          id: "keys_unneeded",
          label: "Unaware of the key prop requirement",
        },
      },
      {
        id: "b",
        text: "Each <li> needs a unique key prop so React can track items across re-renders",
        correct: true,
      },
      {
        id: "c",
        text: "map cannot be used inside JSX",
        misconception: {
          id: "map_in_jsx",
          label: "Believes .map is not allowed in JSX",
        },
      },
      {
        id: "d",
        text: "<ul> cannot contain <li> components",
        misconception: {
          id: "html_nesting",
          label: "Confused about list element nesting",
        },
      },
    ],
  },
  {
    id: "react-state-v2",
    variantOf: "react-state",
    skill: "react",
    type: "concept",
    concept: "state_and_rerender",
    difficulty: 2,
    prompt:
      "In React, what is the correct way to show updated data on screen after a user action?",
    choices: [
      {
        id: "a",
        text: "Change a normal variable and React notices automatically",
        misconception: {
          id: "plain_var_state",
          label: "Believes plain variable changes trigger re-render",
        },
      },
      {
        id: "b",
        text: "Update state with its setter function so React re-renders the component",
        correct: true,
      },
      {
        id: "c",
        text: "Edit the DOM directly with document.getElementById",
        misconception: {
          id: "direct_dom",
          label: "Bypasses React with direct DOM edits",
        },
      },
      {
        id: "d",
        text: "Reload the whole page",
        misconception: {
          id: "manual_refresh",
          label: "Thinks the page must be manually refreshed",
        },
      },
    ],
  },

  // ── Backend ─────────────────────────────────────────────────────────────
  {
    id: "backend-http",
    skill: "backend",
    type: "concept",
    concept: "http_methods",
    difficulty: 1,
    prompt:
      "Your API needs an endpoint that creates a new order. Which HTTP method is the right choice?",
    choices: [
      {
        id: "a",
        text: "GET",
        misconception: {
          id: "get_creates",
          label: "Uses GET for state-changing operations",
        },
      },
      { id: "b", text: "POST", correct: true },
      {
        id: "c",
        text: "DELETE",
        misconception: {
          id: "method_confusion",
          label: "Confuses HTTP method semantics",
        },
      },
      {
        id: "d",
        text: "It makes no difference",
        misconception: {
          id: "methods_irrelevant",
          label: "Believes HTTP methods are interchangeable",
        },
      },
    ],
  },
  {
    id: "backend-explain",
    skill: "backend",
    type: "explain",
    concept: "request_lifecycle",
    difficulty: 3,
    prompt:
      "A user clicks Save on a form. Describe, step by step, what happens between the browser and the database. Mention at least the request, the server and the response.",
    keywords: [
      "request",
      "server",
      "route",
      "handler",
      "validate",
      "database",
      "query",
      "response",
      "status",
      "json",
    ],
  },
  {
    id: "backend-http-v2",
    variantOf: "backend-http",
    skill: "backend",
    type: "concept",
    concept: "http_methods",
    difficulty: 1,
    prompt:
      "Which HTTP method should an endpoint use to fetch a user's profile without changing anything?",
    choices: [
      { id: "a", text: "GET", correct: true },
      {
        id: "b",
        text: "POST",
        misconception: {
          id: "method_confusion",
          label: "Confuses HTTP method semantics",
        },
      },
      {
        id: "c",
        text: "DELETE",
        misconception: {
          id: "method_confusion",
          label: "Confuses HTTP method semantics",
        },
      },
      {
        id: "d",
        text: "Any method, they are identical",
        misconception: {
          id: "methods_irrelevant",
          label: "Believes HTTP methods are interchangeable",
        },
      },
    ],
  },

  // ── Databases ───────────────────────────────────────────────────────────
  {
    id: "db-select",
    skill: "databases",
    type: "concept",
    concept: "sql_basics",
    difficulty: 1,
    prompt: "Which SQL returns only the products that cost more than 500?",
    choices: [
      {
        id: "a",
        text: "SELECT * FROM products WHERE price > 500;",
        correct: true,
      },
      {
        id: "b",
        text: "SELECT * FROM products;",
        misconception: {
          id: "where_missing",
          label: "Does not filter rows with WHERE",
        },
      },
      {
        id: "c",
        text: "DELETE FROM products WHERE price > 500;",
        misconception: {
          id: "delete_vs_select",
          label: "Confuses DELETE with SELECT",
        },
      },
      {
        id: "d",
        text: "GET products price > 500;",
        misconception: {
          id: "sql_http_mix",
          label: "Mixes HTTP verbs into SQL",
        },
      },
    ],
  },
  {
    id: "db-debug",
    skill: "databases",
    type: "debug",
    concept: "joins_and_keys",
    difficulty: 3,
    prompt:
      "Every order should belong to a customer, but some orders save fine with a customer_id that matches no customer. What prevents this?",
    code: `CREATE TABLE orders (\n  id SERIAL PRIMARY KEY,\n  customer_id INT,\n  total INT\n);`,
    choices: [
      {
        id: "a",
        text: "Make customer_id a FOREIGN KEY REFERENCES customers(id)",
        correct: true,
      },
      {
        id: "b",
        text: "Rename customer_id to cust_id",
        misconception: {
          id: "naming_enforces",
          label: "Believes naming enforces relationships",
        },
      },
      {
        id: "c",
        text: "Add more rows to the customers table",
        misconception: {
          id: "fk_purpose",
          label: "Unaware of foreign key constraints",
        },
      },
      {
        id: "d",
        text: "Nothing - databases check this automatically",
        misconception: {
          id: "fk_automatic",
          label: "Believes relationships are enforced automatically",
        },
      },
    ],
  },
  {
    id: "db-select-v2",
    variantOf: "db-select",
    skill: "databases",
    type: "concept",
    concept: "sql_basics",
    difficulty: 1,
    prompt: "Which SQL finds the user whose email is asha@example.com?",
    choices: [
      {
        id: "a",
        text: "SELECT * FROM users WHERE email = 'asha@example.com';",
        correct: true,
      },
      {
        id: "b",
        text: "SELECT * FROM users;",
        misconception: {
          id: "where_missing",
          label: "Does not filter rows with WHERE",
        },
      },
      {
        id: "c",
        text: "UPDATE users SET email = 'asha@example.com';",
        misconception: {
          id: "update_vs_select",
          label: "Confuses UPDATE with SELECT",
        },
      },
      {
        id: "d",
        text: "FIND users WITH email 'asha@example.com';",
        misconception: {
          id: "sql_syntax_invented",
          label: "Invents SQL syntax",
        },
      },
    ],
  },

  // ── APIs ────────────────────────────────────────────────────────────────
  {
    id: "api-fetch-read",
    skill: "apis",
    type: "code_read",
    concept: "fetch_and_json",
    difficulty: 2,
    prompt: "What does data contain after this runs successfully?",
    code: `const res = await fetch("/api/products");\nconst data = await res.json();`,
    choices: [
      {
        id: "a",
        text: "The raw HTTP response object including headers",
        misconception: {
          id: "res_vs_json",
          label: "Confuses the Response object with parsed JSON",
        },
      },
      {
        id: "b",
        text: "The response body parsed from JSON into a JavaScript value",
        correct: true,
      },
      {
        id: "c",
        text: "A string of HTML",
        misconception: { id: "json_vs_html", label: "Confuses JSON with HTML" },
      },
      {
        id: "d",
        text: "Nothing - fetch returns void",
        misconception: {
          id: "fetch_void",
          label: "Believes fetch returns nothing",
        },
      },
    ],
  },
  {
    id: "api-status",
    skill: "apis",
    type: "concept",
    concept: "status_codes",
    difficulty: 2,
    prompt:
      "Your app calls an API and gets status 404. What is the API telling you?",
    choices: [
      {
        id: "a",
        text: "The server crashed",
        misconception: {
          id: "404_vs_500",
          label: "Confuses 404 with server errors",
        },
      },
      {
        id: "b",
        text: "The requested resource was not found at that URL",
        correct: true,
      },
      {
        id: "c",
        text: "The request succeeded",
        misconception: {
          id: "status_ignored",
          label: "Does not check HTTP status codes",
        },
      },
      {
        id: "d",
        text: "The API key is invalid",
        misconception: {
          id: "404_vs_401",
          label: "Confuses 404 with authentication errors",
        },
      },
    ],
  },
  {
    id: "api-status-v2",
    variantOf: "api-status",
    skill: "apis",
    type: "concept",
    concept: "status_codes",
    difficulty: 2,
    prompt: "An API call returns status 500. What does that mean?",
    choices: [
      {
        id: "a",
        text: "The URL was wrong",
        misconception: {
          id: "500_vs_404",
          label: "Confuses 500 with not-found errors",
        },
      },
      { id: "b", text: "Something failed on the server side", correct: true },
      {
        id: "c",
        text: "The user is logged out",
        misconception: {
          id: "404_vs_401",
          label: "Confuses server errors with authentication",
        },
      },
      {
        id: "d",
        text: "Success",
        misconception: {
          id: "status_ignored",
          label: "Does not check HTTP status codes",
        },
      },
    ],
  },
];

export function itemsForTrack(trackId: string): DiagnosticItem[] {
  const track = GOAL_TRACKS.find((t) => t.id === trackId) ?? GOAL_TRACKS[0]!;
  return DIAGNOSTIC_ITEMS.filter(
    (item) => track.skills.includes(item.skill) && !item.variantOf,
  );
}

export function variantFor(itemId: string): DiagnosticItem | undefined {
  return DIAGNOSTIC_ITEMS.find((item) => item.variantOf === itemId);
}

export function variantsForSkill(
  skill: SkillId,
  concept?: string,
): DiagnosticItem[] {
  return DIAGNOSTIC_ITEMS.filter(
    (item) =>
      item.skill === skill &&
      item.variantOf &&
      (!concept || item.concept === concept),
  );
}

/** Original items used to seed a reassessment for a skill/concept. */
export function originalsForSkill(
  skill: SkillId,
  concept?: string,
): DiagnosticItem[] {
  return DIAGNOSTIC_ITEMS.filter(
    (item) =>
      item.skill === skill &&
      !item.variantOf &&
      (!concept || item.concept === concept),
  );
}
