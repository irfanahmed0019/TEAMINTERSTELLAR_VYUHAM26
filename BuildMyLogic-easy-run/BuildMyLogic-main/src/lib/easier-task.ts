import type { LoopState } from "./loop-types";
export function easierTaskOffer(state: LoopState) {
  if (state.sampleProvenance || !state.plan) return null;
  const attempts = [...(state.struggle?.attempts ?? [])]
    .filter(
      (a) =>
        !a.synthetic &&
        a.total > 0 &&
        Number.isInteger(a.passed) &&
        a.passed >= 0 &&
        a.passed <= a.total &&
        ["practice", "vscode"].includes(a.source ?? "") &&
        Number.isFinite(a.at) &&
        typeof a.id === "string",
    )
    .sort((a, b) => b.at - a.at);
  const latest = attempts[0];
  if (
    !latest ||
    !["c", "python"].includes(latest.language.toLowerCase()) ||
    latest.fullPass ||
    latest.passed === latest.total ||
    ["Add two variables", "Add two numbers"].includes(latest.exerciseTitle)
  )
    return null;
  const scope =
    latest.source === "vscode"
      ? /^(practice:BML-[A-Z0-9]{5}:\d+:[^:]+):\d+:owner:/.exec(latest.id)?.[1]
      : "web";
  if (!scope) return null;
  const seen = new Set<string>(),
    failures = [];
  for (const a of attempts) {
    if (
      a.source !== latest.source ||
      (a.source === "vscode" && !a.id.startsWith(scope + ":"))
    )
      continue;
    if (
      a.topicId !== latest.topicId ||
      a.exerciseTitle !== latest.exerciseTitle ||
      a.language !== latest.language
    )
      continue;
    if (a.fullPass || a.passed === a.total) break;
    if (!seen.has(a.id)) {
      seen.add(a.id);
      failures.push(a);
    }
  }
  if (failures.length < 3) return null;
  const id = "beginner-addition:" + failures[0]!.id;
  if (state.plan.missions.some((m) => m.id === id)) return null;
  return {
    id,
    language: latest.language.toLowerCase() as "c" | "python",
    sourceTitle: latest.exerciseTitle,
    source: latest.source,
    evidenceIds: failures.slice(0, 3).map((a) => a.id),
  };
}
export function chooseEasierTask(state: LoopState): LoopState {
  const offer = easierTaskOffer(state);
  if (!offer || !state.plan) return state;
  return {
    ...state,
    plan: {
      ...state.plan,
      missions: [
        {
          id: offer.id,
          title: "Add two numbers",
          stack: offer.language === "python" ? "Python" : "C",
          difficulty: 1,
          minutes: 5,
          description:
            "Store 5 and 7 in two variables, add them, and print 12. Your earlier question and attempts remain saved. This easier task does not pass that question.",
          skills: ["Variables & data types"],
          steps: [
            {
              title: "Store two numbers",
              detail: "Create variables for 5 and 7.",
            },
            { title: "Add and print", detail: "Print their sum: 12." },
          ],
          deliverable: "A program that prints 12.",
        },
        ...state.plan.missions,
      ],
    },
    missionProgress: {
      ...state.missionProgress,
      [offer.id]: { status: "active", completedSteps: [] },
    },
    activity: [
      {
        kind: "mission",
        at: Date.now(),
        text:
          "Chose beginner addition after three recorded failed submissions on " +
          offer.sourceTitle +
          ". Earlier work retained; no pass awarded.",
      },
      ...state.activity,
    ],
  };
}
