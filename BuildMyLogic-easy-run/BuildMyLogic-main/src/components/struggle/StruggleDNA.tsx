import { useState } from "react";
import {
  Check,
  ChevronDown,
  Crosshair,
  Dna,
  Flame,
  Target,
  Timer,
  TrendingDown,
  Trophy,
} from "lucide-react";
import {
  failureReplay,
  kindLabel,
  struggleByTopic,
  struggleMetrics,
  strugglePatterns,
  type FailureKind,
  type Misconception,
} from "@/lib/struggle-engine";
import { useLoop } from "@/lib/loop-store";

function fmtDuration(ms: number): string {
  const mins = Math.max(1, Math.round(ms / 60000));
  if (mins < 60) return `${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h`;
  return `${Math.round(hours / 24)} d`;
}

const KIND_BAR: Record<string, string> = {
  syntax: "bg-sky-400",
  runtime: "bg-orange-400",
  edge_case: "bg-amber-400",
  logic: "bg-red-400",
  formatting: "bg-violet-400",
};

/**
 * Struggle DNA: the living map of the learner's real failure patterns, plus
 * the Proof of Struggle portfolio. Every number is computed from recorded
 * graded attempts (struggle-engine); with no attempts this tab shows an
 * honest empty state, never invented history.
 */
export function StruggleDNA() {
  const struggle = useLoop().struggle;
  const attempts = struggle?.attempts ?? [];
  const misconceptions = struggle?.misconceptions ?? [];

  if (attempts.length === 0) {
    return (
      <section className="card-surface mt-5 p-6 sm:p-8">
        <div className="flex items-center gap-2.5">
          <Dna className="h-[18px] w-[18px] text-primary" />
          <h2 className="text-xl font-extrabold">Struggle DNA</h2>
        </div>
        <div className="mt-6 rounded-2xl bg-muted px-5 py-10 text-center">
          <Dna className="mx-auto h-7 w-7 text-muted-foreground" />
          <p className="mx-auto mt-3 max-w-md text-[13.5px] font-semibold leading-6 text-muted-foreground">
            Your Struggle DNA is built only from your real attempts. Submit
            practice tasks on the Learn page or in the practice workspace -
            every failure and every pass is recorded here, repeated patterns get
            targeted fixes, and patterns beaten through a targeted reassessment
            become your Proof of Struggle.
          </p>
        </div>
      </section>
    );
  }

  const metrics = struggleMetrics(struggle!);
  const topics = struggleByTopic(struggle!);
  const patterns = strugglePatterns(struggle!);
  const active = misconceptions.filter((m) => m.status !== "conquered");
  const conquered = misconceptions.filter(
    (m) => m.status === "conquered" && m.reassessed === true,
  );

  return (
    <div className="mt-5 space-y-5">
      {/* Metrics from the PRD's success measures */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Metric
          icon={Trophy}
          value={metrics.conqueredCount}
          label="Misconceptions conquered"
        />
        <Metric
          icon={Target}
          value={
            metrics.conquerRate === null
              ? "—"
              : `${Math.round(metrics.conquerRate * 100)}%`
          }
          label="Of locked patterns beaten"
        />
        <Metric
          icon={Timer}
          value={
            metrics.avgTimeToConquerMs === null
              ? "—"
              : fmtDuration(metrics.avgTimeToConquerMs)
          }
          label="Avg. elapsed time: first failure → conquer"
        />
        <Metric
          icon={TrendingDown}
          value={
            metrics.repeatShareRecent === null
              ? "—"
              : `${Math.round(metrics.repeatShareRecent * 100)}%`
          }
          label={
            metrics.repeatShareEarly !== null &&
            metrics.repeatShareRecent !== null &&
            metrics.repeatShareRecent < metrics.repeatShareEarly
              ? "Recent failures repeating old patterns (falling)"
              : "Recent failures repeating old patterns"
          }
        />
      </div>

      {/* Failure pattern map */}
      <section className="card-surface p-5 sm:p-6">
        <div className="flex items-center gap-2.5">
          <Dna className="h-[18px] w-[18px] text-primary" />
          <h2 className="text-[16px] font-extrabold">
            Your failure pattern map
          </h2>
        </div>
        <p className="mt-1 text-[12px] font-medium text-muted-foreground">
          From your {metrics.totalAttempts} recorded attempt
          {metrics.totalAttempts === 1 ? "" : "s"} ({metrics.totalFails}{" "}
          failed). This is where your failures cluster - not a guess about how
          you think.
        </p>
        {patterns.length > 0 && (
          <div className="mt-4 space-y-2">
            {patterns.map((p) => (
              <p
                key={p}
                className="rounded-xl bg-primary-soft px-3.5 py-2.5 text-[12.5px] font-bold text-accent-foreground"
              >
                {p}
              </p>
            ))}
          </div>
        )}
        <div className="mt-5 space-y-4">
          {topics.map((t) => {
            const totalKind = Object.values(t.kinds).reduce((a, b) => a + b, 0);
            return (
              <div
                key={t.topicId}
                className="rounded-2xl border border-border p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[14px] font-bold">{t.topicTitle}</p>
                  <p className="text-[12px] font-semibold text-muted-foreground">
                    {t.fails} failed · {t.passes} passed
                    {t.conquered > 0 ? ` · ${t.conquered} conquered` : ""}
                  </p>
                </div>
                {totalKind > 0 && (
                  <div className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
                    {(Object.entries(t.kinds) as [FailureKind, number][]).map(
                      ([kind, count]) => (
                        <div
                          key={kind}
                          className={`h-full ${KIND_BAR[kind]}`}
                          style={{ width: `${(count / totalKind) * 100}%` }}
                          title={`${kindLabel(kind)}: ${count}`}
                        />
                      ),
                    )}
                  </div>
                )}
                {t.topKind && (
                  <p className="mt-2 text-[12px] font-semibold text-muted-foreground">
                    Most common here: {kindLabel(t.topKind)}
                    {t.activeMisconceptions > 0
                      ? ` · ${t.activeMisconceptions} pattern${t.activeMisconceptions === 1 ? "" : "s"} being worked on`
                      : ""}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Active patterns with their targeted fixes */}
      {active.length > 0 && (
        <section className="card-surface p-5 sm:p-6">
          <div className="flex items-center gap-2.5">
            <Crosshair className="h-[18px] w-[18px] text-amber-500" />
            <h2 className="text-[16px] font-extrabold">
              Patterns being broken
            </h2>
          </div>
          <div className="mt-4 space-y-3">
            {active.map((m) => (
              <div
                key={m.id}
                className="rounded-2xl border border-amber-200 bg-amber-50 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[13.5px] font-bold text-amber-900">
                    {m.summary}
                  </p>
                  <span className="pill shrink-0 bg-amber-100 font-bold text-amber-700">
                    {m.status === "locked"
                      ? "Repeated pattern - inferred"
                      : "Inferred - watching"}{" "}
                    · {m.occurrences}×
                  </span>
                </div>
                {m.targetedChallenge && (
                  <p className="mt-2 text-[12.5px] font-medium leading-5 text-amber-900">
                    {m.targetedChallenge.task}
                  </p>
                )}
                <p className="mt-2 text-[11.5px] font-semibold text-amber-700">
                  {m.depth === "deep"
                    ? "Repeated same-check failure"
                    : "Repeat slip (compile / crash / format)"}{" "}
                  · first recorded{" "}
                  {new Date(m.firstSeenAt).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Proof of Struggle portfolio */}
      <section className="card-surface p-5 sm:p-6">
        <div className="flex items-center gap-2.5">
          <Trophy className="h-[18px] w-[18px] text-emerald-600" />
          <h2 className="text-[16px] font-extrabold">Proof of Struggle</h2>
        </div>
        <p className="mt-1 text-[12px] font-medium text-muted-foreground">
          The weaknesses you actually beat, with the receipt for each one.
        </p>
        <div className="mt-4 space-y-3">
          {conquered.length === 0 ? (
            <p className="text-[13px] font-semibold text-muted-foreground">
              Nothing conquered yet. When a repeated pattern locks and you pass
              its targeted reassessment (fresh checks you have not seen), it
              lands here.
            </p>
          ) : (
            conquered.map((m) => <ConqueredCard key={m.id} misconception={m} />)
          )}
        </div>
      </section>
    </div>
  );
}

function Metric({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Trophy;
  value: number | string;
  label: string;
}) {
  return (
    <section className="card-surface flex items-center gap-3.5 p-5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="display truncate text-[20px] font-black leading-tight">
          {value}
        </p>
        <p className="mt-0.5 text-[11.5px] font-medium leading-4 text-muted-foreground">
          {label}
        </p>
      </div>
    </section>
  );
}

function ConqueredCard({ misconception: m }: { misconception: Misconception }) {
  const [open, setOpen] = useState(false);
  const replay = failureReplay(m);
  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3.5 text-left"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
          <Check className="h-5 w-5" strokeWidth={3} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-bold">
            {m.topicTitle}
          </span>
          <span className="mt-0.5 block truncate text-[12px] font-semibold text-muted-foreground">
            {m.summary}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="pill bg-emerald-100 font-bold text-emerald-700">
            <Flame className="h-3 w-3" /> {m.failuresToConquer ?? m.occurrences}{" "}
            fails
            {typeof m.timeToConquerMs === "number"
              ? ` · ${fmtDuration(m.timeToConquerMs)} elapsed`
              : ""}
          </span>
          <ChevronDown
            className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </span>
      </button>
      {open && (
        <div className="mt-3 grid gap-3 border-t border-emerald-200 pt-3 sm:grid-cols-2">
          <div className="rounded-xl border border-red-200 bg-red-50 p-3.5">
            <p className="text-[10.5px] font-black uppercase tracking-widest text-red-600">
              What kept failing
            </p>
            <p className="mt-1.5 text-[12.5px] font-semibold leading-5 text-red-900">
              {replay.before}
            </p>
            <p className="mt-1.5 text-[12px] font-medium leading-5 text-red-800">
              {replay.cause}
            </p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5">
            <p className="text-[10.5px] font-black uppercase tracking-widest text-emerald-600">
              How it ended
            </p>
            <p className="mt-1.5 text-[12.5px] font-semibold leading-5 text-emerald-900">
              {replay.after}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
