import type { AssessmentEvidence } from "./assessment-evidence";
import { initialCodingTask } from "./initial-coding-diagnostic.ts";
/** A display filter, not a migration or re-attestation of persisted results. */
export function initialAssessmentView(
  evidence: AssessmentEvidence[],
  ownerId: string | undefined,
  hydrated: boolean,
): AssessmentEvidence[] {
  if (!ownerId || !hydrated) return [];
  return evidence
    .filter((e) => {
      const task =
        e.taskId && e.language ? initialCodingTask(e.taskId, e.language) : null;
      if (
        !task ||
        e.ownerId !== ownerId ||
        e.source !== "server-graded initial coding tests" ||
        !e.id?.startsWith("initial-coding:") ||
        e.topicId !== task.topicId ||
        e.skill !== task.skill ||
        !Number.isFinite(e.at) ||
        e.at <= 0 ||
        !Number.isInteger(e.total) ||
        e.total !== task.tests.length ||
        !Number.isInteger(e.passed) ||
        e.passed < 0 ||
        e.passed > e.total ||
        !Number.isInteger(e.hintsUsed) ||
        e.hintsUsed < 0 ||
        e.hintsUsed > 1
      )
        return false;
      const p = e.performance;
      return (
        !p ||
        (p.expectedMs === task.expectedMinutes * 60000 &&
          ["unavailable", "browser-interaction-observed"].includes(
            p.timingQuality,
          ) &&
          (p.timingQuality !== "browser-interaction-observed" ||
            (Number.isFinite(p.activeMs) &&
              p.activeMs! >= 0 &&
              p.activeMs! <= 86400000)))
      );
    })
    .slice(-6)
    .reverse();
}
