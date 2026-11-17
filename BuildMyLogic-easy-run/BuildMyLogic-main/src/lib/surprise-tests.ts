import type { BuildSessionState, LoopState } from "./loop-types";
export type SurpriseTestResult = {
  id: string;
  owner: string;
  sessionId: string;
  challengeId: string;
  title: string;
  language: string;
  at: number;
  attempts: number;
  passed: number;
  total: number;
  outcome: "passed" | "ended";
  provenance: "extension-reported";
};
/** Private finite results only. Never updates competency, roadmap or skill memory. */
export function ingestSurpriseTests(
  prev: LoopState,
  remote: BuildSessionState,
  owner?: string,
): LoopState {
  if (
    !owner ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      owner,
    ) ||
    remote.verified_owner_id !== owner ||
    !/^BML-[A-Z0-9]{4,20}$/.test(remote.session_id) ||
    prev.sampleProvenance
  )
    return prev;
  const saved = { ...prev.surpriseTests };
  let changed = false;
  const snapshots = [
    remote,
    ...(remote.practice_history ?? []).map(
      (h) => h.state as unknown as BuildSessionState,
    ),
  ];
  for (const s of snapshots) {
    if (
      s.session_id !== remote.session_id ||
      !s.surprise_test?.enabled ||
      !["completed", "failed"].includes(s.status) ||
      s.evidence_provenance !== "extension-reported" ||
      !Number.isSafeInteger(s.task_generation ?? 0) ||
      (s.task_generation ?? 0) < 0 ||
      (s.task_generation ?? 0) > (remote.task_generation ?? 0) ||
      !Number.isInteger(s.attempts) ||
      s.attempts < 1 ||
      !s.attempt_history?.length ||
      !s.checkpoints?.length ||
      !s.test_score ||
      s.test_score.total !== s.checkpoints.length ||
      s.test_score.total < 1
    )
      continue;
    const last = s.attempt_history.at(-1)!;
    if (
      last.attempt !== s.attempts ||
      !Number.isInteger(last.total) ||
      last.total < 1 ||
      !Number.isInteger(last.passed) ||
      last.passed < 0 ||
      last.passed > last.total
    )
      continue;
    const passed = s.checkpoints.filter((c) => c.status === "passed").length;
    if (
      !Number.isFinite(last.at) ||
      last.at <= 0 ||
      s.test_score.passed !== passed ||
      (s.status === "completed" && passed !== s.checkpoints.length) ||
      !s.checkpoints.every(
        (c) =>
          c.evaluator?.id &&
          c.evaluator.expectedOutputIncludes?.length &&
          (c.status !== "passed" ||
            c.evaluator.expectedOutputIncludes.every((marker) =>
              c.lastOutput?.includes(marker),
            )),
      )
    )
      continue;
    const id = `${owner}:${s.session_id}:${s.task_generation ?? 0}:${s.challenge_id}`;
    if (saved[id]) continue;
    saved[id] = {
      id,
      owner,
      sessionId: s.session_id,
      challengeId: s.challenge_id,
      title: s.title,
      language: s.language,
      at: last.at,
      attempts: s.attempts,
      passed,
      total: s.checkpoints.length,
      outcome: s.status === "completed" ? "passed" : "ended",
      provenance: "extension-reported",
    };
    changed = true;
  }
  return changed ? { ...prev, surpriseTests: saved } : prev;
}
