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
const codeLanguages = new Set([
  "python",
  "c",
  "cpp",
  "java",
  "javascript",
  "typescript",
  "javascriptreact",
  "typescriptreact",
  "go",
  "rust",
  "csharp",
  "kotlin",
  "swift",
  "php",
  "ruby",
  "html",
  "css",
  "sql",
]);
/** Heuristic only. Content is inspected transiently, never retained or uploaded. */
export function largeCodeInsertion(
  changes: readonly { text: string; rangeLength?: number }[],
  language: string,
  undoOrRedo: boolean,
) {
  if (undoOrRedo || !codeLanguages.has(language)) return undefined;
  // Several small edits, replacements and formatting are not one insertion.
  if (changes.length !== 1 || (changes[0].rangeLength ?? 0) !== 0)
    return undefined;
  const characters = changes[0].text.length;
  const lines = changes[0].text ? changes[0].text.split(/\r?\n/).length : 0;
  if (characters < 400 && !(characters >= 120 && lines >= 3)) return undefined;
  return { characters, lines };
}
