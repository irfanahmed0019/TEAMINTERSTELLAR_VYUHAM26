/**
 * Staged dashboard reveal shown right after a new learner presses "I'm Ready".
 *
 * While the app persists the freshly researched learning plan (topics, missions,
 * progress tracking), the learner watches their real dashboard assemble section
 * by section - greeting, daily rhythm, first task, progress, learning path.
 * Timings mirror the ~12 second reference the owner approved: same staged
 * animation, pauses removed, no extra effects.
 */

export type RevealStage = {
  /** Milliseconds after the reveal starts when this section appears. */
  at: number;
  /** Short caption describing what the app is working on at that moment. */
  caption: string;
};

export const REVEAL_STAGES: RevealStage[] = [
  { at: 0, caption: "Saving your personalized learning plan…" },
  { at: 1000, caption: "Setting up your dashboard…" },
  { at: 3300, caption: "Preparing your daily learning rhythm…" },
  { at: 5500, caption: "Placing your first task…" },
  { at: 7500, caption: "Setting up your progress tracking…" },
  { at: 9300, caption: "Building your learning path…" },
];

/** Total reveal length before the real dashboard opens. About 12 seconds. */
export const REVEAL_TOTAL_MS = 11600;

/** Time-of-day greeting, same rule as the real dashboard header. */
export function revealGreeting(date: Date = new Date()): string {
  const hour = date.getHours();
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

/** Stage indexes visible once `elapsed` milliseconds have passed. */
export function visibleStages(elapsed: number): number {
  let count = 0;
  for (const stage of REVEAL_STAGES) if (elapsed >= stage.at) count += 1;
  return count;
}
