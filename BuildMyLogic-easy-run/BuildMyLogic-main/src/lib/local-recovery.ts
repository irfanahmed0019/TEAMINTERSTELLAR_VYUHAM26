import type { LoopState } from "./loop-types";
export const RECOVERY_OWNER_KEY = "loop.recovery.owner";
export const RETAINED_PREFIX = "loop.state.retained.";
export function hasLocalWork(s: LoopState): boolean {
  return !!(
    s.profile ||
    s.plan ||
    s.onboarded ||
    s.sessions.length ||
    s.activity.length ||
    s.struggle?.attempts.length ||
    Object.keys(s.learningChats ?? {}).length ||
    s.assessmentEvidence?.length ||
    Object.keys(s.videoProgress ?? {}).length ||
    Object.keys(s.missionProgress ?? {}).length ||
    Object.keys(s.skillMemory ?? {}).length ||
    s.struggle?.misconceptions.length
  );
}
export function requiresAccountRecovery(
  cached: string | null,
  incoming: string | null,
  state: LoopState,
): boolean {
  return !!incoming && cached !== incoming && hasLocalWork(state);
}
/** A sign-out may clear data only after a same-owner save, or explicit local discard. */
export async function prepareSafeSignOut(o: {
  owner: string;
  current: () => string | undefined;
  save: () => Promise<boolean>;
  confirmDiscard: () => boolean;
  unchanged?: () => boolean;
}): Promise<boolean> {
  try {
    if (o.current() !== o.owner) return false;
    if (await o.save())
      return o.current() === o.owner && (o.unchanged?.() ?? true);
  } catch {
    /* Offline: only an explicit discard can allow clearing. */
  }
  return o.current() === o.owner && o.confirmDiscard();
}

export function blockSignedOutRecovery(
  pending: string | null,
  cached: string | null,
  state: LoopState,
  keys: string[],
): boolean {
  return (
    !!pending ||
    keys.some((k) => k.startsWith(RETAINED_PREFIX)) ||
    hasLocalWork(state)
  );
}
export function canDiscardRecovery(
  cached: string | null,
  pending: string | null,
  current: string | undefined,
  ownArchive: boolean,
): boolean {
  return (
    !!current &&
    (ownArchive ||
      ((pending === current || pending === "unbound" || !cached) &&
        (!cached || cached === current)))
  );
}
