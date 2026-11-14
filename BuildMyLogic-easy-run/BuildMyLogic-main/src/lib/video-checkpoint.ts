// Video-only, in-memory playback state. No learning, code or account data is changed.
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
export function sectionLength(duration: number): number {
  return Number.isFinite(duration) && duration >= 3600 ? 240 : 120;
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
export function rewindSection(
  s: VideoProgress,
  duration: number,
): { state: VideoProgress; seek: number } {
  const seek = sectionStart(s.position, duration);
  return { state: { ...s, position: seek, sampledAt: null }, seek };
}
