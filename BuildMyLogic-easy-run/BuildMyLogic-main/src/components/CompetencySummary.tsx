import { CodingSupportNotice } from "@/components/CodingSupportNotice";
import { competencyView } from "@/lib/competency";
import { useLoop } from "@/lib/loop-store";
export function CompetencySummary() {
  const state = useLoop();
  const items = competencyView(state).filter((c) => c.observations > 0);
  if (state.sampleProvenance) return null;
  return (
    <section className="card-surface mt-5 p-5">
      <h2 className="text-lg font-extrabold">Evidence and next checks</h2>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        Shared competency estimates from retained graded history. Finite tests
        and client reports are not proof of independence or general mastery.
        Time alone never lowers these estimates.
      </p>
      <CodingSupportNotice />
      {items.length === 0 ? (
        <p className="mt-3 text-sm">
          No graded observations yet. Resume claims and old scores remain saved,
          but are not promoted to evidence.
        </p>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {items.slice(0, 6).map((c) => (
            <div key={c.skill} className="rounded-xl border border-border p-3">
              <h3 className="text-sm font-bold">{c.skill}</h3>
              <p className="mt-1 text-xs">
                Estimate {c.estimate}/100 · {c.confidence} confidence ·{" "}
                {c.observations} observations
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {c.recentPerformance} · {c.trend}
              </p>
              <p className="mt-2 text-xs leading-5">{c.reason}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Sources: {c.evidenceSources.join(", ")}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
