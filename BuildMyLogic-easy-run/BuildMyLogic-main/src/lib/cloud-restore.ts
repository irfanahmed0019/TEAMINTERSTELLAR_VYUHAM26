/** A missing row is different from an unreadable or malformed saved record. */
export function parseCloudRead<T>(result: {
  data: { state_json: T } | null;
  error: unknown;
}): T | null {
  if (result.error)
    throw new Error("Cloud progress could not be read. Saving is paused.");
  if (result.data === null) return null;
  const state = result.data.state_json;
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("Saved cloud progress is invalid. Saving is paused.");
  }
  return state;
}

/** Restore is read-only. Neither normalization nor an absent row causes a write. */
export async function restoreCloudState<T>(options: {
  read: () => Promise<T | null>;
  current: () => boolean;
  normalize: (state: T) => T;
  local: () => T;
  apply: (state: T) => void;
}): Promise<string | null> {
  const cloud = await options.read();
  if (!options.current()) return null;
  const state = cloud === null ? options.local() : options.normalize(cloud);
  if (cloud !== null) options.apply(state);
  return JSON.stringify(state);
}
