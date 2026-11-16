import type { BuildSessionState, LoopState } from "./loop-types";
import {
  emptyStruggleState,
  recordBuildSessionOutcome,
} from "./struggle-engine.ts";
/** Recognized narrow task only. Context is provenance, not proof of server-side execution. */
export function isSupportedProjectEvidence(remote: BuildSessionState): boolean {
  if (
    !/^python-decimal-contract:[a-f0-9]{16}$/.test(remote.challenge_id) ||
    !remote.verified_owner_id ||
    remote.evidence_provenance !== "extension-reported"
  )
    return false;
  const evaluator = remote.checkpoints?.[0]?.evaluator;
  const digest = remote.project_context?.summary?.match(
    /Source digest ([a-f0-9]{64})\./,
  )?.[1];
  const paths = remote.project_context?.inspected_files ?? [];
  return (
    remote.language === "Python" &&
    remote.concept === "input validation" &&
    !!digest &&
    remote.challenge_id === "python-decimal-contract:" + digest.slice(0, 16) &&
    remote.checkpoints?.length === 1 &&
    !!evaluator &&
    evaluator.id === remote.challenge_id &&
    evaluator.command === "buildmylogic:python-decimal-contract" &&
    evaluator.expectedOutputIncludes.length === 1 &&
    evaluator.expectedOutputIncludes[0] === "BML_DECIMAL_CONTRACT_14_PASS" &&
    paths.length === 1 &&
    /^(?![./])(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.py$/.test(paths[0]!)
  );
}
export function ingestProjectEvidence(
  prev: LoopState,
  remote: BuildSessionState,
): LoopState {
  if (!isSupportedProjectEvidence(remote) || remote.attempts < 1) return prev;
  const events = [
    ...(remote.attempt_history ?? []).filter(
      (a) => a.attempt < remote.attempts,
    ),
    {
      attempt: remote.attempts,
      at:
        remote.attempt_history?.find((a) => a.attempt === remote.attempts)
          ?.at ?? Date.now(),
      passed: remote.test_score?.passed ?? 0,
      total: remote.test_score?.total ?? 0,
      checkpoints: remote.checkpoints ?? [],
    },
  ];
  let struggle = prev.struggle ?? emptyStruggleState;
  let changed = false;
  for (const event of events) {
    if (
      !Number.isInteger(event.total) ||
      event.total <= 0 ||
      !Number.isInteger(event.passed) ||
      event.passed < 0 ||
      event.passed > event.total ||
      !Number.isFinite(event.at) ||
      !Number.isInteger(event.attempt) ||
      event.attempt < 1
    )
      continue;
    // Count only the declared, finite input-validation evaluator. Never copy plan skills.
    const result = recordBuildSessionOutcome(struggle, {
      sessionKey: `project:${remote.session_id}:${event.attempt}:owner:${remote.verified_owner_id}`,
      sessionId: remote.session_id,
      verifiedOwnerId: remote.verified_owner_id,
      topicId: "input-validation",
      baseTopicId: "input-validation",
      sourceChallengeId: remote.challenge_id,
      topicTitle: "Python input validation",
      concept: "input validation",
      language: remote.language.toLowerCase(),
      exerciseTitle: remote.title,
      completed: event.passed === event.total,
      failed: event.passed < event.total,
      passed: event.passed,
      total: event.total,
      checkpoints: event.checkpoints,
      at: event.at,
      performance:
        event.attempt === remote.attempts
          ? {
              expectedMs: remote.expected_duration_ms,
              activeMs: remote.timing?.active_ms,
              timingQuality: remote.timing?.quality ?? "unavailable",
              hintsUsed: remote.hints_used,
              attemptNumber: event.attempt,
            }
          : { timingQuality: "unavailable", attemptNumber: event.attempt },
    });
    if (result.state !== struggle) {
      changed = true;
      struggle = result.state;
    }
  }
  if (!changed) return prev;
  return {
    ...prev,
    struggle,
    activity: [
      {
        at: Date.now(),
        kind: "skill" as const,
        text: `Recorded extension-reported finite input-validation evidence from ${remote.title}. Original mission progress and unrelated skills unchanged.`,
      },
      ...prev.activity,
    ].slice(0, 40),
  };
}
