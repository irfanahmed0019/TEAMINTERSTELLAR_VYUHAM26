/**
 * Account-isolation guard for the local loop-state cache.
 *
 * localStorage is shared by every account on this browser. Sign-out clears
 * the cached state, but a direct account switch without sign-out would
 * otherwise let the previous account's local state become the new account's
 * baseline and then autosave into the new account's cloud row.
 */
export const LOOP_STATE_UID_KEY = "loop.state.uid";

/**
 * True when the incoming signed-in uid differs from the uid that owns the
 * local cache. A missing marker has unknown ownership and is not imported into a signed-in account.
 * The caller preserves that legacy cache separately before resetting.
 */
export function localStateBelongsToOtherAccount(
  cachedUid: string | null,
  incomingUid: string | null,
): boolean {
  return !!incomingUid && cachedUid !== incomingUid;
}
