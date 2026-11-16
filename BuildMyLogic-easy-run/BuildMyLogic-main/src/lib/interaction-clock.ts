/** Interaction-window estimate, not proof of attention, thinking time or authorship. */
export type InteractionClock = {
  activeMs: number;
  lastAt: number | null;
  activityAt: number | null;
  running: boolean;
};
export const INTERACTION_IDLE_MS = 30_000;
export function newInteractionClock(activeMs = 0): InteractionClock {
  return {
    activeMs: Number.isFinite(activeMs) ? Math.max(0, activeMs) : 0,
    lastAt: null,
    activityAt: null,
    running: false,
  };
}
export function sampleInteractionClock(
  c: InteractionClock,
  now: number,
  eligible: boolean,
): InteractionClock {
  if (!Number.isFinite(now)) return c;
  const end =
    c.activityAt === null
      ? now
      : Math.min(now, c.activityAt + INTERACTION_IDLE_MS);
  const delta =
    c.running && c.lastAt !== null && c.activityAt !== null && eligible
      ? Math.max(0, end - c.lastAt)
      : 0;
  return { ...c, activeMs: c.activeMs + delta, lastAt: now };
}
export function interactClock(
  c: InteractionClock,
  now: number,
  eligible: boolean,
): InteractionClock {
  const sampled = sampleInteractionClock(c, now, eligible);
  return { ...sampled, activityAt: eligible ? now : null };
}
export function startInteractionClock(
  c: InteractionClock,
  now: number,
): InteractionClock {
  return { ...c, running: true, lastAt: now, activityAt: now };
}
export function pauseInteractionClock(
  c: InteractionClock,
  now: number,
  eligible: boolean,
): InteractionClock {
  return {
    ...sampleInteractionClock(c, now, eligible),
    running: false,
    lastAt: null,
    activityAt: null,
  };
}
