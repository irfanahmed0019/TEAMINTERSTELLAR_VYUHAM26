import { emptyState, type LoopState } from "./loop-types";
import {
  attachReassessment,
  emptyStruggleState,
  newReassessment,
  recordPracticeAttempt,
  recordReassessmentAttempt,
} from "./struggle-engine";

/** Authored sample records, never observations about the signed-in learner. */
export function makeSampleProgress(at = Date.now()): LoopState {
  const topics = [
    "variables",
    "conditions",
    "loops",
    "input",
    "math",
    "first-program",
  ];
  const labels = [
    "Variables",
    "Conditions",
    "Loops",
    "Input",
    "Math",
    "First program",
  ];
  let struggle = structuredClone(emptyStruggleState);
  for (const [i, topicId] of topics.entries()) {
    const start = at - (7 - i) * 86400000;
    const base = {
      topicId,
      topicTitle: `DEMO: ${labels[i]}`,
      language: "python",
      exerciseTitle: `DEMO: ${labels[i]} boundary check`,
      exerciseHint: "Sample fixture, not real performance.",
    };
    for (let n = 0; n < 3; n++)
      struggle = recordPracticeAttempt(struggle, {
        ...base,
        at: start + n * 60000,
        graded: [
          {
            name: "edge case: sample boundary",
            hidden: false,
            passed: false,
            expected: "5",
            actual: "4",
            status: "Wrong Answer",
            stderr: "",
          },
        ],
      }).state;
    const target = struggle.misconceptions.find((m) => m.topicId === topicId)!;
    if (i < 4) {
      const task = newReassessment(topicId, "python", start + 180000);
      if (task) {
        struggle = attachReassessment(struggle, target.id, task);
        struggle = recordReassessmentAttempt(struggle, {
          misconceptionId: target.id,
          at: start + 300000,
          constructOk: true,
          graded: task.tests.map((t) => ({
            name: t.name,
            expected: t.expected,
            actual: t.expected,
            passed: true,
            hidden: false,
            status: "Accepted",
            stderr: "",
          })),
        }).state;
      }
    }
    for (let n = 0; n < 5; n++)
      struggle = recordPracticeAttempt(struggle, {
        ...base,
        at: start + 400000 + n * 60000,
        graded: [
          {
            name: "sample pass",
            expected: "5",
            actual: "5",
            passed: true,
            hidden: false,
            status: "Accepted",
            stderr: "",
          },
        ],
      }).state;
  }
  struggle.attempts = struggle.attempts.map((a) => ({ ...a, synthetic: true }));
  struggle.misconceptions = struggle.misconceptions.map((m) => ({
    ...m,
    synthetic: true,
  }));
  // Imported samples never trigger a surprise achievement popup.
  struggle.celebratedIds = struggle.misconceptions
    .filter((m) => m.status === "conquered")
    .map((m) => m.id);
  const missions = labels.map((label, i) => ({
    id: `sample-mission-${i}`,
    title: `DEMO: ${label} practice`,
    stack: "Python",
    difficulty: i < 3 ? 1 : 2,
    minutes: 25,
    description: `Sample ${label.toLowerCase()} mission for exploring the interface. Not a completed real project.`,
    skills: [label],
    steps: [
      { title: "Read the example", detail: "Trace the sample input." },
      {
        title: "Write a small check",
        detail: "Compare expected and actual output.",
      },
    ],
    deliverable: "A labeled sample practice exercise.",
  }));
  return {
    ...structuredClone(emptyState),
    onboarded: true,
    sampleProvenance: {
      version: 1,
      importedAt: at,
      label: "SAMPLE PROGRESS - synthetic examples, not genuine achievements",
    },
    profile: {
      name: "Demo learner (sample data)",
      resumeText: "",
      resumeSummary: "Sample profile, not a resume.",
      technologies: [{ name: "Python", level: "beginner" }],
      goal: "Explore BuildMyLogic with sample progress",
      goalDetail:
        "All imported numbers, attempts and wins are synthetic demo examples.",
      experience: "Sample learner",
      experienceDetail: "Not an assessment of the account owner.",
      startTime: "19:00",
      endTime: "20:00",
      repeatDaily: false,
      followUps: [],
      projectIdea: "DEMO: Python practice journey",
      challenge: "Sample data",
    },
    plan: {
      headline: "Explore a fuller dashboard with labeled sample progress.",
      profileSummary: "Synthetic demonstration only.",
      projectTitle: "DEMO: Python practice journey",
      projectPitch: "Explore topics, practice, recovery and Struggle DNA.",
      quote: "Sample progress is not proof of real skills.",
      skills: labels.map((name, i) => ({
        name,
        level: [89, 76, 68, 61, 42, 35][i]!,
        note: "DEMO value, not a real skill assessment.",
      })),
      missions,
      session: {
        focus: "DEMO: Focused recovery practice",
        tasks: [
          { title: "Trace the failing input", minutes: 10 },
          { title: "Try a changed task", minutes: 15 },
        ],
        totalMinutes: 25,
        tip: "Sample plan. Use your own practice to build genuine evidence.",
      },
      progress: {
        momentum: 72,
        weeklyGoal: "DEMO: Explore the full learning loop",
        insights: [
          "DEMO: 4 sample patterns overcome; 2 still being worked on.",
          "These are sample records, not real attempts.",
        ],
      },
    },
    missionProgress: Object.fromEntries(
      missions.map((m, i) => [
        m.id,
        {
          status: i < 3 ? "done" : i === 3 ? "active" : "locked",
          completedSteps: i < 3 ? [0, 1] : [],
        },
      ]),
    ),
    sessions: Array.from({ length: 12 }, (_, i) => ({
      at: at - i * 86400000,
      synthetic: true,
      minutes: 25,
      missionTitle: `DEMO: ${labels[i % labels.length]} practice`,
      note: "Synthetic sample session, not recorded learner activity.",
    })),
    activity: labels.map((label, i) => ({
      at: at - i * 86400000,
      synthetic: true,
      kind: "skill" as const,
      text: `DEMO: Sample ${label} progress. Not a genuine learner achievement.`,
    })),
    learningChats: {},
    selectedLearningMissionId: missions[3]!.id,
    skillMemory: Object.fromEntries(
      labels.map((label, i) => [
        label.toLowerCase(),
        {
          level: [89, 76, 68, 61, 42, 35][i]!,
          lastPracticedAt: at - i * 86400000,
          evidence: [
            {
              at: at - i * 86400000,
              weight: 12,
              source: "code_test" as const,
              description:
                "DEMO: Synthetic sample evidence, not an executed learner test.",
            },
          ],
        },
      ]),
    ),
    struggle,
  };
}
