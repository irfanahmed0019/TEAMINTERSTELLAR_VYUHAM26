import { codingSupportSummary } from "@/lib/initial-coding-diagnostic";
import { useLoop } from "@/lib/loop-store";
/** Same persisted support event on all learner views, not a separate score. */
export function CodingSupportNotice() {
  const state = useLoop();
  const text =
    !state.sampleProvenance &&
    codingSupportSummary(state.profile?.initialCodingDiagnostic);
  return text ? (
    <p
      role="note"
      className="my-3 rounded-xl border border-border bg-muted p-3 text-sm leading-6"
    >
      {text}
    </p>
  ) : null;
}
