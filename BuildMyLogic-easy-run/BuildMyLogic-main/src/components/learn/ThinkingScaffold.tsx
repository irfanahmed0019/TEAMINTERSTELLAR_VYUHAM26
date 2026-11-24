import { useState } from "react";
import { THINKING_STEPS } from "@/lib/computational-thinking";

/** Optional scratchpad, not a grade or a claim of verified understanding. */
export function ThinkingScaffold() {
  const [notes, setNotes] = useState<string[]>(() =>
    THINKING_STEPS.map(() => ""),
  );
  return (
    <section
      className="mb-4 rounded-2xl border border-purple-200 bg-purple-50/60 p-4"
      aria-label="Think before you code"
    >
      <h3 className="text-sm font-extrabold">Think before you code</h3>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        Break it down, choose where the pieces belong, then test. AI can help
        write code; you decide how it fits.
      </p>
      <div className="mt-3 space-y-2">
        {THINKING_STEPS.map((step, index) => (
          <details
            key={step.title}
            className="rounded-xl border border-purple-100 bg-white p-3"
          >
            <summary className="cursor-pointer text-xs font-bold">
              {index + 1}. {step.title}
            </summary>
            <label className="mt-2 block text-xs leading-5">
              {step.question}
              <textarea
                className="mt-2 min-h-20 w-full rounded-lg border border-border bg-white p-2 text-xs text-foreground"
                value={notes[index]}
                placeholder={step.placeholder}
                onChange={(event) => {
                  const value = event.target.value;
                  setNotes((current) =>
                    current.map((note, n) => (n === index ? value : note)),
                  );
                }}
              />
            </label>
          </details>
        ))}
      </div>
      <p className="mt-3 text-[11px] leading-4 text-muted-foreground">
        Optional scratch notes for this view, not saved or sent to AI. They do
        not change your score or prove learning. Run and Submit still use the
        existing code checks.
      </p>
    </section>
  );
}
