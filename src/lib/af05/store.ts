/**
 * AF-05 state slice, persisted inside the existing learner_memory sync
 * (no database migration required). All mutations go through these helpers
 * so evidence, decisions and revisions stay consistent.
 */
import { getLoopState, setLoopState } from "../loop-store";
import type { Af05State } from "./types";
import { emptyAf05 } from "./types";

export function getAf05(): Af05State {
  return getLoopState().af05 ?? emptyAf05;
}

export function updateAf05(update: (state: Af05State) => void): Af05State {
  // Deep-enough clone: structuredClone keeps the draft safely mutable.
  const draft = structuredClone(getAf05());
  update(draft);
  setLoopState((prev) => ({ ...prev, af05: draft }));
  return draft;
}
