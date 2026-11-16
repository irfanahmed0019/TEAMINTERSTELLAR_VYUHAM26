import type { LoopState } from "./loop-types";
/** Exact concept identifiers only. Neither time alone nor a substring can downgrade another topic. */
export function priorityLearningTopics(state: LoopState): Map<string, string> {
  const result = new Map<string, string>();
  if (state.sampleProvenance) return result;
  for (const m of state.struggle?.misconceptions ?? []) {
    if (m.synthetic || m.status === "conquered") continue;
    const id = m.transferTopicId || m.topicId;
    if (m.status === "locked")
      result.set(
        id,
        `Repeated ${m.kind} failures. Review the targeted concept, then take a fresh reassessment.`,
      );
  }
  const histories = new Map<string, boolean[]>();
  for (const a of [...(state.struggle?.attempts ?? [])].sort(
    (a, b) => a.at - b.at,
  )) {
    if (a.synthetic || a.total <= 0) continue;
    const list = histories.get(a.topicId) ?? [];
    list.push(a.passed === a.total);
    histories.set(a.topicId, list);
  }
  for (const a of state.assessmentEvidence ?? []) {
    if (!a.topicId || a.total <= 0) continue;
    const list = histories.get(a.topicId) ?? [];
    list.push(a.passed === a.total);
    histories.set(a.topicId, list);
  }
  for (const [id, list] of histories)
    if (list.slice(-3).filter((pass) => !pass).length >= 2 && !result.has(id))
      result.set(
        id,
        "Two or more recent checks were not fully passing. Review this topic and test it again.",
      );
  return result;
}
