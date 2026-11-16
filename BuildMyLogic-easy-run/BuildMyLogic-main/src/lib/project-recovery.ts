import type { BuildSessionState, LoopState } from "./loop-types";
import { isLiteralRepairEvidence } from "./project-evidence.ts";
export type ProjectRecheckBinding = {
  version: 1;
  owner_id: string;
  source_session_id: string;
  challenge_id: string;
  source_digest: string;
  test_digest: string;
  cases_digest: string;
  partition_digest: string;
  function_name: string;
  arguments: string[];
};
export type ProjectRecoveryReview = {
  binding: ProjectRecheckBinding;
  pattern_id: string;
  prediction: number;
  reviewed_at: number;
  lesson_version: "project-test-repair-v1";
};
export type ProjectRecheckReceipt = {
  id: string;
  binding: ProjectRecheckBinding;
  at: number;
  passed: number;
  total: number;
  output: string;
  provenance: "extension-reported";
  test_source: "reviewed-existing-tests";
};
export type PartitionedRepair = {
  partition?: {
    version: 1;
    initial_indices: number[];
    recheck_indices: number[];
    partition_digest: string;
    source_session_id: string;
  };
  constructs?: string[];
};
export const PROJECT_RECOVERY_PREDICTION = {
  question:
    "A function passes two reviewed inputs. What can you conclude about a different input?",
  options: [
    "It must pass every other input.",
    "It still needs a check against that input's expected result.",
    "The whole project is correct.",
  ],
  correct: 1,
  model:
    "A finite pass supports only the inputs checked. Review the expected behavior, then run different inputs. Existing tests may have been read before, so a changed-input pass is not proof of independent work or general mastery.",
};
export function sameProjectBinding(
  a: ProjectRecheckBinding | null | undefined,
  b: ProjectRecheckBinding | null | undefined,
): boolean {
  return (
    !!a &&
    !!b &&
    [
      "version",
      "owner_id",
      "source_session_id",
      "challenge_id",
      "source_digest",
      "test_digest",
      "cases_digest",
      "partition_digest",
      "function_name",
    ].every(
      (k) =>
        a[k as keyof ProjectRecheckBinding] ===
        b[k as keyof ProjectRecheckBinding],
    ) &&
    Array.isArray(a.arguments) &&
    Array.isArray(b.arguments) &&
    JSON.stringify(a.arguments) === JSON.stringify(b.arguments)
  );
}
export function projectBinding(
  remote: BuildSessionState,
): ProjectRecheckBinding | null {
  if (!isLiteralRepairEvidence(remote)) return null;
  const c = remote.project_context!,
    r = c.repair_contract!,
    p = (r as typeof r & PartitionedRepair).partition;
  if (
    !p ||
    p.version !== 1 ||
    p.source_session_id !== remote.session_id ||
    !/^[a-f0-9]{64}$/.test(p.partition_digest) ||
    !Array.isArray(p.initial_indices) ||
    p.initial_indices.length < 2 ||
    !Array.isArray(p.recheck_indices) ||
    p.recheck_indices.length !== 2
  )
    return null;
  const all = [...p.initial_indices, ...p.recheck_indices];
  if (
    all.length !== c.test_cases ||
    new Set(all).size !== all.length ||
    !all.every((i) => Number.isInteger(i) && i >= 0 && i < all.length)
  )
    return null;
  return {
    version: 1,
    owner_id: remote.verified_owner_id!,
    source_session_id: remote.session_id,
    challenge_id: remote.challenge_id,
    source_digest: r.source_digest,
    test_digest: c.test_digest!,
    cases_digest: r.cases_digest,
    partition_digest: p.partition_digest,
    function_name: r.function_name,
    arguments: [...r.arguments],
  };
}
/** Dedicated project-test lesson selector; no invented general-purpose C/Python exercise. */
export function projectRecoverySessions(
  state: LoopState,
  owner: string,
  sessionId?: string | undefined,
): BuildSessionState[] {
  if (state.sampleProvenance) return [];
  return Object.values(state.projectSessions ?? {}).filter(
    (remote) =>
      remote.verified_owner_id === owner &&
      isLiteralRepairEvidence(remote) &&
      (!sessionId || remote.session_id === sessionId) &&
      state.struggle?.misconceptions.some(
        (m) =>
          !m.synthetic &&
          m.sourceSessionId === remote.session_id &&
          m.recoveryOwnerId === owner &&
          m.occurrences >= 2,
      ),
  );
}
export function projectRecoveryPattern(
  state: LoopState,
  remote: BuildSessionState,
  owner: string,
) {
  if (
    state.sampleProvenance ||
    remote.verified_owner_id !== owner ||
    !isLiteralRepairEvidence(remote)
  )
    return null;
  return (
    state.struggle?.misconceptions.find(
      (m) =>
        !m.synthetic &&
        m.status === "locked" &&
        m.occurrences >= 2 &&
        m.sourceSessionId === remote.session_id &&
        m.sourceMissionId === remote.challenge_id &&
        m.recoveryOwnerId === owner &&
        m.topicId === `project-test-repair:owner:${owner}`,
    ) ?? null
  );
}
/** Saved client learning evidence, not a server-graded claim about mental state. */
export function validProjectReview(
  state: LoopState,
  remote: BuildSessionState,
  owner: string,
): ProjectRecoveryReview | null {
  const b = projectBinding(remote),
    p = projectRecoveryPattern(state, remote, owner),
    r = state.projectRecoveryReviews?.[remote.session_id];
  if (
    !b ||
    !p ||
    !r ||
    !sameProjectBinding(r.binding, b) ||
    r.pattern_id !== p.id ||
    r.lesson_version !== "project-test-repair-v1" ||
    r.prediction !== PROJECT_RECOVERY_PREDICTION.correct ||
    !Number.isFinite(r.reviewed_at) ||
    r.reviewed_at <= 0 ||
    r.reviewed_at < (p.lockedAt ?? p.lastSeenAt) ||
    remote.status !== "completed" ||
    !remote.test_score ||
    remote.test_score.total < 1 ||
    remote.test_score.passed !== remote.test_score.total
  )
    return null;
  return r;
}
/** Repeat enable is idempotent: preserve the review that the saved readiness follows. */
export function reviewProjectRecovery(
  state: LoopState,
  remote: BuildSessionState,
  owner: string,
  prediction: number,
  at = Date.now(),
): LoopState {
  if (validProjectReview(state, remote, owner)) return state;
  const binding = projectBinding(remote),
    pattern = projectRecoveryPattern(state, remote, owner);
  if (
    !binding ||
    !pattern ||
    remote.status !== "completed" ||
    prediction !== PROJECT_RECOVERY_PREDICTION.correct ||
    !Number.isFinite(at) ||
    at < (pattern.lockedAt ?? pattern.lastSeenAt)
  )
    return state;
  return {
    ...state,
    projectRecoveryReviews: {
      ...state.projectRecoveryReviews,
      [remote.session_id]: {
        binding,
        pattern_id: pattern.id,
        prediction,
        reviewed_at: at,
        lesson_version: "project-test-repair-v1",
      },
    },
  };
}
/** Apply only a bound receipt after a saved lesson. Existing finite repair passes never unlock this. */
export function ingestProjectRechecks(
  state: LoopState,
  remote: BuildSessionState,
): LoopState {
  const binding = projectBinding(remote),
    review = validProjectReview(state, remote, remote.verified_owner_id ?? "");
  if (!binding || !review || !state.struggle) return state;
  const ready = remote.project_recheck_ready;
  if (
    !ready ||
    !sameProjectBinding(ready.binding, binding) ||
    !Number.isFinite(ready.at) ||
    ready.at < review.reviewed_at
  )
    return state;
  const pattern = projectRecoveryPattern(state, remote, binding.owner_id);
  if (!pattern) return state;
  const receipts = Array.isArray(remote.project_recheck_receipts)
    ? remote.project_recheck_receipts
    : [];
  let struggle = state.struggle;
  for (const receipt of receipts) {
    if (!receipt || typeof receipt !== "object") continue;
    const key = `project-recheck:${receipt.id}`;
    if (
      typeof receipt.id !== "string" ||
      !receipt.id ||
      !sameProjectBinding(receipt.binding, binding) ||
      receipt.provenance !== "extension-reported" ||
      receipt.test_source !== "reviewed-existing-tests" ||
      !Number.isFinite(receipt.at) ||
      receipt.at < ready.at ||
      receipt.total !== 2 ||
      !Number.isInteger(receipt.passed) ||
      receipt.passed < 0 ||
      receipt.passed > 2 ||
      struggle.ingestedSessions.includes(key)
    )
      continue;
    const fullPass = receipt.passed === receipt.total;
    if (
      typeof receipt.output !== "string" ||
      (fullPass &&
        ![
          "BML_LITERAL_RECHECK_V1_PASS",
          "BML_PINNED_TEST_" + binding.test_digest,
          "BML_PARTITION_" + binding.partition_digest,
        ].every((marker) => receipt.output.split(/\r?\n/).includes(marker)))
    )
      continue;
    if (!fullPass) {
      const match = receipt.output.match(
        /^Reviewed changed-input cases failed: ([0-9]+(?:,[0-9]+)*)$/,
      );
      const failed = match ? match[1]!.split(",").map(Number) : [];
      const reserved =
        remote.project_context!.repair_contract!.partition!.recheck_indices.map(
          (i) => i + 1,
        );
      if (
        !failed.length ||
        new Set(failed).size !== failed.length ||
        failed.some((i) => !reserved.includes(i)) ||
        receipt.passed !== 2 - failed.length
      )
        continue;
    }
    const attempt = {
      id: key,
      topicId: pattern.topicId,
      topicTitle: pattern.topicTitle,
      language: pattern.language,
      exerciseTitle: "Changed-input project recheck (reviewed existing tests)",
      at: receipt.at,
      passed: receipt.passed,
      total: receipt.total,
      fullPass,
      kind: fullPass ? null : ("logic" as const),
      failingTests: fullPass ? [] : ["Changed-input existing project tests"],
      signature: fullPass ? null : pattern.signature,
      source: "reassessment" as const,
    };
    struggle = {
      ...struggle,
      attempts: [attempt, ...struggle.attempts]
        .sort((a, b) => b.at - a.at)
        .slice(0, 120),
      ingestedSessions: [...struggle.ingestedSessions, key],
      misconceptions: struggle.misconceptions.map((m) =>
        m.id === pattern.id
          ? {
              ...m,
              ...(fullPass
                ? {
                    status: "conquered" as const,
                    conqueredAt: receipt.at,
                    reassessed: true,
                    failuresToConquer: m.occurrences,
                    timeToConquerMs: Math.max(0, receipt.at - m.firstSeenAt),
                    projectRecheckReceiptId: receipt.id,
                  }
                : {}),
            }
          : m,
      ),
    };
  }
  return struggle === state.struggle ? state : { ...state, struggle };
}
