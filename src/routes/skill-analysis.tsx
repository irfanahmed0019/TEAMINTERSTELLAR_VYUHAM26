/**
 * Skill Analysis (kernel section 10): an evidence-backed competency
 * dashboard - mastery levels, assessment history, strengths, weak areas,
 * repeated misconceptions and reassessments due. Scores come only from
 * recorded evidence; nothing here is an unsupported AI percentage.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, RotateCcw } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useLoop } from "@/lib/loop-store";
import {
  COMPETENCY_LABELS,
  emptyAf05,
  SKILL_LABELS,
  type CompetencyState,
} from "@/lib/af05/types";
import { dueRevisions, gapAnalysis } from "@/lib/af05/engine";

export const Route = createFileRoute("/skill-analysis")({
  head: () => ({ meta: [{ title: "Skill Analysis - BuildMyLogic" }] }),
  component: SkillAnalysisPage,
});

const BAR_COLORS: Record<CompetencyState, string> = {
  not_assessed: "bg-border",
  beginner: "bg-destructive",
  developing: "bg-amber-500",
  proficient: "bg-success",
  mastered: "bg-success",
};

function SkillAnalysisPage() {
  const af05 = useLoop().af05 ?? emptyAf05;
  const gaps = gapAnalysis(af05);
  const assessed = gaps.filter((g) => g.assessed);
  const strengths = assessed.filter(
    (g) => g.state === "proficient" || g.state === "mastered",
  );
  const weak = assessed.filter(
    (g) => g.state === "beginner" || g.state === "developing",
  );
  const activeMisconceptions = Object.values(af05.misconceptions)
    .filter((m) => m.status === "active")
    .sort((a, b) => b.count - a.count);
  const due = dueRevisions(af05);
  const history = [...af05.assessmentHistory].reverse().slice(0, 12);

  return (
    <AppShell
      crumb="Skill Analysis"
      title="Your competency map."
      subtitle="Every level here is computed from your recorded evidence - executed tests, scored answers and reassessments. Unassessed skills are shown honestly as unknown."
    >
      {assessed.length === 0 ? (
        <section className="card-surface p-10 text-center">
          <h2 className="display text-xl font-bold">No evidence yet.</h2>
          <p className="mx-auto mt-2 max-w-md text-[14px] text-muted-foreground">
            Take the diagnostic assessment and your competency map will fill in
            with real measurements.
          </p>
          <Link
            to="/assessment"
            className="btn-base btn-primary-solid mt-5 inline-flex items-center gap-2"
          >
            Start the diagnostic <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="card-surface p-6">
            <h2 className="display text-lg font-bold">Skill mastery</h2>
            <div className="mt-4 space-y-4">
              {gaps.map((g) => (
                <div key={g.skill}>
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="font-medium">{g.label}</span>
                    <span className="text-muted-foreground">
                      {g.assessed
                        ? `${COMPETENCY_LABELS[g.state]} - evidence score ${g.score}/100`
                        : "Not assessed"}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-all ${BAR_COLORS[g.state]}`}
                      style={{
                        width: `${g.assessed ? Math.max(g.score, 4) : 0}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-[12px] leading-5 text-muted-foreground">
              Mastery requires practical execution evidence plus a passed
              delayed reassessment - a single good quiz is never enough.
            </p>
          </section>

          <div className="space-y-6">
            <section className="card-surface p-6">
              <h2 className="display text-lg font-bold">
                Strengths & weak areas
              </h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-success/25 bg-success/5 p-4">
                  <p className="text-[13px] font-semibold text-success">
                    Strengths
                  </p>
                  {strengths.length === 0 ? (
                    <p className="mt-1 text-[13px] text-muted-foreground">
                      None proven yet.
                    </p>
                  ) : (
                    <ul className="mt-1 space-y-1 text-[13px]">
                      {strengths.map((g) => (
                        <li key={g.skill}>{g.label}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
                  <p className="text-[13px] font-semibold text-amber-800">
                    Needs work
                  </p>
                  {weak.length === 0 ? (
                    <p className="mt-1 text-[13px] text-muted-foreground">
                      No weak assessed skills.
                    </p>
                  ) : (
                    <ul className="mt-1 space-y-1 text-[13px] text-amber-900">
                      {weak.map((g) => (
                        <li key={g.skill}>
                          {g.label} ({COMPETENCY_LABELS[g.state]})
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </section>

            <section className="card-surface p-6">
              <h2 className="display text-lg font-bold">
                Repeated misconceptions
              </h2>
              {activeMisconceptions.length === 0 ? (
                <p className="mt-2 text-[13px] text-muted-foreground">
                  No active misconceptions on record.
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {activeMisconceptions.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-start gap-3 rounded-xl border border-border px-4 py-3"
                    >
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                      <div className="flex-1">
                        <p className="text-[13px] font-medium">{m.label}</p>
                        <p className="text-[12px] text-muted-foreground">
                          {SKILL_LABELS[m.skill]} - seen {m.count}x -{" "}
                          {m.severity} severity
                        </p>
                      </div>
                      <Link
                        to="/practice"
                        className="text-[12px] font-semibold text-accent-foreground"
                      >
                        Practise
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="card-surface p-6">
              <h2 className="display text-lg font-bold">Reassessments due</h2>
              {due.length === 0 ? (
                <p className="mt-2 text-[13px] text-muted-foreground">
                  Nothing due right now.
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {due.map((r) => (
                    <Link
                      key={r.id}
                      to="/reassess"
                      className="flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5"
                    >
                      <RotateCcw className="h-4 w-4 text-amber-700" />
                      <span className="text-[13px] font-medium text-amber-900">
                        {SKILL_LABELS[r.skill]} -{" "}
                        {r.concept.replaceAll("_", " ")}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {history.length > 0 && (
        <section className="card-surface mt-6 p-6">
          <h2 className="display text-lg font-bold">Assessment history</h2>
          <div className="mt-3 divide-y divide-border">
            {history.map((h, i) => (
              <div
                key={`${h.at}-${i}`}
                className="flex items-center gap-3 py-2.5 text-[13px]"
              >
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    h.result === "pass"
                      ? "bg-success"
                      : h.result === "partial"
                        ? "bg-amber-500"
                        : "bg-destructive"
                  }`}
                />
                <span className="w-24 shrink-0 text-muted-foreground">
                  {new Date(h.at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <span className="flex-1">{h.detail}</span>
                <span className="shrink-0 text-[12px] text-muted-foreground">
                  {h.kind.replace("_", " ")}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </AppShell>
  );
}
