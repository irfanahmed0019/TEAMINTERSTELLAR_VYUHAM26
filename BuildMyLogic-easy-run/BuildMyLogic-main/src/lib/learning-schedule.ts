import type { Profile } from "./loop-types";
/** Weekly availability is a report, never a chosen daily calendar window. */
export function learningSchedule(profile: Profile | null | undefined) {
  const clock = (s?: string) =>
    typeof s === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(s);
  const exact =
    !profile?.scheduleUnspecified &&
    clock(profile?.startTime) &&
    clock(profile?.endTime);
  const reported = profile?.availabilityText?.trim() ?? "";
  return {
    exact,
    reported,
    brief: exact
      ? `Chosen build window: ${profile!.startTime}-${profile!.endTime}${profile!.repeatDaily ? " (daily preference)" : " (not a daily commitment)"}. No calendar booking is implied.`
      : `Reported availability: ${reported || "not stated"}. No exact daily start/end time or recurrence was chosen. Do not invent one; suggested task lengths are estimates, not a calendar commitment.`,
    banner: exact
      ? `Your preferred window is ${profile!.startTime}-${profile!.endTime}. Choose a date and review recurrence before adding it to your calendar.`
      : `${reported ? `You reported: ${reported}. ` : ""}Choose a start/end time and recurrence before adding a calendar reminder. No daily window is set.`,
    next: exact
      ? `Preferred time ${profile!.startTime}; date not scheduled`
      : "Time not scheduled",
  };
}
