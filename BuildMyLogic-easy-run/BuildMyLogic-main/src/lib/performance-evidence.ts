import type { PracticeAttempt } from "./struggle-engine";
export function performanceSummary(
  a: Pick<PracticeAttempt, "passed" | "total" | "performance">,
) {
  const p = a.performance;
  const expected = p?.expectedMs;
  const active = p?.activeMs;
  const usable =
    p?.timingQuality === "extension-observed" &&
    Number.isFinite(active) &&
    active! >= 0 &&
    Number.isFinite(expected) &&
    expected! > 0;
  const ratio = usable ? active! / expected! : null;
  const correct = a.total > 0 && a.passed === a.total;
  const hinted = (p?.hintsUsed ?? 0) > 0;
  const result = correct
    ? hinted
      ? "Checks pass with recorded hints. Try a fresh check with less help."
      : "Checks pass. Independence still needs fresh evidence."
    : "Some requirements are not passing. Inspect the failing tests before judging speed.";
  const time =
    ratio === null
      ? "Active solving time is unavailable."
      : ratio > 1
        ? `Observed work took ${ratio.toFixed(2)}× the expected time. Correct but slower work is not automatically weak.`
        : `Observed work took ${ratio.toFixed(2)}× the expected time. Speed does not establish correctness.`;
  return {
    ratio,
    deltaMs: usable ? active! - expected! : null,
    text: `${result} ${time}`,
    correct,
    hinted,
  };
}
