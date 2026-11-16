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

/** Ask about stated learning context, never guess personal or sensitive identity. */
export function relevantIntakePrompt(
  index: number,
  answers: string[],
  profile?: Profile | null,
): string {
  if (index === 0)
    return "Tell me your background and goal: are you studying, working, changing careers, or exploring? What would you like to learn or build? You can skip any personal detail.";
  const stated = answers[0] ?? "";
  const matched = stated.match(
    /\b(python|javascript|typescript|java|react|django|html|css|machine learning|data science)\b/i,
  )?.[0];
  const topic = matched ?? profile?.technologies?.[0]?.name;
  const context = topic ? ` with ${topic}` : " in the area you want to learn";
  if (index === 1)
    return /\b(job|career|interview)\b/i.test(stated)
      ? `Which role are you aiming for, and what have you already built or practiced${context}? It's fine if you are starting from zero.`
      : `What have you tried${context}? Tell me one thing you can do and one thing you get stuck on, or say you are a complete beginner.`;
  return `How much time can you realistically spend each week? Which small ${topic ? topic + " " : ""}task would you like to tackle first?`;
}
