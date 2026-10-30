/**
 * Project catalog and the rule-based recommendation engine (kernel step 4).
 * Recommendations compare the student's competency profile against each
 * project's required and taught skills, and always explain why a project fits.
 */
import type { Af05State, SkillId } from "./types";
import { SKILL_LABELS } from "./types";
import type { PracticalSpec } from "./diagnostic";

export type ProjectTask = {
  id: string;
  title: string;
  detail: string;
  skills: SkillId[];
  /**
   * practical: executable task with deterministic tests (real evidence).
   * step: guided build step - the student records what they built; it counts
   * toward project progress but never toward competency by itself.
   */
  kind: "practical" | "step";
  practical?: PracticalSpec;
};

export type ProjectMilestone = {
  id: string;
  title: string;
  summary: string;
  taskIds: string[];
};

export type Project = {
  id: string;
  name: string;
  category: "web" | "data-ai" | "mobile" | "cyber" | "tools";
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  tagline: string;
  overview: string;
  whyItMatters: string;
  skillsPractised: SkillId[];
  requiredSkills: SkillId[];
  tools: string[];
  prerequisites: string[];
  estimatedHours: number;
  milestones: ProjectMilestone[];
  tasks: ProjectTask[];
};

export const PROJECT_CATEGORIES = [
  { id: "all", label: "All Projects" },
  { id: "web", label: "Web Development" },
  { id: "data-ai", label: "Data & AI" },
  { id: "mobile", label: "Mobile Apps" },
  { id: "cyber", label: "Cybersecurity" },
  { id: "tools", label: "Tools & Automation" },
] as const;

export const PROJECTS: Project[] = [
  {
    id: "task-manager",
    name: "Task Management App",
    category: "web",
    difficulty: "Beginner",
    tagline: "Add, tick off and filter your daily tasks.",
    overview:
      "Build a to-do app where users add tasks, mark them done and filter between active and completed work.",
    whyItMatters:
      "Almost every real app manages a list of things. This project teaches arrays, state and UI updates without backend complexity.",
    skillsPractised: ["html", "css", "javascript", "react"],
    requiredSkills: ["html", "css"],
    tools: ["Browser", "Code editor"],
    prerequisites: ["Basic HTML tags", "Simple CSS styling"],
    estimatedHours: 6,
    milestones: [
      {
        id: "m1",
        title: "Page structure",
        summary: "Build the HTML layout and style the list.",
        taskIds: ["tm-structure", "tm-add"],
      },
      {
        id: "m2",
        title: "Working list",
        summary: "Make adding and completing tasks actually work.",
        taskIds: ["tm-toggle", "tm-filter"],
      },
      {
        id: "m3",
        title: "Polish",
        summary: "Handle empty states and edge cases.",
        taskIds: ["tm-edge"],
      },
    ],
    tasks: [
      {
        id: "tm-structure",
        title: "Design the task list layout",
        detail:
          "Sketch the HTML for an input, an Add button and an empty list. Style it with CSS so it is readable on a phone.",
        skills: ["html", "css"],
        kind: "step",
      },
      {
        id: "tm-add",
        title: "Implement addTask(tasks, title)",
        detail:
          "Write a function that returns a NEW array with the task added. Do not change the original array - React-style state depends on this.",
        skills: ["javascript"],
        kind: "practical",
        practical: {
          instructions:
            "addTask(tasks, title) returns a new array with { id, title, done: false } appended. id = highest existing id + 1 (1 for an empty list). The input array must not be modified.",
          starterCode: `function addTask(tasks, title) {\n  // your code here\n}\n`,
          functionName: "addTask",
          tests: [
            {
              args: [[[], "Buy milk"]],
              expected: [{ id: 1, title: "Buy milk", done: false }],
            },
            {
              args: [[[{ id: 1, title: "A", done: false }], "B"]],
              expected: [
                { id: 1, title: "A", done: false },
                { id: 2, title: "B", done: false },
              ],
            },
          ],
          hints: [
            "Slice or spread the old array first, then push the new task.",
            "Find the max id with tasks.reduce or a loop, then add 1.",
            "const next = [...tasks, { id: newId, title, done: false }]; return next;",
          ],
        },
      },
      {
        id: "tm-toggle",
        title: "Implement toggleTask(tasks, id)",
        detail:
          "Flip the done flag of one task, again without modifying the original array.",
        skills: ["javascript"],
        kind: "practical",
        practical: {
          instructions:
            "toggleTask(tasks, id) returns a new array where only the task with that id has done flipped.",
          starterCode: `function toggleTask(tasks, id) {\n  // your code here\n}\n`,
          functionName: "toggleTask",
          tests: [
            {
              args: [
                [
                  [
                    { id: 1, title: "A", done: false },
                    { id: 2, title: "B", done: true },
                  ],
                  1,
                ],
              ],
              expected: [
                { id: 1, title: "A", done: true },
                { id: 2, title: "B", done: true },
              ],
            },
            {
              args: [[[{ id: 3, title: "C", done: true }], 3]],
              expected: [{ id: 3, title: "C", done: false }],
            },
          ],
          hints: [
            "tasks.map creates a new array.",
            "Inside map, return a new object only for the matching id.",
            "return tasks.map(t => t.id === id ? { ...t, done: !t.done } : t);",
          ],
        },
      },
      {
        id: "tm-filter",
        title: "Implement filterTasks(tasks, view)",
        detail:
          'view is "all", "active" or "completed". Return the matching tasks.',
        skills: ["javascript"],
        kind: "practical",
        practical: {
          instructions:
            'filterTasks(tasks, view) returns: everything for "all", only done:false for "active", only done:true for "completed".',
          starterCode: `function filterTasks(tasks, view) {\n  // your code here\n}\n`,
          functionName: "filterTasks",
          tests: [
            {
              args: [
                [
                  [
                    { id: 1, title: "A", done: false },
                    { id: 2, title: "B", done: true },
                  ],
                  "active",
                ],
              ],
              expected: [{ id: 1, title: "A", done: false }],
            },
            {
              args: [
                [
                  [
                    { id: 1, title: "A", done: false },
                    { id: 2, title: "B", done: true },
                  ],
                  "completed",
                ],
              ],
              expected: [{ id: 2, title: "B", done: true }],
            },
            {
              args: [[[{ id: 1, title: "A", done: false }], "all"]],
              expected: [{ id: 1, title: "A", done: false }],
            },
          ],
          hints: [
            "Array.filter keeps items where your condition is true.",
            'The "all" case can just return tasks.',
            "if (view === 'active') return tasks.filter(t => !t.done);",
          ],
        },
      },
      {
        id: "tm-edge",
        title: "Handle the empty list",
        detail:
          "Decide what the app shows when there are no tasks, and write a sentence about why empty states matter.",
        skills: ["javascript", "css"],
        kind: "step",
      },
    ],
  },
  {
    id: "weather-app",
    name: "Weather Forecast App",
    category: "web",
    difficulty: "Beginner",
    tagline: "Show the weather for any city from a live API.",
    overview:
      "Connect a search box to a weather API and display the current conditions and forecast for the chosen city.",
    whyItMatters:
      "Most real products talk to an API. This project teaches fetch, JSON, loading states and error handling in a friendly setting.",
    skillsPractised: ["javascript", "apis", "html", "css"],
    requiredSkills: ["html", "javascript"],
    tools: ["Browser", "Code editor", "Free weather API"],
    prerequisites: ["Functions in JavaScript", "Basic HTML forms"],
    estimatedHours: 8,
    milestones: [
      {
        id: "m1",
        title: "Static layout",
        summary: "Build the search and results layout with sample data.",
        taskIds: ["wa-layout"],
      },
      {
        id: "m2",
        title: "Data layer",
        summary: "Format and guard the data the UI will show.",
        taskIds: ["wa-format", "wa-guard"],
      },
      {
        id: "m3",
        title: "Live API",
        summary: "Connect a real weather API with loading and error states.",
        taskIds: ["wa-live"],
      },
    ],
    tasks: [
      {
        id: "wa-layout",
        title: "Build the search screen",
        detail:
          "Create the city search box and a card that will show temperature, conditions and wind.",
        skills: ["html", "css"],
        kind: "step",
      },
      {
        id: "wa-format",
        title: "Implement formatTemp(celsius)",
        detail:
          "Format temperatures for display: round to a whole number and add the degree sign.",
        skills: ["javascript"],
        kind: "practical",
        practical: {
          instructions:
            'formatTemp(celsius) returns a string like "24°C". Round to the nearest whole number.',
          starterCode: `function formatTemp(celsius) {\n  // your code here\n}\n`,
          functionName: "formatTemp",
          tests: [
            { args: [23.6], expected: "24°C" },
            { args: [0], expected: "0°C" },
            { args: [-4.4], expected: "-4°C" },
          ],
          hints: [
            "Math.round handles the rounding.",
            "Template strings: `${n}°C`",
            'return Math.round(celsius) + "°C";',
          ],
        },
      },
      {
        id: "wa-guard",
        title: "Implement safeWind(wind)",
        detail:
          "APIs sometimes omit fields. Return the wind speed or a fallback.",
        skills: ["javascript", "apis"],
        kind: "practical",
        practical: {
          instructions:
            "safeWind(weather) returns weather.wind_kph if it is a number, otherwise 0.",
          starterCode: `function safeWind(weather) {\n  // your code here\n}\n`,
          functionName: "safeWind",
          tests: [
            { args: [{ wind_kph: 12 }], expected: 12 },
            { args: [{}], expected: 0 },
            { args: [{ wind_kph: "fast" }], expected: 0 },
          ],
          hints: [
            'typeof value === "number" checks the type.',
            "Use an if or a ternary.",
            'return typeof weather.wind_kph === "number" ? weather.wind_kph : 0;',
          ],
        },
      },
      {
        id: "wa-live",
        title: "Connect the live API",
        detail:
          "Wire the search box to fetch real weather, show a loading state, and a friendly message when the city is not found (status 404).",
        skills: ["apis", "javascript"],
        kind: "step",
      },
    ],
  },
  {
    id: "blog-platform",
    name: "Blog Platform",
    category: "web",
    difficulty: "Intermediate",
    tagline: "Write, save and read posts - with a real backend.",
    overview:
      "Build a small blog: a list of posts, a page per post, and a form to write new ones, saved in a database.",
    whyItMatters:
      "This is the classic full-stack shape: UI, API and database working together. Mastering it unlocks most CRUD products.",
    skillsPractised: ["react", "backend", "databases", "apis"],
    requiredSkills: ["javascript", "react"],
    tools: ["Browser", "Code editor", "Supabase (free tier)"],
    prerequisites: [
      "Components and state in React",
      "Array methods in JavaScript",
    ],
    estimatedHours: 14,
    milestones: [
      {
        id: "m1",
        title: "Post data model",
        summary: "Design the posts table and seed it.",
        taskIds: ["bp-model"],
      },
      {
        id: "m2",
        title: "Reading posts",
        summary: "List posts and open one post.",
        taskIds: ["bp-list", "bp-slug"],
      },
      {
        id: "m3",
        title: "Writing posts",
        summary: "Create the new-post form and save through the API.",
        taskIds: ["bp-create"],
      },
    ],
    tasks: [
      {
        id: "bp-model",
        title: "Design the posts table",
        detail:
          "Decide columns (id, title, body, created_at) and write a sentence defending each choice.",
        skills: ["databases"],
        kind: "step",
      },
      {
        id: "bp-list",
        title: "Implement summarisePosts(posts)",
        detail:
          "Prepare the list page data: newest first, with a short preview of each body.",
        skills: ["javascript"],
        kind: "practical",
        practical: {
          instructions:
            'summarisePosts(posts) returns a new array, sorted by created_at descending, each item { id, title, preview } where preview is the first 20 characters of body plus "...".',
          starterCode: `function summarisePosts(posts) {\n  // your code here\n}\n`,
          functionName: "summarisePosts",
          tests: [
            {
              args: [
                [
                  {
                    id: 1,
                    title: "Old",
                    body: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                    created_at: "2026-01-01",
                  },
                  {
                    id: 2,
                    title: "New",
                    body: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                    created_at: "2026-02-01",
                  },
                ],
              ],
              expected: [
                { id: 2, title: "New", preview: "bbbbbbbbbbbbbbbbbbbb..." },
                { id: 1, title: "Old", preview: "aaaaaaaaaaaaaaaaaaaa..." },
              ],
            },
          ],
          hints: [
            "Sort a copy: [...posts].sort((a, b) => ...)",
            "String dates compare correctly with < and >.",
            'preview: post.body.slice(0, 20) + "..."',
          ],
        },
      },
      {
        id: "bp-slug",
        title: "Implement findPost(posts, id)",
        detail:
          "Return the matching post or null - never undefined leaking into the UI.",
        skills: ["javascript"],
        kind: "practical",
        practical: {
          instructions:
            "findPost(posts, id) returns the post with that id, or null when absent.",
          starterCode: `function findPost(posts, id) {\n  // your code here\n}\n`,
          functionName: "findPost",
          tests: [
            {
              args: [
                [
                  { id: 1, title: "A" },
                  { id: 2, title: "B" },
                ],
                2,
              ],
              expected: { id: 2, title: "B" },
            },
            { args: [[{ id: 1, title: "A" }], 9], expected: null },
          ],
          hints: [
            "Array.find returns undefined when nothing matches.",
            "Convert that to null with ?? or an if.",
            "return posts.find(p => p.id === id) ?? null;",
          ],
        },
      },
      {
        id: "bp-create",
        title: "Build the new-post flow",
        detail:
          "Form -> POST to your API -> insert into the database -> show the new post. Note which HTTP method you used and why.",
        skills: ["backend", "apis", "databases"],
        kind: "step",
      },
    ],
  },
  {
    id: "ai-notes",
    name: "AI Notes Generator",
    category: "data-ai",
    difficulty: "Intermediate",
    tagline: "Paste lecture text, get clean structured notes.",
    overview:
      "Build a tool that turns messy pasted text into structured notes with headings and bullet points using an AI model.",
    whyItMatters:
      "AI features fail in predictable ways. This project teaches prompt design, input limits and honest loading and error states.",
    skillsPractised: ["javascript", "apis", "react"],
    requiredSkills: ["javascript", "apis"],
    tools: ["Browser", "Code editor", "AI API access"],
    prerequisites: ["fetch and JSON", "Basic React state"],
    estimatedHours: 10,
    milestones: [
      {
        id: "m1",
        title: "Input and limits",
        summary: "Textarea, character budget and validation.",
        taskIds: ["an-input"],
      },
      {
        id: "m2",
        title: "Note shaping",
        summary: "Turn raw AI output into clean note sections.",
        taskIds: ["an-shape"],
      },
      {
        id: "m3",
        title: "AI call",
        summary: "Call the model with a clear prompt and honest errors.",
        taskIds: ["an-call"],
      },
    ],
    tasks: [
      {
        id: "an-input",
        title: "Build the input screen",
        detail:
          "Textarea with a character counter and a disabled Generate button when empty or over the limit.",
        skills: ["react"],
        kind: "step",
      },
      {
        id: "an-shape",
        title: "Implement splitSections(text)",
        detail:
          'Split AI output on lines starting with "## " into titled sections.',
        skills: ["javascript"],
        kind: "practical",
        practical: {
          instructions:
            'splitSections(text) returns an array of { title, body } for each line starting with "## ". body is the following lines until the next heading, trimmed.',
          starterCode: `function splitSections(text) {\n  // your code here\n}\n`,
          functionName: "splitSections",
          tests: [
            {
              args: ["## Summary\nPoint one\nPoint two\n## Details\nMore here"],
              expected: [
                { title: "Summary", body: "Point one\nPoint two" },
                { title: "Details", body: "More here" },
              ],
            },
            { args: ["No headings here"], expected: [] },
          ],
          hints: [
            "Split on newlines and walk the lines.",
            'A line starting with "## " starts a new section.',
            "Collect body lines in an array and join with \\n.",
          ],
        },
      },
      {
        id: "an-call",
        title: "Wire the AI call",
        detail:
          "Send the text to the AI endpoint, show progress, and handle a failed call with a retry that does not lose the student's text.",
        skills: ["apis", "javascript"],
        kind: "step",
      },
    ],
  },
  {
    id: "ai-chat",
    name: "AI Chat Application",
    category: "data-ai",
    difficulty: "Intermediate",
    tagline: "A chat window that remembers the conversation.",
    overview:
      "Build a chat UI that sends the conversation history to an AI and streams back answers, with clear separation between user and assistant messages.",
    whyItMatters:
      "Conversation state is the heart of every AI product. This project teaches message modelling, history windows and cost awareness.",
    skillsPractised: ["react", "apis", "javascript"],
    requiredSkills: ["react", "apis"],
    tools: ["Browser", "Code editor", "AI API access"],
    prerequisites: ["React state and lists", "fetch and async/await"],
    estimatedHours: 12,
    milestones: [
      {
        id: "m1",
        title: "Message model",
        summary: "Design the message shape and render the thread.",
        taskIds: ["ac-model"],
      },
      {
        id: "m2",
        title: "History window",
        summary: "Keep only the useful part of the history.",
        taskIds: ["ac-window"],
      },
      {
        id: "m3",
        title: "Send and receive",
        summary: "Connect the AI with loading and error handling.",
        taskIds: ["ac-send"],
      },
    ],
    tasks: [
      {
        id: "ac-model",
        title: "Design the message model",
        detail:
          "Decide the fields a message needs (role, text, time) and render a two-sided chat thread.",
        skills: ["react"],
        kind: "step",
      },
      {
        id: "ac-window",
        title: "Implement trimHistory(messages, max)",
        detail:
          "Keep the newest messages so the request stays small, but always keep the first system message.",
        skills: ["javascript"],
        kind: "practical",
        practical: {
          instructions:
            "trimHistory(messages, max) keeps messages[0] (the system message) plus the newest (max - 1) messages. If messages.length <= max, return all of them.",
          starterCode: `function trimHistory(messages, max) {\n  // your code here\n}\n`,
          functionName: "trimHistory",
          tests: [
            {
              args: [
                [
                  { role: "system" },
                  { role: "user", t: 1 },
                  { role: "assistant", t: 2 },
                  { role: "user", t: 3 },
                ],
                3,
              ],
              expected: [
                { role: "system" },
                { role: "assistant", t: 2 },
                { role: "user", t: 3 },
              ],
            },
            {
              args: [[{ role: "system" }, { role: "user", t: 1 }], 5],
              expected: [{ role: "system" }, { role: "user", t: 1 }],
            },
          ],
          hints: [
            "Handle the short case first.",
            "slice(-(max - 1)) takes the newest items.",
            "return [messages[0], ...messages.slice(-(max - 1))];",
          ],
        },
      },
      {
        id: "ac-send",
        title: "Send and render replies",
        detail:
          "On send: append the user message, call the AI with the trimmed history, append the reply. Show a thinking state and keep the input safe on failure.",
        skills: ["apis", "react"],
        kind: "step",
      },
    ],
  },
  {
    id: "image-share",
    name: "Image Sharing Platform",
    category: "web",
    difficulty: "Advanced",
    tagline: "Upload, browse and like photos.",
    overview:
      "Build a small photo feed: upload images, show them in a grid and let people like their favourites.",
    whyItMatters:
      "File handling, storage and permissions are where beginner apps break. This project teaches uploads, storage rules and feed rendering.",
    skillsPractised: ["react", "backend", "databases", "apis"],
    requiredSkills: ["react", "backend", "databases"],
    tools: ["Browser", "Code editor", "Supabase storage (free tier)"],
    prerequisites: ["CRUD basics", "Async JavaScript"],
    estimatedHours: 18,
    milestones: [
      {
        id: "m1",
        title: "Feed layout",
        summary: "Responsive photo grid with placeholder data.",
        taskIds: ["is-grid"],
      },
      {
        id: "m2",
        title: "Likes",
        summary: "Toggle likes with clean state updates.",
        taskIds: ["is-like"],
      },
      {
        id: "m3",
        title: "Uploads",
        summary: "Real upload flow with progress and storage rules.",
        taskIds: ["is-upload"],
      },
    ],
    tasks: [
      {
        id: "is-grid",
        title: "Build the photo grid",
        detail:
          "Responsive grid that goes from 1 to 3 columns, with captions under each photo.",
        skills: ["css", "react"],
        kind: "step",
      },
      {
        id: "is-like",
        title: "Implement toggleLike(photos, id, userId)",
        detail:
          "Likes are a list of user ids per photo. Toggle the current user's like immutably.",
        skills: ["javascript"],
        kind: "practical",
        practical: {
          instructions:
            "Each photo: { id, likes: string[] }. toggleLike returns a new photos array where the matching photo gains or loses userId in likes. Original array unchanged.",
          starterCode: `function toggleLike(photos, id, userId) {\n  // your code here\n}\n`,
          functionName: "toggleLike",
          tests: [
            {
              args: [[{ id: 1, likes: ["u1"] }], 1, "u2"],
              expected: [{ id: 1, likes: ["u1", "u2"] }],
            },
            {
              args: [[{ id: 1, likes: ["u1", "u2"] }], 1, "u1"],
              expected: [{ id: 1, likes: ["u2"] }],
            },
          ],
          hints: [
            "Map over photos; only change the matching one.",
            "Check includes(userId) to decide add vs remove.",
            "Remove: likes.filter(u => u !== userId). Add: [...likes, userId].",
          ],
        },
      },
      {
        id: "is-upload",
        title: "Build the upload flow",
        detail:
          "File picker, size/type validation, upload with progress, then the new photo appears in the feed.",
        skills: ["backend", "apis", "react"],
        kind: "step",
      },
    ],
  },
  {
    id: "ecommerce",
    name: "Full-Stack E-commerce App",
    category: "web",
    difficulty: "Advanced",
    tagline: "Products, cart, accounts and orders end to end.",
    overview:
      "The full journey: product listing, shopping cart, user accounts, a backend API, database storage, testing and deployment.",
    whyItMatters:
      "This is the closest thing to a real job ticket. Every weak skill shows up here, which makes it the strongest possible proof of skill.",
    skillsPractised: [
      "html",
      "css",
      "javascript",
      "react",
      "backend",
      "databases",
      "apis",
    ],
    requiredSkills: ["javascript", "react", "backend", "databases", "apis"],
    tools: [
      "Browser",
      "Code editor",
      "Supabase (free tier)",
      "Vercel (free tier)",
    ],
    prerequisites: [
      "CRUD basics",
      "Authentication concepts",
      "Array and object fluency",
    ],
    estimatedHours: 30,
    milestones: [
      {
        id: "m1",
        title: "Frontend foundation",
        summary: "App shell, routing and design system.",
        taskIds: ["ec-shell"],
      },
      {
        id: "m2",
        title: "Product listing",
        summary: "Products from the database rendered as cards.",
        taskIds: ["ec-list"],
      },
      {
        id: "m3",
        title: "Shopping cart",
        summary: "Add, remove and total the cart.",
        taskIds: ["ec-cart"],
      },
      {
        id: "m4",
        title: "User authentication",
        summary: "Sign up, sign in and protect the account page.",
        taskIds: ["ec-auth"],
      },
      {
        id: "m5",
        title: "Backend API",
        summary: "Endpoints for products and orders.",
        taskIds: ["ec-api"],
      },
      {
        id: "m6",
        title: "Database integration",
        summary: "Orders persist and can be listed per user.",
        taskIds: ["ec-db"],
      },
      {
        id: "m7",
        title: "Testing and deployment",
        summary: "Happy-path tests and a live URL.",
        taskIds: ["ec-ship"],
      },
    ],
    tasks: [
      {
        id: "ec-shell",
        title: "Set up the app shell",
        detail:
          "Routes for home, products, cart and account, plus a shared layout.",
        skills: ["react"],
        kind: "step",
      },
      {
        id: "ec-list",
        title: "Render the product list",
        detail:
          "Fetch products and show name, price and an image placeholder for each.",
        skills: ["apis", "react"],
        kind: "step",
      },
      {
        id: "ec-cart",
        title: "Implement cartTotal(lines)",
        detail:
          "Cart lines: { price, qty, discountPct? }. Total with per-line discounts applied.",
        skills: ["javascript"],
        kind: "practical",
        practical: {
          instructions:
            "cartTotal(lines) sums price * qty, reduced by discountPct when present (e.g. 10 means 10% off that line). Round the final total to 2 decimals.",
          starterCode: `function cartTotal(lines) {\n  // your code here\n}\n`,
          functionName: "cartTotal",
          tests: [
            { args: [[{ price: 100, qty: 1 }]], expected: 100 },
            {
              args: [[{ price: 100, qty: 2, discountPct: 10 }]],
              expected: 180,
            },
            {
              args: [
                [
                  { price: 33.33, qty: 3 },
                  { price: 10, qty: 1, discountPct: 50 },
                ],
              ],
              expected: 104.99,
            },
          ],
          hints: [
            "Per line: price * qty * (1 - (discountPct ?? 0) / 100).",
            "Sum, then round: Math.round(total * 100) / 100.",
            "Watch floating point on the last test.",
          ],
        },
      },
      {
        id: "ec-auth",
        title: "Add authentication",
        detail:
          "Email or Google sign-in; the account page only renders for signed-in users.",
        skills: ["backend", "react"],
        kind: "step",
      },
      {
        id: "ec-api",
        title: "Build the orders API",
        detail:
          "POST creates an order from the cart; GET lists the signed-in user's orders. Document the methods you chose.",
        skills: ["backend", "apis"],
        kind: "step",
      },
      {
        id: "ec-db",
        title: "Persist orders",
        detail:
          "Orders table with a foreign key to users; verify a bad user id is rejected.",
        skills: ["databases"],
        kind: "step",
      },
      {
        id: "ec-ship",
        title: "Test and deploy",
        detail:
          "Write the three most valuable tests (add to cart, total, checkout) and deploy to a public URL.",
        skills: ["backend", "apis"],
        kind: "step",
      },
    ],
  },
  {
    id: "security-audit",
    name: "Web Security Audit Checklist Tool",
    category: "cyber",
    difficulty: "Intermediate",
    tagline: "Check a site against the most common web risks.",
    overview:
      "Build a checklist tool that walks through common web vulnerabilities (exposed keys, missing auth checks, weak validation) and records findings.",
    whyItMatters:
      "Builders who can spot the basic risks ship safer products. This project teaches the attacker mindset with structured review.",
    skillsPractised: ["javascript", "backend", "apis"],
    requiredSkills: ["javascript", "apis"],
    tools: ["Browser", "Code editor"],
    prerequisites: ["HTTP basics", "JavaScript objects"],
    estimatedHours: 8,
    milestones: [
      {
        id: "m1",
        title: "Checklist model",
        summary: "Design finding severity and status.",
        taskIds: ["sa-model"],
      },
      {
        id: "m2",
        title: "Scoring",
        summary: "Summarise findings into a clear report.",
        taskIds: ["sa-score"],
      },
    ],
    tasks: [
      {
        id: "sa-model",
        title: "Design the checklist",
        detail:
          "List 8 concrete checks (e.g. no API keys in frontend code, auth on every API route) with severity levels.",
        skills: ["backend"],
        kind: "step",
      },
      {
        id: "sa-score",
        title: "Implement summariseFindings(findings)",
        detail:
          "Aggregate findings into counts per severity plus a pass/fail verdict.",
        skills: ["javascript"],
        kind: "practical",
        practical: {
          instructions:
            'findings: [{ severity: "high" | "medium" | "low", open: boolean }]. Return { high, medium, low, verdict }. Counts include only open findings; verdict is "fail" when any high finding is open, else "pass".',
          starterCode: `function summariseFindings(findings) {\n  // your code here\n}\n`,
          functionName: "summariseFindings",
          tests: [
            {
              args: [
                [
                  { severity: "high", open: true },
                  { severity: "low", open: false },
                ],
              ],
              expected: { high: 1, medium: 0, low: 0, verdict: "fail" },
            },
            {
              args: [[{ severity: "medium", open: true }]],
              expected: { high: 0, medium: 1, low: 0, verdict: "pass" },
            },
            {
              args: [[]],
              expected: { high: 0, medium: 0, low: 0, verdict: "pass" },
            },
          ],
          hints: [
            "Start counts at 0 and loop once.",
            "Only count findings where open is true.",
            'verdict: high > 0 ? "fail" : "pass".',
          ],
        },
      },
    ],
  },
];

export type ProjectRecommendation = {
  project: Project;
  fitScore: number;
  reasons: string[];
  missingSkills: SkillId[];
};

const STATE_RANK = {
  not_assessed: 0,
  beginner: 1,
  developing: 2,
  proficient: 3,
  mastered: 4,
} as const;

/**
 * Rule-based recommendation (kernel step 4): prefer projects whose required
 * skills the student already shows, and whose practised skills cover the
 * student's weak or unassessed areas. Every recommendation explains itself.
 */
export function recommendProjects(
  state: Af05State,
  limit = 3,
): ProjectRecommendation[] {
  const rankOf = (skill: SkillId) =>
    STATE_RANK[state.competencies[skill]?.state ?? "not_assessed"];

  const ranked = PROJECTS.map((project) => {
    const reasons: string[] = [];
    const missingSkills = project.requiredSkills.filter((s) => rankOf(s) < 2);
    const taughtGaps = project.skillsPractised.filter((s) => rankOf(s) <= 1);
    const strengths = project.requiredSkills.filter((s) => rankOf(s) >= 3);

    let fitScore = 50;
    fitScore -= missingSkills.length * 18;
    fitScore += taughtGaps.length * 12;
    fitScore += strengths.length * 6;
    fitScore -= project.difficulty === "Advanced" ? 8 : 0;

    if (taughtGaps.length > 0) {
      const names = taughtGaps.map((s) => SKILL_LABELS[s]).join(" and ");
      reasons.push(
        `It directly practises ${names}, where your profile shows the biggest gaps.`,
      );
    }
    if (strengths.length > 0) {
      reasons.push(
        `You can start immediately: ${strengths.map((s) => SKILL_LABELS[s]).join(" and ")} already look solid.`,
      );
    }
    if (missingSkills.length > 0) {
      reasons.push(
        `Harder start: it expects ${missingSkills.map((s) => SKILL_LABELS[s]).join(" and ")}, which you have not shown yet.`,
      );
    }
    if (reasons.length === 0) {
      reasons.push("A balanced next build for your current profile.");
    }
    return { project, fitScore, reasons, missingSkills };
  });

  return ranked.sort((a, b) => b.fitScore - a.fitScore).slice(0, limit);
}

export function getProject(id: string): Project | undefined {
  return PROJECTS.find((p) => p.id === id);
}

export function getTask(
  project: Project,
  taskId: string,
): ProjectTask | undefined {
  return project.tasks.find((t) => t.id === taskId);
}

/** First incomplete task, honouring order: a task unlocks when the previous one is done. */
export function nextTaskId(
  project: Project,
  done: Record<string, { status: string }>,
): string | null {
  for (const task of project.tasks) {
    if (done[task.id]?.status !== "done") return task.id;
  }
  return null;
}
