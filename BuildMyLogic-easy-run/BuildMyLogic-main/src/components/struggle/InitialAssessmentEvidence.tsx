import { useAuth } from "@/lib/auth";
import { useCloudHydrated } from "@/lib/cloud-sync";
import { initialAssessmentView } from "@/lib/initial-assessment-view";
import { performanceSummary } from "@/lib/performance-evidence";
import type { AssessmentEvidence } from "@/lib/assessment-evidence";
/** Display the existing evidence once. Does not synthesize a second practice attempt. */
export function InitialAssessmentEvidence({
  evidence,
}: {
  evidence: AssessmentEvidence[];
}) {
  const auth = useAuth();
  const hydrated = useCloudHydrated(auth?.uid);
  const checks = initialAssessmentView(evidence, auth?.uid, hydrated);
  if (!checks.length) return null;
  return (
    <section className="card-surface p-5" aria-label="Initial coding evidence">
      <h2 className="text-base font-extrabold">Initial coding evidence</h2>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        Finite server-graded output checks from onboarding. These already
        contribute to the shared competency view; displaying them here does not
        count them again. One failed check is not a proven weakness. No failure
        pattern or conquest is invented from this list.
      </p>
      <div className="mt-4 space-y-3">
        {checks.map((e) => (
          <article key={e.id} className="rounded-xl border p-3">
            <h3 className="text-sm font-bold">
              {e.skill}
              {e.language ? ` (${e.language.toUpperCase()})` : ""}: {e.passed}/
              {e.total} output checks
            </h3>
            <p className="mt-1 text-xs">
              Hints reported: {e.hintsUsed}. {new Date(e.at).toLocaleString()}.
              Source: {e.source}.
            </p>
            <p className="mt-2 text-xs leading-5">
              {
                performanceSummary({
                  passed: e.passed,
                  total: e.total,
                  performance: e.performance,
                }).text
              }
            </p>
            {e.performance && (
              <p className="mt-2 text-xs">
                Authored benchmark:{" "}
                {e.performance.expectedMs
                  ? `${e.performance.expectedMs / 60000} min`
                  : "unavailable"}
                . Observed interaction:{" "}
                {e.performance.timingQuality ===
                  "browser-interaction-observed" &&
                e.performance.activeMs !== undefined
                  ? `${Math.round(e.performance.activeMs / 1000)} sec, browser-reported estimate`
                  : "unavailable"}
                . Independent authorship and general mastery remain unverified.
              </p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
