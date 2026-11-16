// Pure playback guards. Completed question checkpoints are persisted by the learner-state adapter.
export type VideoProgress = {
  watched: number;
  position: number;
  sampledAt: number | null;
};
export const initialVideoProgress = (): VideoProgress => ({
  watched: 0,
  position: 0,
  sampledAt: null,
});
export function sectionLength(_duration: number): number {
  // Irfan, 2026-11-16: every video is divided into 2-minute checkpoints,
  // whatever its length.
  return 120;
}
export function sectionStart(position: number, duration: number): number {
  const length = sectionLength(duration);
  const safe = Math.max(0, Math.min(position, Math.max(0, duration - 0.01)));
  return Math.floor(safe / length) * length;
}
export function sampleVideo(
  s: VideoProgress,
  position: number,
  now: number,
  playing: boolean,
  present: boolean,
): { state: VideoProgress; seek: number | null } {
  if (!Number.isFinite(position) || position < 0)
    return { state: s, seek: null };
  const elapsed =
    s.sampledAt === null
      ? 0
      : Math.max(0, Math.min(2, (now - s.sampledAt) / 1000));
  // Accept normal playback (including 2x), never a jump into unwatched content.
  const allowance = playing && present ? elapsed * 2 : 0;
  const jumped = position > s.watched + allowance + 0.75;
  if (jumped)
    return {
      state: { ...s, position: s.position, sampledAt: now },
      seek: s.position,
    };
  const watched =
    playing && present
      ? Math.max(s.watched, Math.min(position, s.watched + allowance))
      : s.watched;
  return { state: { watched, position, sampledAt: now }, seek: null };
}
export type ReplayScope = "section" | "video";

// Pause and recover only after strictly more than four continuous seconds absent.
export const PAUSE_AFTER_MS = 4000;
export const REPLAY_AFTER_MS = 4000;
export type AbsenceState = { paused: boolean; rewound: boolean };
export function absenceAction(
  awayMs: number,
  s: AbsenceState,
): "pause" | "replay" | null {
  // Replay wins when a missed tick jumps past both thresholds; the caller
  // pauses first and never plays while the learner is away.
  if (!s.rewound && awayMs > REPLAY_AFTER_MS) return "replay";
  if (!s.paused && awayMs > PAUSE_AFTER_MS) return "pause";
  return null;
}
export function rewindSection(
  s: VideoProgress,
  duration: number,
  scope: ReplayScope = "section",
): { state: VideoProgress; seek: number } {
  const seek = scope === "video" ? 0 : sectionStart(s.watched, duration);
  return { state: { ...s, position: seek, sampledAt: null }, seek };
}
