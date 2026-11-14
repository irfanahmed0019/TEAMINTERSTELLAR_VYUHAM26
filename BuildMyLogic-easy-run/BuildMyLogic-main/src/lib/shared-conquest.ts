import {
  recordReassessmentAttempt,
  type StruggleState,
} from "./struggle-engine.ts";
export type ConquestReceipt = {
  id: string;
  patternId: string;
  summary: string;
  conqueredAt: number;
};
/** Validate the owner's saved website record. This is client-graded cloud evidence, not server-attested execution. */
export function savedConquestReceipt(
  state: StruggleState,
  patternId: string,
  session: { sessionId: string; userId: string; challengeId: string },
): ConquestReceipt | null {
  const m = state?.misconceptions?.find((x) => x.id === patternId);
  if (
    !m ||
    m.status !== "conquered" ||
    !m.reassessed ||
    m.sourceSessionId !== session.sessionId ||
    m.recoveryOwnerId !== session.userId ||
    m.sourceMissionId !== session.challengeId ||
    !m.conqueredAt ||
    !m.reassessment ||
    m.reassessment.version !== "diagnostic-v1"
  )
    return null;
  const attempt = state.attempts?.find(
    (a) =>
      a.source === "reassessment" &&
      a.at === m.conqueredAt &&
      a.topicId === m.topicId &&
      a.language === m.language &&
      a.fullPass &&
      a.passed === m.reassessment!.tests.length &&
      a.total === m.reassessment!.tests.length,
  );
  if (!attempt) return null;
  const before = {
    ...state,
    misconceptions: state.misconceptions.map((x) =>
      x.id === m.id ? { ...x, status: "locked" as const } : x,
    ),
  };
  const checked = recordReassessmentAttempt(before, {
    misconceptionId: m.id,
    ownerId: session.userId,
    at: m.conqueredAt,
    constructOk: true,
    graded: m.reassessment.tests.map((t) => ({
      name: t.name,
      expected: t.expected,
      actual: t.expected,
      passed: true,
      hidden: false,
      status: "Accepted",
      stderr: "",
    })),
  });
  if (!checked.outcome?.conquered) return null;
  return {
    id: `${session.sessionId}:${m.id}:${m.conqueredAt}`,
    patternId: m.id,
    summary: m.summary.slice(0, 180),
    conqueredAt: m.conqueredAt,
  };
}
