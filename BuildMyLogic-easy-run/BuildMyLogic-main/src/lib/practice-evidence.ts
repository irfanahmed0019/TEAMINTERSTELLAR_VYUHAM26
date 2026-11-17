import { PRACTICE_TASKS } from "./practice-task.ts";
import {
  emptyStruggleState,
  recordBuildSessionOutcome,
} from "./struggle-engine.ts";
import type { BuildSessionState, LoopState } from "./loop-types";
const ownerPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/** Imports only owner-returned, catalog-bound finite local execution, never roadmap completion. */
export function ingestPracticeEvidence(
  prev: LoopState,
  remote: BuildSessionState,
  owner: string | undefined,
): LoopState {
  if (
    !owner ||
    !ownerPattern.test(owner) ||
    remote.verified_owner_id !== owner ||
    prev.sampleProvenance ||
    remote.evidence_provenance !== "extension-reported" ||
    typeof remote.session_id !== "string" ||
    !/^BML-[A-Z0-9]{4,20}$/.test(remote.session_id) ||
    !Number.isSafeInteger(remote.task_generation ?? 0) ||
    (remote.task_generation ?? 0) < 0 ||
    (remote.practice_history !== undefined &&
      !Array.isArray(remote.practice_history))
  )
    return prev;
  let struggle = prev.struggle ?? emptyStruggleState;
  const snapshots: Array<{ state: BuildSessionState; generation: number }> = [];
  for (const entry of remote.practice_history ?? []) {
    if (
      !entry ||
      typeof entry !== "object" ||
      !entry.state ||
      typeof entry.state !== "object"
    )
      continue;
    const state = entry.state as unknown as BuildSessionState;
    if (
      state.session_id !== remote.session_id ||
      state.challenge_id !== entry.challenge_id ||
      state.practice_history?.length
    )
      continue;
    snapshots.push({ state, generation: state.task_generation ?? 0 });
  }
  snapshots.push({ state: remote, generation: remote.task_generation ?? 0 });
  let count = 0;
  const receipts = { ...prev.practiceEvidenceReceipts };
  for (const { state: s, generation } of snapshots) {
    const task = PRACTICE_TASKS.find((t) => t.id === s.challenge_id),
      checkpoint = s.checkpoints?.[0];
    if (
      s.surprise_test?.enabled ||
      !task ||
      !Number.isSafeInteger(generation) ||
      generation < 0 ||
      generation > (remote.task_generation ?? 0) ||
      s.language !== "Python" ||
      s.concept !== task.concept ||
      s.evidence_provenance !== "extension-reported" ||
      s.checkpoints?.length !== 1 ||
      checkpoint?.evaluator?.id !== task.id ||
      checkpoint.evaluator.command !== "buildmylogic:" + task.id ||
      !Array.isArray(checkpoint.evaluator.expectedOutputIncludes) ||
      checkpoint.evaluator.expectedOutputIncludes.length !== 1 ||
      checkpoint.evaluator.expectedOutputIncludes[0] !==
        "BML_PRACTICE_PASS:" + task.id ||
      !Number.isInteger(s.attempts) ||
      s.attempts < 1 ||
      !Array.isArray(s.attempt_history)
    )
      continue;
    for (const a of [...(s.attempt_history ?? [])]
      .filter((a) => a && typeof a === "object")
      .sort((a, b) => a.attempt - b.attempt)) {
      if (
        !a ||
        typeof a !== "object" ||
        !Number.isInteger(a.attempt) ||
        a.attempt < 1 ||
        a.attempt > s.attempts ||
        !Number.isFinite(a.at) ||
        a.at <= 0 ||
        a.total !== 1 ||
        ![0, 1].includes(a.passed) ||
        a.checkpoints?.length !== 1
      )
        continue;
      const result = a.checkpoints[0]!;
      if (
        !result ||
        typeof result !== "object" ||
        result.status !== (a.passed === 1 ? "passed" : "failed") ||
        typeof result.lastOutput !== "string" ||
        !result.lastOutput?.trim() ||
        (a.passed === 1 &&
          !result.lastOutput
            .split(/\r?\n/)
            .includes("BML_PRACTICE_PASS:" + task.id))
      )
        continue;
      const key = `practice:${remote.session_id}:${generation}:${task.id}:${a.attempt}:owner:${owner}`;
      const receiptKey = `${owner}:${remote.session_id}:${generation}:${task.id}`;
      if (
        a.attempt <= (receipts[receiptKey] ?? 0) ||
        struggle.attempts.some((event) => event.id === key)
      )
        continue;
      const recorded = recordBuildSessionOutcome(struggle, {
        sessionKey: key,
        sessionId: remote.session_id,
        verifiedOwnerId: owner,
        topicId: task.concept,
        baseTopicId: task.concept,
        sourceChallengeId: task.id,
        concept: task.concept,
        topicTitle: task.concept[0]!.toUpperCase() + task.concept.slice(1),
        language: "python",
        exerciseTitle: task.title + " (finite local check)",
        completed: a.passed === 1,
        failed: a.passed === 0,
        passed: a.passed,
        total: 1,
        checkpoints: [
          {
            title: task.concept,
            status: result.status,
            lastOutput: result.lastOutput,
          },
        ],
        at: a.at,
        performance:
          a.attempt === s.attempts
            ? {
                expectedMs: s.expected_duration_ms,
                activeMs: s.timing?.active_ms,
                timingQuality: s.timing?.quality ?? "unavailable",
                hintsUsed: s.hints_used,
                attemptNumber: a.attempt,
              }
            : { timingQuality: "unavailable", attemptNumber: a.attempt },
      });
      if (recorded.state === struggle) continue;
      // Stable IDs aid auditing; persisted per-generation watermarks survive both
      // bounded attempt history and the engine's bounded recent-session index.
      const id = recorded.outcome?.attempt.id;
      struggle = {
        ...recorded.state,
        attempts: recorded.state.attempts.map((event) =>
          event.id === id ? { ...event, id: key } : event,
        ),
      };
      receipts[receiptKey] = a.attempt;
      count++;
    }
  }
  return count
    ? {
        ...prev,
        struggle,
        practiceEvidenceReceipts: receipts,
        activity: [
          {
            at: Date.now(),
            kind: "skill" as const,
            text: `Synced ${count} finite Python practice ${count === 1 ? "attempt" : "attempts"}. Local execution is extension-reported, not general mastery. Roadmap progress is unchanged.`,
          },
          ...prev.activity,
        ].slice(0, 40),
      }
    : prev;
}
