import { useState } from "react";
import {
  diagnosticProbe,
  supportedTransferLanguage,
  type Misconception,
} from "@/lib/struggle-engine";
import { saveDiagnosticPrediction } from "@/lib/loop-store";

/** Records the learner's prediction before revealing the explanation. */
export function DiagnosticProbePanel({ pattern }: { pattern: Misconception }) {
  const language = supportedTransferLanguage(pattern.language);
  const probe = language
    ? diagnosticProbe(pattern.transferTopicId ?? pattern.topicId, language)
    : null;
  const [choice, setChoice] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  if (!probe) return null;
  const saved = pattern.diagnosis;
  const selected = saved?.choice ?? choice;
  const visible = Boolean(saved) || revealed;
  return (
    <section
      className="mb-4 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sky-950"
      aria-label="Prediction diagnosis"
    >
      <details open={!saved?.reviewed}>
        <summary className="cursor-pointer text-[12px] font-black uppercase tracking-widest">
          {saved?.reviewed
            ? `Prediction saved - ${saved.confirmed ? "learner-confirmed hypothesis" : "cause unresolved"}`
            : "Diagnose before adapting"}
        </summary>
        <p className="mt-2 text-[13px] font-semibold">
          Output grouping alone cannot tell us why you failed. Predict this
          trace before seeing the model.
        </p>
        <p className="mt-3 whitespace-pre-wrap rounded-lg bg-white/80 p-3 font-mono text-[13px]">
          {probe.question}
        </p>
        {!visible ? (
          <>
            <fieldset className="mt-3 space-y-2">
              <legend className="text-sm font-bold">Your prediction</legend>
              {probe.options.map((option, i) => (
                <label
                  key={option}
                  className="flex items-center gap-2 rounded-lg bg-white/70 p-2 text-sm"
                >
                  <input
                    type="radio"
                    name={`probe-${pattern.id}`}
                    value={i}
                    checked={choice === i}
                    onChange={() => setChoice(i)}
                  />
                  {option}
                </label>
              ))}
            </fieldset>
            <button
              type="button"
              className="btn-base btn-outline mt-3 text-xs"
              disabled={choice === null}
              onClick={() => {
                saveDiagnosticPrediction(pattern.id, choice ?? 2, false, false);
                setRevealed(true);
              }}
            >
              Check my prediction
            </button>
          </>
        ) : (
          <>
            <p className="mt-3 text-sm">
              Your prediction: <strong>{probe.options[selected ?? 2]}</strong>.
              Trace result: <strong>{probe.options[probe.correct]}</strong>.
            </p>
            <p className="mt-2 text-sm">{probe.model}</p>
            {selected === 0 ? (
              <p className="mt-2 text-sm">
                Possible explanation: {probe.hypothesis} One probe supports this
                possibility; it does not prove the cause of earlier mistakes.
              </p>
            ) : (
              <p className="mt-2 text-sm">
                {selected === probe.correct
                  ? "You predicted this correctly, so this probe does not support that misconception."
                  : "An uncertain answer does not establish a misconception."}{" "}
                Your earlier cause remains open.
              </p>
            )}
            {!saved?.reviewed && (
              <div className="mt-3 flex flex-wrap gap-2">
                {selected === 0 && (
                  <button
                    type="button"
                    className="btn-base btn-primary-solid text-xs"
                    onClick={() =>
                      saveDiagnosticPrediction(pattern.id, selected, true)
                    }
                  >
                    This describes my original mistake
                  </button>
                )}
                <button
                  type="button"
                  className="btn-base btn-outline text-xs"
                  onClick={() =>
                    saveDiagnosticPrediction(pattern.id, selected ?? 2, false)
                  }
                >
                  {selected === 0
                    ? "That was not my original cause"
                    : "Save prediction and continue"}
                </button>
              </div>
            )}
            {saved?.reviewed && (
              <p className="mt-3 text-sm font-bold">
                {saved.confirmed
                  ? `Learner-confirmed hypothesis. Adaptation: ${probe.transferFocus}`
                  : "Saved without a causal claim. A topic transfer task is available; the original cause is unresolved."}
              </p>
            )}
          </>
        )}
      </details>
    </section>
  );
}
