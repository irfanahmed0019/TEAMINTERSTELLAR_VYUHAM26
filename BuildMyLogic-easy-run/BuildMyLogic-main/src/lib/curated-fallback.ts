/**
 * Curated, human-authored onboarding fallbacks. When the AI service is
 * unavailable (for example a provider billing outage), onboarding must not
 * dead-end on a retry banner. These fallbacks are fixed authored content -
 * never presented to the learner as AI-generated. Every response that used
 * one carries `fallback: true` so the UI can say so honestly.
 */
import type { Mission, Plan, Profile } from "./loop-types";
import { LESSONS, SKILLS } from "./mentor/curriculum";

export const CURATED_FOLLOW_UPS: { question: string; placeholder: string }[] = [
  {
    question: "What should finishing this project do for you?",
    placeholder: "e.g. learn C properly, build a portfolio piece, prepare for placements",
  },
  {
    question: "What part of coding feels least clear to you right now?",
    placeholder: "e.g. pointers, logic building, where to even start",
  },
  {
    question: "Is there anything that could get in the way of your daily build window?",
    placeholder: "e.g. classes, work shifts, travel - be honest, the plan should fit real life",
  },
];

export type CuratedProject = { title: string; summary: string; stack: string; why: string };

function profileIsC(profile: Profile): boolean {
  return profile.technologies.some((t) => /(^|[^a-z])c([^a-z]|$)|c\+\+/i.test(t.name));
}

function stackLabel(profile: Profile): string {
  const names = profile.technologies.map((t) => t.name.trim()).filter(Boolean);
  return names.join(", ") || "your chosen tools";
}

/** Beginner-safe starter projects matched to the learner's declared stack. */
export function curatedProjects(profile: Profile): CuratedProject[] {
  if (profileIsC(profile)) {
    return [
      {
        title: "Mini Calculator in C",
        summary: "A command-line calculator that reads two numbers and adds, subtracts, multiplies, divides and finds remainders.",
        stack: "C",
        why: "Covers the full C foundation - output, input, variables, arithmetic and conditions - in one small real program.",
      },
      {
        title: "Number Guessing Game",
        summary: "The program picks a number; the player keeps guessing with higher/lower hints until they get it.",
        stack: "C",
        why: "Teaches loops and conditions while staying fun and small enough to finish.",
      },
      {
        title: "Marks Average Calculator",
        summary: "Enter marks for a few subjects and get the total, average and grade.",
        stack: "C",
        why: "Practices input, division and type casting - the exact spots beginners usually trip on.",
      },
      {
        title: "Unit Converter",
        summary: "Convert between kilometres and miles, kilograms and pounds, Celsius and Fahrenheit.",
        stack: "C",
        why: "Real-world arithmetic practice with clean menu-style input handling.",
      },
    ];
  }
  const stack = stackLabel(profile);
  return [
    {
      title: "Personal Task Tracker",
      summary: "Add, list and tick off daily tasks in a small app you actually use.",
      stack,
      why: "A first project you will finish - covers data storage, lists and user interaction.",
    },
    {
      title: "Expense Splitter",
      summary: "Enter shared expenses and see who owes whom after a trip or dinner.",
      stack,
      why: "Practical math plus real input handling; easy to demo to friends.",
    },
    {
      title: "Quiz App",
      summary: "Ask a set of questions, take answers and show a final score.",
      stack,
      why: "Teaches control flow and state with a clear, motivating finish line.",
    },
    {
      title: "Notes Saver",
      summary: "Write short notes, save them and read them back later.",
      stack,
      why: "Introduces persistence - the skill every real project needs next.",
    },
  ];
}

function dailyMinutes(profile: Profile): number {
  const parse = (t: string) => {
    const m = /^(\d{1,2}):(\d{2})/.exec(t.trim());
    return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
  };
  const start = parse(profile.startTime);
  const end = parse(profile.endTime);
  if (Number.isNaN(start) || Number.isNaN(end)) return 60;
  let diff = end - start;
  if (diff <= 0) diff += 24 * 60; // overnight window
  return Math.max(20, Math.min(180, diff));
}

function missionFromLesson(index: number, lesson: (typeof LESSONS)[number], minutes: number): Mission {
  return {
    id: `m${index + 1}`,
    title: lesson.title,
    stack: "C",
    difficulty: Math.min(5, Math.floor(index / 2)),
    minutes,
    description: lesson.objective,
    skills: [SKILLS[lesson.skill] ?? lesson.skill],
    steps: [
      { title: "Learn the concept", detail: lesson.explanation[0] ?? lesson.objective },
      { title: "Study the example", detail: `Read and run the example, then predict its output before checking.` },
      { title: `Build: ${lesson.practice.title}`, detail: lesson.practice.prompt },
      { title: "Prove it", detail: "Run the tests until every one passes. Ask for hints when stuck - they guide, never solve." },
    ],
    deliverable: `${lesson.practice.title} passing all tests`,
    required_skills: lesson.prerequisites.map((p) => SKILLS[p] ?? p),
    teaches: lesson.concepts,
    prerequisites: lesson.prerequisites.map((p) => SKILLS[p] ?? p),
  };
}

function curatedCPlan(profile: Profile): Plan {
  const minutes = dailyMinutes(profile);
  const missions = LESSONS.map((lesson, i) => missionFromLesson(i, lesson, minutes));
  const first = missions[0];
  return {
    headline: "Your C build path is ready.",
    profileSummary:
      "The AI service is offline right now, so this path uses BuildMyLogic's curated C curriculum instead of a personalised one. It is the same lesson ladder the AI Mentor teaches and grades.",
    projectTitle: "Mini Calculator in C",
    projectPitch:
      "Build a command-line calculator in C, one tested step at a time: printing, reading input, arithmetic, division and modulus, conditions, then the full calculator.",
    quote: "Start small, finish big.",
    skills: Object.values(SKILLS).map((name) => ({ name, level: 0, note: "No BuildMyLogic evidence yet. Build and prove it." })),
    missions,
    session: {
      focus: first ? first.title : "Get started",
      tasks: [
        { title: "Set up your project folder and open your editor", minutes: 10 },
        ...(first
          ? first.steps.slice(0, 3).map((s) => ({ title: s.title, minutes: Math.max(10, Math.round((minutes - 10) / 3)) }))
          : []),
      ],
      totalMinutes: minutes,
      tip: "Stop when the window ends. Tomorrow's mission picks up exactly here.",
    },
    progress: {
      momentum: 0,
      weeklyGoal: profile.repeatDaily ? "Build every day this week, one mission per sitting." : "Finish one mission this week.",
      insights: [
        "This path is curated, not AI-personalised - regenerate it from your dashboard once the AI service is back.",
        "Every mission ends with real tests your code must pass, so progress is earned.",
        "Small daily windows beat weekend cramming for keeping syntax in your head.",
      ],
    },
  };
}

function curatedGenericPlan(profile: Profile): Plan {
  const minutes = dailyMinutes(profile);
  const stack = stackLabel(profile);
  const idea = profile.projectIdea.trim() || "your first project";
  const titles: [string, string][] = [
    ["Set up and structure", "Create the project folder, set up your tools and write the smallest runnable version."],
    ["Core fundamentals", "Practice the language basics this project needs, in tiny throwaway exercises."],
    ["User interaction", "Add the input and output path: menus, forms or commands your project uses."],
    ["Validation and control flow", "Handle bad input and edge cases so the program never crashes on a real person."],
    ["Working with data", "Store, list and update the information your project manages."],
    ["Reusable pieces", "Refactor repeated logic into functions or components you can reuse."],
    ["Assemble the final project", `Bring every piece together into the finished version of ${idea}.`],
  ];
  const missions: Mission[] = titles.map(([title, description], i) => ({
    id: `m${i + 1}`,
    title,
    stack,
    difficulty: Math.min(5, Math.floor(i / 2)),
    minutes,
    description,
    skills: [stack],
    steps: [
      { title: "Understand the goal", detail: description },
      { title: "Build the small version", detail: "Make the simplest thing that works before making it good." },
      { title: "Check it works", detail: "Run it yourself and try to break it with odd input." },
    ],
    deliverable: `${title} - working and self-tested`,
    required_skills: i === 0 ? [] : [stack],
    teaches: [stack],
    prerequisites: i === 0 ? [] : [titles[i - 1]?.[0] ?? "Setup"],
  }));
  const first = missions[0];
  return {
    headline: "Your build path is ready.",
    profileSummary:
      "The AI service is offline right now, so this is BuildMyLogic's curated starter path, not a personalised one. It follows the proven beginner ladder and is sized to your daily window.",
    projectTitle: idea.length > 80 ? idea.slice(0, 77) + "..." : idea,
    projectPitch: `A staged build of ${idea} using ${stack}, one tested step per day.`,
    quote: "Start small, finish big.",
    skills: [{ name: stack, level: 0, note: "No BuildMyLogic evidence yet. Build and prove it." }],
    missions,
    session: {
      focus: first?.title ?? "Get started",
      tasks: (first?.steps ?? []).map((s) => ({ title: s.title, minutes: Math.max(10, Math.round(minutes / 3)) })),
      totalMinutes: minutes,
      tip: "Stop when the window ends. Tomorrow's mission picks up exactly here.",
    },
    progress: {
      momentum: 0,
      weeklyGoal: profile.repeatDaily ? "Build every day this week, one mission per sitting." : "Finish one mission this week.",
      insights: [
        "This path is curated, not AI-personalised - regenerate it from your dashboard once the AI service is back.",
        "Finish the small version of each step before improving it.",
        "Small daily windows beat weekend cramming.",
      ],
    },
  };
}

export function curatedPlan(profile: Profile): Plan {
  return profileIsC(profile) ? curatedCPlan(profile) : curatedGenericPlan(profile);
}
