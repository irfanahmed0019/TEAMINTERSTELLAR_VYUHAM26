import type { LoopState } from "./loop-types";
/** Count recorded learning, not visits/chat/plan edits. Failures are genuine practice too. */
export function learningActivityTimes(state: LoopState, now: number): number[] {
  if (state.sampleProvenance) return [];
  const times: number[] = [];
  const add = (at: number) => {
    if (Number.isFinite(at) && at > 0 && at <= now) times.push(at);
  };
  for (const s of state.sessions ?? [])
    if (!s.synthetic && Number.isFinite(s.minutes) && s.minutes > 0) add(s.at);
  for (const a of state.struggle?.attempts ?? [])
    if (
      !a.synthetic &&
      Number.isInteger(a.total) &&
      a.total > 0 &&
      Number.isInteger(a.passed) &&
      a.passed >= 0 &&
      a.passed <= a.total
    )
      add(a.at);
  for (const a of state.assessmentEvidence ?? [])
    if (
      Number.isInteger(a.total) &&
      a.total > 0 &&
      Number.isInteger(a.passed) &&
      a.passed >= 0 &&
      a.passed <= a.total
    )
      add(a.at);
  for (const v of Object.values(state.videoProgress ?? {}))
    for (const r of v.results ?? [])
      if (
        typeof r.correct === "boolean" &&
        Number.isInteger(r.section) &&
        r.section >= 0
      )
        add(r.at);
  return times;
}
/** Calendar-day ordinals in the viewer's local timezone avoid UTC-midnight and DST errors. */
export function learningStreak(
  state: LoopState,
  now = Date.now(),
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
) {
  const format = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const day = (at: number) => {
    const p = format.formatToParts(at),
      get = (type: string) => Number(p.find((x) => x.type === type)!.value);
    return Date.UTC(get("year"), get("month") - 1, get("day")) / 86400000;
  };
  const today = day(now),
    days = new Set(learningActivityTimes(state, now).map(day));
  let cursor = days.has(today) ? today : today - 1,
    count = 0;
  while (days.has(cursor)) {
    count++;
    cursor--;
  }
  const week = Array.from({ length: 7 }, (_, i) => {
    const ordinal = today - 6 + i;
    return {
      key: String(ordinal),
      label: new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        timeZone: "UTC",
      }).format(ordinal * 86400000),
      active: days.has(ordinal),
      today: ordinal === today,
    };
  });
  return { count, activeToday: days.has(today), week, timeZone };
}
