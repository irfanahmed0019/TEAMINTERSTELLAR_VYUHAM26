/** Transport evidence only. Infrastructure errors never become learner failures. */
export function validateJudge0Results(
  tokens: string[],
  rows: { token: string; status?: { id: number; description: string } }[],
): void {
  if (
    rows.length !== tokens.length ||
    new Set(rows.map((r) => r.token)).size !== tokens.length ||
    rows.some((r) => !tokens.includes(r.token))
  )
    throw new Error(
      "The code sandbox returned mismatched results. Your code was not graded.",
    );
  if (
    rows.some(
      (r) =>
        !Number.isInteger(r.status?.id) ||
        r.status!.id < 3 ||
        r.status!.id > 12,
    )
  )
    throw new Error(
      "The code sandbox could not complete execution reliably. Your code was not graded. Try again shortly.",
    );
}
