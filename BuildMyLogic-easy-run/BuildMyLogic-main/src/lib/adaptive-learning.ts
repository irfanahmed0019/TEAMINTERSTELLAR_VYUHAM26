import type { LoopState } from "./loop-types";
/** Exact concept identifiers only. Neither time alone nor a substring can downgrade another topic. */
export function priorityLearningTopics(state: LoopState): Map<string, string> {
  const result = new Map<string, string>();
  if (state.sampleProvenance) return result;
  for (const m of state.struggle?.misconceptions ?? []) {
    if (m.synthetic || m.status === "conquered") continue;
    const id =
      m.transferTopicId || m.topicId.replace(/:owner:[0-9a-f-]+$/i, "");
    if (m.status === "locked")
      result.set(
        id,
        `Repeated ${m.kind} failures. Review the targeted concept, then take a fresh reassessment.`,
      );
  }
  const support = state.profile?.initialCodingDiagnostic?.scaffolds?.at(-1);
  if (support && !result.has(support.topicId))
    result.set(
      support.topicId,
      "A simpler question was offered after the authored time benchmark. Practice support, not a proven weakness.",
    );
  const histories = new Map<string, boolean[]>();
  for (const a of [...(state.struggle?.attempts ?? [])].sort(
    (a, b) => a.at - b.at,
  )) {
    if (a.synthetic || a.total <= 0) continue;
    const list =
      histories.get(a.topicId.replace(/:owner:[0-9a-f-]+$/i, "")) ?? [];
    list.push(a.passed === a.total);
    histories.set(a.topicId.replace(/:owner:[0-9a-f-]+$/i, ""), list);
  }
  for (const a of state.assessmentEvidence ?? []) {
    if (!a.topicId || a.total <= 0) continue;
    const list =
      histories.get(a.topicId.replace(/:owner:[0-9a-f-]+$/i, "")) ?? [];
    list.push(a.passed === a.total);
    histories.set(a.topicId.replace(/:owner:[0-9a-f-]+$/i, ""), list);
  }
  for (const [id, list] of histories)
    if (list.slice(-3).filter((pass) => !pass).length >= 2 && !result.has(id))
      result.set(
        id,
        "Two or more recent checks were not fully passing. Review this topic and test it again.",
      );
  return result;
}
