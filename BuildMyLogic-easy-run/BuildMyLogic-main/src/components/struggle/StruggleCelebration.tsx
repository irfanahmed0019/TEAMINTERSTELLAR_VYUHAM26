import { useEffect, useMemo, useState } from "react";
import { ArrowRight, PartyPopper, X } from "lucide-react";
import {
  failureReplay,
  pendingCelebration,
  type Misconception,
} from "@/lib/struggle-engine";
import { dismissStruggleCelebration, useLoop } from "@/lib/loop-store";

const CONFETTI_COLORS = [
  "#8b5cf6",
  "#ec4899",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#ef4444",
];

/**
 * The "Misconception Conquered" moment: a full-screen celebration shown once
 * per conquered deep pattern, followed by the Failure Replay - what kept
 * failing, why it counted, and the real passing result. Every figure quoted
 * here comes from recorded graded attempts (see struggle-engine).
 */
export function StruggleCelebration() {
  const struggle = useLoop().struggle;
  const current = useMemo(
    () => (struggle ? pendingCelebration(struggle) : null),
    [struggle],
  );
  if (!current) return null;
  return <CelebrationModal misconception={current} />;
}

function CelebrationModal({ misconception }: { misconception: Misconception }) {
  const [phase, setPhase] = useState<"party" | "replay">("party");
  const replay = failureReplay(misconception);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismissStruggleCelebration(misconception.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [misconception.id]);

  const pieces = useMemo(
    () =>
      Array.from({ length: 60 }, (_, i) => ({
        left: (i * 37) % 100,
        delay: (i % 20) * 0.08,
        duration: 2.4 + (i % 5) * 0.35,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        size: 6 + (i % 4) * 3,
        round: i % 3 === 0,
      })),
    [],
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Misconception Conquered celebration"
      className="fixed inset-0 z-[90] flex items-center justify-center overflow-hidden bg-ink/80 p-4 backdrop-blur-sm"
      onClick={() => dismissStruggleCelebration(misconception.id)}
    >
      <style>{`
        @keyframes bml-confetti-fall {
          0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0.6; }
        }
        @keyframes bml-pop-in {
          0% { transform: scale(0.7); opacity: 0; }
          70% { transform: scale(1.04); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
      {pieces.map((p, i) => (
        <span
          key={i}
          aria-hidden
          className="pointer-events-none absolute top-0"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * (p.round ? 1 : 0.4),
            background: p.color,
            borderRadius: p.round ? "50%" : 2,
            animation: `bml-confetti-fall ${p.duration}s linear ${p.delay}s infinite`,
          }}
        />
      ))}

      <div
        className="relative w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-2xl sm:p-8"
        style={{ animation: "bml-pop-in 0.45s ease-out both" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Close celebration"
          onClick={() => dismissStruggleCelebration(misconception.id)}
          className="absolute right-4 top-4 rounded-full p-2 text-muted-foreground hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>

        {phase === "party" ? (
          <div className="text-center">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-soft text-primary">
              <PartyPopper className="h-8 w-8" />
            </span>
            <h2 className="display mt-4 text-[30px] font-black leading-tight tracking-[-0.03em] sm:text-[36px]">
              Misconception Conquered!
            </h2>
            <p className="mt-2 text-[15px] font-semibold text-muted-foreground">
              {misconception.topicTitle}
            </p>
            <p className="mx-auto mt-4 max-w-sm rounded-2xl bg-muted px-4 py-3 text-[13.5px] font-semibold leading-6">
              {misconception.summary}
            </p>
            <p className="mt-4 text-[13px] font-medium text-muted-foreground">
              This check failed in {misconception.failuresToConquer} of your
              recorded submissions. You then passed a targeted reassessment with
              fresh checks you had not seen. That is the skill.
            </p>
            <button
              type="button"
              onClick={() => setPhase("replay")}
              className="btn-base btn-primary-solid mt-6 text-sm font-bold"
            >
              See your Failure Replay <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div>
            <p className="text-[11px] font-black uppercase tracking-widest text-primary">
              Failure Replay
            </p>
            <h2 className="display mt-1 text-[22px] font-black tracking-[-0.02em]">
              {misconception.topicTitle}: before and after
            </h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                <p className="text-[11px] font-black uppercase tracking-widest text-red-600">
                  Before
                </p>
                <p className="mt-2 text-[13px] font-semibold leading-5 text-red-900">
                  {replay.before}
                </p>
                <p className="mt-2 text-[12px] font-medium leading-5 text-red-800">
                  {replay.cause}
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-[11px] font-black uppercase tracking-widest text-emerald-600">
                  After
                </p>
                <p className="mt-2 text-[13px] font-semibold leading-5 text-emerald-900">
                  {replay.after}
                </p>
                <p className="mt-2 text-[12px] font-medium leading-5 text-emerald-800">
                  This is now part of your Proof of Struggle portfolio on the
                  Progress page.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => dismissStruggleCelebration(misconception.id)}
              className="btn-base btn-primary-solid mt-6 w-full text-sm font-bold"
            >
              Keep building
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
