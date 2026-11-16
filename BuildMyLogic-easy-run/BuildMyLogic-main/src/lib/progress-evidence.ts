import { competencyView } from "./competency.ts";
import { PRACTICE_TASKS } from "./practice-task.ts";
import { savedConquestReceipt } from "./shared-conquest.ts";
import type { LoopState } from "./loop-types";
/** Derived from retained checked records only. Never turns a question into a project. */
export function progressEvidenceSummary(state: LoopState) {
  const assessed = competencyView(state).filter(
    (c) => c.observations > 0 && c.estimate !== null,
  );
  const ids = new Set<string>(),
    questions = new Set<string>();
  for (const a of state.struggle?.attempts ?? []) {
    if (
      a.synthetic ||
      !a.id ||
      !Number.isFinite(a.at) ||
      a.total <= 0 ||
      !Number.isInteger(a.passed) ||
      a.passed < 0 ||
      a.passed > a.total
    )
      continue;
    ids.add(a.id);
    const match =
      /^practice:BML-[A-Z0-9]{4,20}:\d+:(python-[a-z0-9-]+):\d+:owner:([0-9a-f-]{36})$/i.exec(
        a.id,
      );
    if (
      match &&
      a.source === "vscode" &&
      a.fullPass &&
      a.passed === a.total &&
      PRACTICE_TASKS.some((t) => t.id === match[1])
    )
      questions.add(match[2] + ":" + match[1]);
  }
  const checkpoints = new Set<string>();
  for (const m of state.struggle?.misconceptions ?? []) {
    if (
      m.reassessment?.version !== "practice-transfer-v1" ||
      !m.sourceSessionId ||
      !m.recoveryOwnerId ||
      !m.sourceMissionId
    )
      continue;
    const receipt = savedConquestReceipt(state.struggle!, m.id, {
      sessionId: m.sourceSessionId,
      userId: m.recoveryOwnerId,
      challengeId: m.sourceMissionId,
    });
    if (receipt) checkpoints.add(receipt.id);
  }
  return {
    assessed,
    average: assessed.length
      ? Math.round(
          assessed.reduce((sum, c) => sum + c.estimate!, 0) / assessed.length,
        )
      : null,
    checkedAttempts: ids.size,
    questionsPassed: questions.size,
    topicCheckpoints: checkpoints.size,
  };
}
