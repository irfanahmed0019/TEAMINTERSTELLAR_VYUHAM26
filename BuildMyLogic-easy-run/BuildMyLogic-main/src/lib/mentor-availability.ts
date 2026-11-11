import { useSyncExternalStore } from "react";

/**
 * Shared mentor availability signal.
 *
 * Truth rules: "ready" only means the server reports an AI key configured
 * (a non-billable check that never calls the provider). "online" is earned
 * by a real user-initiated mentor request succeeding; "offline" by one
 * failing or by missing configuration. No per-visit billable probe.
 */
export type MentorAvailability = "checking" | "ready" | "online" | "offline";

export type MentorAvailabilitySnapshot = {
  state: MentorAvailability;
  reason: string | null;
};

let snapshot: MentorAvailabilitySnapshot = { state: "checking", reason: null };
const listeners = new Set<() => void>();

export function setMentorAvailability(state: MentorAvailability, reason: string | null = null) {
  snapshot = { state, reason };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const serverSnapshot: MentorAvailabilitySnapshot = { state: "checking", reason: null };

export function useMentorAvailability(): MentorAvailabilitySnapshot {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => serverSnapshot,
  );
}
