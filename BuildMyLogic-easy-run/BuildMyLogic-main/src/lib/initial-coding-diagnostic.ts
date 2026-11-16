import type { Profile } from "./loop-types";
import { STUDY_TOPICS } from "./topic-library.ts";
import { newReassessment } from "./struggle-engine.ts";
import type { AssessmentEvidence } from "./assessment-evidence";
export type CodingLanguage = "c" | "python";
export type InitialCodingSubmission = {
  taskId: string;
  topicId: string;
  language: CodingLanguage;
  passed: number;
  total: number;
  at: number;
  hintsUsed: number;
  evidenceId: string;
};
export type InitialCodingDiagnostic = {
  draft?:
    | {
        taskId: string;
        language: CodingLanguage;
        code: string;
        hintUsed: boolean;
      }
    | undefined;
  version: 1;
  language: CodingLanguage;
  topicId: string;
  submissions: InitialCodingSubmission[];
};
const supported = [
  "input",
  "variables",
  "math",
  "conditions",
  "loops",
  "functions",
  "arrays-lists",
  "strings",
  "recursion",
] as const;
export type CodingTopic = (typeof supported)[number];
export type InitialCodingTask = {
  id: string;
  topicId: string;
  skill: string;
  title: string;
  task: string;
  language: CodingLanguage;
  level: "basic" | "transfer";
  difficultyNote: string;
  starterCode: string;
  hint: string;
  tests: Array<{
    name: string;
    stdin: string;
    expected: string;
    hidden?: boolean;
  }>;
};
export function initialCodingTask(
  id: string,
  language: CodingLanguage,
): InitialCodingTask | null {
  if (language !== "c" && language !== "python") return null;
  const m = /^coding-v1:([a-z-]+):(basic|transfer)$/.exec(id);
  if (!m || !supported.includes(m[1] as CodingTopic)) return null;
  const topic = STUDY_TOPICS.find((t) => t.id === m[1]);
  if (!topic) return null;
  const base = topic.exercise[language];
  const transfer =
    m[2] === "transfer" ? newReassessment(topic.id, language, 0) : null;
  if (m[2] === "transfer" && !transfer) return null;
  return {
    id,
    topicId: topic.id,
    skill: topic.title,
    title: transfer?.title ?? base.title,
    task: transfer?.task ?? base.task,
    language,
    level: m[2] as "basic" | "transfer",
    difficultyNote: transfer
      ? "Authored transfer task: changed requirements and boundary cases. Difficulty is an estimate, not population data."
      : "Authored basic scaffold on the same concept. Passing finite cases is not proof of general mastery.",
    starterCode: transfer
      ? language === "c"
        ? "#include <stdio.h>\nint main(void) {\n  /* Write your program. */\n  return 0;\n}"
        : "# Write your program."
      : base.starterCode,
    hint: transfer
      ? "Break the requirement into input, transformation and output. Check zero and boundary cases. Do not print input prompts."
      : base.hint,
    tests: transfer
      ? transfer.tests.map((t) => ({
          name: t.name,
          stdin: t.stdin,
          expected: t.expected,
          hidden: false,
        }))
      : base.tests.map((t) => ({ ...t, hidden: false })),
  };
}
/** Relevance is an explicit suggestion from goal/claimed context, never verified skill. */
export function suggestedCodingTopic(p: Profile): CodingTopic {
  const text = [
    p.goal,
    p.goalDetail,
    p.projectIdea,
    p.experienceDetail,
    p.resumeSummary,
    p.resumeText,
    ...p.followUps.map((f) => f.answer),
    ...p.technologies.map((t) => t.name),
  ]
    .join(" ")
    .toLowerCase();
  if (/recurs/.test(text)) return "recursion";
  if (/array|list|data/.test(text)) return "arrays-lists";
  if (/function/.test(text)) return "functions";
  if (/loop|iterat/.test(text)) return "loops";
  if (/string|text/.test(text)) return "strings";
  if (/condition|decision/.test(text)) return "conditions";
  return "input";
}
export function codingTopicOptions() {
  return supported.map((id) => ({
    id,
    title: STUDY_TOPICS.find((t) => t.id === id)!.title,
  }));
}
const harder: Record<string, string> = {
  input: "conditions",
  variables: "conditions",
  math: "loops",
  conditions: "loops",
  loops: "arrays-lists",
  functions: "recursion",
  "arrays-lists": "recursion",
  strings: "arrays-lists",
  recursion: "arrays-lists",
};
export function nextInitialCodingTask(
  d: InitialCodingDiagnostic,
): InitialCodingTask | null {
  if (d.submissions.length >= 2) return null;
  const previous = d.submissions.at(-1);
  const topic = previous
    ? previous.passed === previous.total
      ? (harder[previous.topicId] ?? "loops")
      : previous.topicId
    : d.topicId;
  return initialCodingTask(
    `coding-v1:${topic}:${previous && previous.passed < previous.total ? "basic" : "transfer"}`,
    d.language,
  );
}
export function codingDiagnosticSummary(d?: InitialCodingDiagnostic): string {
  if (!d?.submissions.length)
    return "No initial practical coding results. Do not invent demonstrated coding strength.";
  return `Initial practical coding: ${d.submissions.length}/2 submissions recorded, not necessarily passing. Server-graded finite output checks, independence unverified. ${d.submissions.map((s) => `${s.topicId}/${s.language}: ${s.passed}/${s.total}, hints ${s.hintsUsed}`).join("; ")}.`;
}
export function acceptInitialCodingResult(
  d: InitialCodingDiagnostic,
  task: InitialCodingTask,
  e: AssessmentEvidence,
  currentOwner: string,
): InitialCodingDiagnostic {
  if (
    e.ownerId !== currentOwner ||
    e.source !== "server-graded initial coding tests" ||
    e.topicId !== task.topicId ||
    e.taskId !== task.id ||
    e.language !== task.language ||
    e.skill !== task.skill ||
    !Number.isInteger(e.hintsUsed) ||
    e.hintsUsed < 0 ||
    e.hintsUsed > 1 ||
    !e.id.startsWith("initial-coding:") ||
    d.language !== task.language ||
    e.total !== task.tests.length ||
    !Number.isInteger(e.passed) ||
    e.passed < 0 ||
    e.passed > e.total ||
    !Number.isFinite(e.at) ||
    d.submissions.some((s) => s.evidenceId === e.id) ||
    nextInitialCodingTask(d)?.id !== task.id
  )
    return d;
  return {
    ...d,
    draft: undefined,
    submissions: [
      ...d.submissions,
      {
        taskId: task.id,
        topicId: task.topicId,
        language: task.language,
        passed: e.passed,
        total: e.total,
        at: e.at,
        hintsUsed: e.hintsUsed,
        evidenceId: e.id,
      },
    ],
  };
}
