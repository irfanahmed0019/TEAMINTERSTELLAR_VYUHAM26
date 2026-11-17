/** Mirrors the existing consented foreground timing cap. No new pause policy. */
export const IDLE_WINDOW_MS = 30_000;
export function sessionActivityClock(input: {
  now: number;
  activityAt: number;
  consent: boolean;
  focused: boolean;
  paused: boolean;
  finished: boolean;
}) {
  if (!input.consent)
    return {
      state: "off",
      seconds: 0,
      text: "Activity timing off - session evidence not shared",
    };
  if (input.finished)
    return {
      state: "finished",
      seconds: 0,
      text: "Session complete - AFK countdown stopped",
    };
  if (input.paused)
    return {
      state: "paused",
      seconds: 0,
      text: "Session paused - no active-time credit",
    };
  if (!input.focused)
    return { state: "afk", seconds: 0, text: "AFK - VS Code is not focused" };
  if (!input.activityAt)
    return {
      state: "afk",
      seconds: 0,
      text: "AFK - waiting for a foreground edit or run",
    };
  const left = Math.max(
    0,
    IDLE_WINDOW_MS - Math.max(0, input.now - input.activityAt),
  );
  const seconds = Math.ceil(left / 1000);
  return seconds
    ? {
        state: "active",
        seconds,
        text: `AFK in ${seconds}s without an edit or run`,
      }
    : {
        state: "afk",
        seconds: 0,
        text: "AFK - idle limit reached; no active-time credit",
      };
}
