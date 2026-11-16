import type { MentorState } from "./mentor/engine";
import { LESSONS } from "./mentor/curriculum";
export type AssessmentEvidence = {
  id: string;
  ownerId: string;
  skill: string;
  topicId?: string;
  at: number;
  passed: number;
  total: number;
  hintsUsed: number;
  source: "server-graded Mentor tests";
};
const topicBySkill: Record<string, { id: string; title: string }> = {
  output: { id: "first-program", title: "Your First Program" },
  input: { id: "input", title: "User Input" },
  addition: { id: "math", title: "Math & Operators" },
  subtraction_multiplication: { id: "math", title: "Math & Operators" },
  division_modulus: { id: "math", title: "Math & Operators" },
  conditionals: { id: "conditions", title: "if / else Conditions" },
};
/** Only server-returned signed-in submissions. Device/extension observation is never upgraded. */
export function mentorAssessmentEvidence(
  state: MentorState | null,
  ownerId: string,
): AssessmentEvidence[] {
  if (!state?.verified || !ownerId) return [];
  return state.attempts
    .filter(
      (a) =>
        a.mode === "submit" &&
        a.results.length > 0 &&
        Number.isFinite(Date.parse(a.ts)),
    )
    .flatMap((a) => {
      const lesson = LESSONS.find((l) => l.id === a.lessonId);
      if (!lesson) return [];
      const topic = topicBySkill[lesson.skill];
      return [
        {
          id: `mentor:${state.id}:${a.id}`,
          ownerId,
          skill: topic?.title ?? lesson.title,
          ...(topic ? { topicId: topic.id } : {}),
          at: Date.parse(a.ts),
          passed: a.results.filter((r) => r.passed).length,
          total: a.results.length,
          hintsUsed: Math.max(0, a.hintsUsed || 0),
          source: "server-graded Mentor tests" as const,
        },
      ];
    });
}

/** Retain recorded history. A recent display window must not delete another skill's evidence. */
export function mergeAssessmentEvidence(
  old: AssessmentEvidence[],
  incoming: AssessmentEvidence[],
): AssessmentEvidence[] {
  const ids = new Set(old.map((e) => e.id));
  const fresh: AssessmentEvidence[] = [];
  for (const e of incoming)
    if (!ids.has(e.id)) {
      ids.add(e.id);
      fresh.push(e);
    }
  return fresh.length ? [...old, ...fresh].sort((a, b) => a.at - b.at) : old;
}
