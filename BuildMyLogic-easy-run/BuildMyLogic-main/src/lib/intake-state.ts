import type { Profile } from "./loop-types";

export const intakePrompts = [
  "What would you like to learn or build? Tell me your goal in your own words.",
  "What's your current experience level? For example, complete beginner, know some basics, or already building projects.",
  "How much time can you realistically spend learning each week, and which area should we focus on first?",
];

/** Only restore answers to this intake, never infer answers from resume claims. */
export function restoreIntake(profile: Profile | null) {
  const answers: string[] = [];
  for (const question of intakePrompts) {
    const answer = profile?.followUps
      .find((item) => item.question === question)
      ?.answer.trim();
    if (!answer) break;
    answers.push(answer);
  }
  // Older intake versions stored only the last two answers after chat completion.
  const legacyComplete =
    !!profile?.goalDetail &&
    intakePrompts
      .slice(1)
      .every((question) =>
        profile.followUps.some(
          (item) => item.question === question && item.answer.trim(),
        ),
      );
  return {
    answers,
    stage:
      answers.length === intakePrompts.length || legacyComplete
        ? ("plan" as const)
        : ("chat" as const),
  };
}

/** Save partial chat in the existing profile, retaining unrelated profile fields. */
export function saveIntakeAnswers(
  profile: Profile,
  answers: string[],
): Profile {
  return {
    ...profile,
    followUps: [
      ...profile.followUps.filter(
        (item) => !intakePrompts.includes(item.question),
      ),
      ...answers
        .slice(0, intakePrompts.length)
        .map((answer, index) => ({ question: intakePrompts[index]!, answer })),
    ],
  };
}

export function diagnosticContinueLabel(
  d?: Profile["initialDiagnostic"],
): string {
  if (d?.status === "completed") return "Build roadmap from these checks";
  if (d?.answers.length)
    return `Continue with ${d.answers.length} provisional checks`;
  return "Continue with an unassessed profile";
}
